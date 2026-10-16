import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee
from app.models.leave_balance import LeaveBalance
from app.models.leave_request import LeaveRequest, LeaveRequestStatus
from app.models.attendance import Attendance, AttendanceStatus, VerificationStatus
from app.models.audit_log import AuditLog


class LeaveService:
    """
    Transactional Leave Operations Service.
    Guarantees strict atomic balance deduction and attendance ledger consistency
    using row-level locking (SELECT ... FOR UPDATE).
    """

    @classmethod
    async def approve_leave_request(
        cls,
        db: AsyncSession,
        request_id: uuid.UUID,
        approver: Employee,
        ip_address: Optional[str] = None
    ) -> Tuple[bool, str, Optional[LeaveRequest]]:
        """
        Executes atomic approval with balance deduction and audit trail.
        """
        now = datetime.now(timezone.utc)

        # Step 1: Load leave request
        stmt_req = select(LeaveRequest).where(LeaveRequest.id == request_id)
        res_req = await db.execute(stmt_req)
        leave_req = res_req.scalar_one_or_none()

        if not leave_req:
            return False, "Leave request not found", None

        if leave_req.status != LeaveRequestStatus.PENDING.value:
            return False, f"Leave request is already {leave_req.status}", leave_req

        current_year = leave_req.start_date.year

        # Step 2: Acquire pessimistic row lock on leave balance
        stmt_balance = (
            select(LeaveBalance)
            .where(
                LeaveBalance.employee_id == leave_req.employee_id,
                LeaveBalance.leave_type == leave_req.leave_type,
                LeaveBalance.year == current_year
            )
            .with_for_update()
        )
        res_balance = await db.execute(stmt_balance)
        balance = res_balance.scalar_one_or_none()

        if not balance:
            # If no balance record exists, create initial or return error
            return False, f"No leave balance ledger found for {leave_req.leave_type} in {current_year}", leave_req

        if balance.remaining_days < leave_req.days_count:
            return False, f"Insufficient leave balance: remaining {balance.remaining_days}, requested {leave_req.days_count}", leave_req

        # Snapshot before state for audit log
        before_state = {
            "status": leave_req.status,
            "used_days": balance.used_days,
            "remaining_days": balance.remaining_days,
        }

        # Step 3: Deduct balance
        balance.used_days += leave_req.days_count
        balance.remaining_days -= leave_req.days_count

        # Step 4: Update request status
        leave_req.status = LeaveRequestStatus.APPROVED.value
        leave_req.approved_by_id = approver.id
        leave_req.approved_at = now

        # Step 5: Mark calendar attendance for approved dates
        curr_date = leave_req.start_date
        while curr_date <= leave_req.end_date:
            stmt_att = select(Attendance).where(
                Attendance.employee_id == leave_req.employee_id,
                Attendance.work_date == curr_date
            )
            res_att = await db.execute(stmt_att)
            existing_att = res_att.scalar_one_or_none()

            if existing_att:
                existing_att.status = AttendanceStatus.ON_LEAVE.value
                existing_att.verification_status = VerificationStatus.VERIFIED.value
            else:
                att = Attendance(
                    employee_id=leave_req.employee_id,
                    work_date=curr_date,
                    status=AttendanceStatus.ON_LEAVE.value,
                    verification_status=VerificationStatus.VERIFIED.value,
                    working_minutes=0
                )
                db.add(att)
            curr_date += timedelta(days=1)

        # Step 6: Immutable audit log
        after_state = {
            "status": leave_req.status,
            "approved_by": str(approver.id),
            "approved_at": now.isoformat(),
            "used_days": balance.used_days,
            "remaining_days": balance.remaining_days,
        }
        audit = AuditLog(
            actor_id=approver.id,
            action="APPROVE_LEAVE",
            resource_type="leave_request",
            resource_id=str(leave_req.id),
            before_state=before_state,
            after_state=after_state,
            ip_address=ip_address
        )
        db.add(audit)

        await db.commit()
        await db.refresh(leave_req)
        return True, "Leave request approved successfully", leave_req

    @classmethod
    async def reject_leave_request(
        cls,
        db: AsyncSession,
        request_id: uuid.UUID,
        approver: Employee,
        rejection_reason: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Tuple[bool, str, Optional[LeaveRequest]]:
        """
        Rejects a pending leave request with documented reason.
        """
        stmt = select(LeaveRequest).where(LeaveRequest.id == request_id)
        result = await db.execute(stmt)
        leave_req = result.scalar_one_or_none()

        if not leave_req:
            return False, "Leave request not found", None

        if leave_req.status != LeaveRequestStatus.PENDING.value:
            return False, f"Leave request is already {leave_req.status}", leave_req

        leave_req.status = LeaveRequestStatus.REJECTED.value
        leave_req.approved_by_id = approver.id
        leave_req.rejection_reason = rejection_reason or "Rejected by manager"

        audit = AuditLog(
            actor_id=approver.id,
            action="REJECT_LEAVE",
            resource_type="leave_request",
            resource_id=str(leave_req.id),
            before_state={"status": LeaveRequestStatus.PENDING.value},
            after_state={"status": LeaveRequestStatus.REJECTED.value, "reason": rejection_reason},
            ip_address=ip_address
        )
        db.add(audit)

        await db.commit()
        await db.refresh(leave_req)
        return True, "Leave request rejected", leave_req
