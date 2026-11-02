import uuid
from datetime import datetime, timezone, date, time
from typing import Optional, List, Set
from fastapi import HTTPException, status
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.employee import Employee, EmployeeRole
from app.services.hierarchy_service import HierarchyService
from app.followups.models import Followup, FollowupHistory, FollowupStatus
from app.followups.schemas import (
    FollowupCreate,
    FollowupUpdate,
    FollowupCompleteRequest,
    FollowupRescheduleRequest,
    FollowupCancelRequest,
    DueSummaryResponse,
    FollowupHistoryResponse,
)
from app.lead_management.models import Lead, LeadCustomer
from app.models.field_visit import FieldVisit


class FollowupService:
    """
    Core Domain Service for Follow-ups & Next Actions.
    Manages action life-cycle, overdue derivations, outcome capture, and rescheduling trails.
    """

    @classmethod
    async def get_authorized_employee_ids(
        cls,
        db: AsyncSession,
        actor: Employee,
        requested_scope: Optional[str] = "all"
    ) -> Optional[Set[uuid.UUID]]:
        """Calculates RBAC employee IDs in downward reporting tree."""
        if actor.role in (EmployeeRole.ADMIN.value, EmployeeRole.GM.value) and requested_scope == "all":
            return None

        if actor.role == EmployeeRole.MR.value or requested_scope == "my":
            return {actor.id}

        return await HierarchyService.get_subordinate_ids(db, actor.id, include_self=True)

    @classmethod
    async def create_followup(
        cls,
        db: AsyncSession,
        data: FollowupCreate,
        actor: Employee
    ) -> Followup:
        """Create a scheduled follow-up action linked to Lead, Customer, or Visit."""
        target_employee_id = data.employee_id or actor.id

        if target_employee_id != actor.id:
            can_assign = await HierarchyService.can_access_employee(db, actor, target_employee_id)
            if not can_assign:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot assign follow-up outside your reporting hierarchy"
                )

        resolved_customer_name = data.customer_name

        # Prefill customer name from linked lead if available
        if data.lead_id:
            lead_stmt = select(Lead).where(Lead.id == data.lead_id)
            lead = (await db.execute(lead_stmt)).scalar_one_or_none()
            if lead and not resolved_customer_name:
                resolved_customer_name = lead.customer_name

        # Prefill from linked field visit if available
        elif data.field_visit_id:
            visit_stmt = select(FieldVisit).where(FieldVisit.id == data.field_visit_id)
            visit = (await db.execute(visit_stmt)).scalar_one_or_none()
            if visit and not resolved_customer_name:
                resolved_customer_name = visit.target_name

        # Prefill from linked customer master
        elif data.lead_customer_id:
            cust_stmt = select(LeadCustomer).where(LeadCustomer.id == data.lead_customer_id)
            cust = (await db.execute(cust_stmt)).scalar_one_or_none()
            if cust and not resolved_customer_name:
                resolved_customer_name = cust.name

        followup = Followup(
            employee_id=target_employee_id,
            created_by_id=actor.id,
            lead_id=data.lead_id,
            lead_customer_id=data.lead_customer_id,
            field_visit_id=data.field_visit_id,
            customer_name=resolved_customer_name,
            action_type=data.action_type,
            title=data.title,
            due_at=data.due_at,
            priority=data.priority.value,
            notes=data.notes,
            status=FollowupStatus.PENDING.value,
        )
        db.add(followup)
        await db.flush()

        # Audit record
        history = FollowupHistory(
            followup_id=followup.id,
            actor_id=actor.id,
            event_type="CREATED",
            new_value=str(data.due_at),
            notes=f"Follow-up scheduled by {actor.full_name}"
        )
        db.add(history)

        await db.commit()
        await db.refresh(followup)
        return followup

    @classmethod
    async def get_followup_by_id(
        cls,
        db: AsyncSession,
        followup_id: uuid.UUID,
        actor: Employee
    ) -> Followup:
        """Fetch follow-up by ID with permission checks."""
        stmt = (
            select(Followup)
            .options(
                selectinload(Followup.employee),
                selectinload(Followup.lead),
                selectinload(Followup.field_visit)
            )
            .where(Followup.id == followup_id, Followup.is_archived.is_(False))
        )
        fup = (await db.execute(stmt)).scalar_one_or_none()
        if not fup:
            raise HTTPException(status_code=404, detail="Follow-up not found")

        allowed_ids = await cls.get_authorized_employee_ids(db, actor)
        if allowed_ids is not None and fup.employee_id not in allowed_ids and fup.created_by_id != actor.id:
            raise HTTPException(status_code=403, detail="Access denied to this follow-up")

        return fup

    @classmethod
    async def complete_followup(
        cls,
        db: AsyncSession,
        followup: Followup,
        data: FollowupCompleteRequest,
        actor: Employee
    ) -> Followup:
        """
        Marks follow-up as COMPLETED with required outcome.
        IMPORTANT: This NEVER automatically mutates the linked Lead stage.
        """
        if followup.status != FollowupStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot complete a follow-up that is already {followup.status}"
            )

        now = datetime.now(timezone.utc)
        followup.status = FollowupStatus.COMPLETED.value
        followup.outcome = data.outcome.strip()
        followup.completed_at = now

        history = FollowupHistory(
            followup_id=followup.id,
            actor_id=actor.id,
            event_type="COMPLETED",
            new_value=FollowupStatus.COMPLETED.value,
            notes=data.outcome.strip()
        )
        db.add(history)

        await db.commit()
        await db.refresh(followup)
        return followup

    @classmethod
    async def reschedule_followup(
        cls,
        db: AsyncSession,
        followup: Followup,
        data: FollowupRescheduleRequest,
        actor: Employee
    ) -> Followup:
        """Reschedules a pending follow-up and logs old vs new timestamps."""
        if followup.status != FollowupStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reschedule a follow-up that is {followup.status}"
            )

        old_due = followup.due_at.isoformat()
        followup.due_at = data.new_due_at

        history = FollowupHistory(
            followup_id=followup.id,
            actor_id=actor.id,
            event_type="RESCHEDULED",
            old_value=old_due,
            new_value=data.new_due_at.isoformat(),
            notes=data.reason.strip()
        )
        db.add(history)

        await db.commit()
        await db.refresh(followup)
        return followup

    @classmethod
    async def cancel_followup(
        cls,
        db: AsyncSession,
        followup: Followup,
        data: FollowupCancelRequest,
        actor: Employee
    ) -> Followup:
        """Cancels a pending follow-up with mandatory reason."""
        if followup.status != FollowupStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel a follow-up that is {followup.status}"
            )

        followup.status = FollowupStatus.CANCELLED.value
        followup.cancel_reason = data.cancel_reason.strip()

        history = FollowupHistory(
            followup_id=followup.id,
            actor_id=actor.id,
            event_type="CANCELLED",
            new_value=FollowupStatus.CANCELLED.value,
            notes=data.cancel_reason.strip()
        )
        db.add(history)

        await db.commit()
        await db.refresh(followup)
        return followup

    @classmethod
    async def get_due_summary(
        cls,
        db: AsyncSession,
        actor: Employee
    ) -> DueSummaryResponse:
        """Calculates due_today, overdue, upcoming, and completed_today counts for dashboard."""
        now = datetime.now(timezone.utc)
        today = now.date()
        start_of_today = datetime.combine(today, time.min, tzinfo=timezone.utc)
        end_of_today = datetime.combine(today, time.max, tzinfo=timezone.utc)

        allowed_ids = await cls.get_authorized_employee_ids(db, actor, requested_scope="my")

        base_filter = [
            Followup.is_archived.is_(False),
            Followup.employee_id.in_(allowed_ids)
        ]

        # Overdue: PENDING and due_at < now
        overdue_stmt = select(func.count(Followup.id)).where(
            *base_filter,
            Followup.status == FollowupStatus.PENDING.value,
            Followup.due_at < now
        )
        overdue_count = (await db.execute(overdue_stmt)).scalar() or 0

        # Due Today: PENDING and due_at between start_of_today and end_of_today
        due_today_stmt = select(func.count(Followup.id)).where(
            *base_filter,
            Followup.status == FollowupStatus.PENDING.value,
            Followup.due_at >= start_of_today,
            Followup.due_at <= end_of_today
        )
        due_today_count = (await db.execute(due_today_stmt)).scalar() or 0

        # Upcoming: PENDING and due_at > end_of_today
        upcoming_stmt = select(func.count(Followup.id)).where(
            *base_filter,
            Followup.status == FollowupStatus.PENDING.value,
            Followup.due_at > end_of_today
        )
        upcoming_count = (await db.execute(upcoming_stmt)).scalar() or 0

        # Completed Today
        comp_stmt = select(func.count(Followup.id)).where(
            *base_filter,
            Followup.status == FollowupStatus.COMPLETED.value,
            Followup.completed_at >= start_of_today
        )
        comp_count = (await db.execute(comp_stmt)).scalar() or 0

        return DueSummaryResponse(
            due_today=due_today_count,
            overdue=overdue_count,
            upcoming=upcoming_count,
            completed_today=comp_count
        )

    @classmethod
    async def get_history(
        cls,
        db: AsyncSession,
        followup_id: uuid.UUID
    ) -> List[FollowupHistoryResponse]:
        """Audit history for a follow-up action."""
        stmt = (
            select(FollowupHistory, Employee)
            .join(Employee, FollowupHistory.actor_id == Employee.id)
            .where(FollowupHistory.followup_id == followup_id)
            .order_by(desc(FollowupHistory.occurred_at))
        )
        result = await db.execute(stmt)
        return [
            FollowupHistoryResponse(
                id=h.id,
                followup_id=h.followup_id,
                actor_id=h.actor_id,
                actor_name=emp.full_name,
                event_type=h.event_type,
                old_value=h.old_value,
                new_value=h.new_value,
                notes=h.notes,
                occurred_at=h.occurred_at
            )
            for h, emp in result.all()
        ]
