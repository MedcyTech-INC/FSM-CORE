import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.dependencies.permissions import RequireRole
from app.models.employee import Employee, EmployeeRole
from app.models.leave_request import LeaveRequest, LeaveRequestStatus
from app.models.leave_balance import LeaveBalance
from app.schemas.leave import LeaveApplyRequest, LeaveApproveRequest, LeaveRequestResponse, LeaveBalanceResponse
from app.services.leave_service import LeaveService
from app.services.hierarchy_service import HierarchyService

router = APIRouter(prefix="/api/leaves", tags=["Leaves & Balance"])


@router.post("/apply", response_model=LeaveRequestResponse, status_code=status.HTTP_201_CREATED)
async def apply_leave(
    data: LeaveApplyRequest,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """Submit a new leave application."""
    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="End date must be greater than or equal to start date")

    days_count = float((data.end_date - data.start_date).days + 1)

    req = LeaveRequest(
        employee_id=current_employee.id,
        leave_type=data.leave_type.upper(),
        start_date=data.start_date,
        end_date=data.end_date,
        days_count=days_count,
        reason=data.reason,
        status=LeaveRequestStatus.PENDING.value
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


@router.get("/my-requests", response_model=List[LeaveRequestResponse])
async def list_my_leave_requests(
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """List historical and pending leave requests for the logged-in user."""
    stmt = (
        select(LeaveRequest)
        .where(LeaveRequest.employee_id == current_employee.id)
        .order_by(LeaveRequest.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/balances", response_model=List[LeaveBalanceResponse])
async def get_my_balances(
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """List available leave quotas and balances for the logged-in user."""
    stmt = (
        select(LeaveBalance)
        .where(LeaveBalance.employee_id == current_employee.id)
        .order_by(LeaveBalance.leave_type)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/{request_id}/approve", response_model=LeaveRequestResponse)
async def process_leave_decision(
    request_id: uuid.UUID,
    decision: LeaveApproveRequest,
    req_context: Request,
    current_employee: Employee = Depends(RequireRole([
        EmployeeRole.ADMIN.value,
        EmployeeRole.GM.value,
        EmployeeRole.ZSM.value,
        EmployeeRole.RSM.value
    ])),
    db: AsyncSession = Depends(get_db)
):
    """
    Manager action to approve or reject a leave application.
    Executes an atomic transaction with row-level locks on leave quotas.
    """
    client_ip = req_context.client.host if req_context.client else None

    # Verify subordinate scope
    stmt = select(LeaveRequest).where(LeaveRequest.id == request_id)
    leave_req = (await db.execute(stmt)).scalar_one_or_none()
    if not leave_req:
        raise HTTPException(status_code=404, detail="Leave request not found")

    can_access = await HierarchyService.can_access_employee(db, current_employee, leave_req.employee_id)
    if not can_access:
        raise HTTPException(status_code=403, detail="Forbidden: Employee is outside your reporting chain")

    if decision.action.upper() == "APPROVE":
        success, msg, updated_req = await LeaveService.approve_leave_request(
            db, request_id, current_employee, ip_address=client_ip
        )
    elif decision.action.upper() == "REJECT":
        success, msg, updated_req = await LeaveService.reject_leave_request(
            db, request_id, current_employee, rejection_reason=decision.rejection_reason, ip_address=client_ip
        )
    else:
        raise HTTPException(status_code=400, detail="Action must be APPROVE or REJECT")

    if not success:
        raise HTTPException(status_code=400, detail=msg)

    return updated_req
