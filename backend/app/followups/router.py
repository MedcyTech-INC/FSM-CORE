import uuid
from datetime import datetime, timezone, time
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, and_, or_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.models.employee import Employee
from app.followups.models import Followup, FollowupStatus
from app.followups.schemas import (
    FollowupCreate,
    FollowupUpdate,
    FollowupResponse,
    FollowupCompleteRequest,
    FollowupRescheduleRequest,
    FollowupCancelRequest,
    DueSummaryResponse,
    FollowupHistoryResponse,
)
from app.followups.service import FollowupService

router = APIRouter(prefix="/api/followups", tags=["Follow-ups & Next Actions"])


@router.get("/due-summary", response_model=DueSummaryResponse)
async def get_due_summary(
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Counts of due_today, overdue, upcoming, and completed_today actions for current user."""
    return await FollowupService.get_due_summary(db, current_employee)


@router.get("/", response_model=List[FollowupResponse])
async def list_followups(
    tab: Optional[str] = Query(None, description="Filter tab: due_today, upcoming, overdue, completed, all"),
    lead_id: Optional[uuid.UUID] = None,
    field_visit_id: Optional[uuid.UUID] = None,
    scope: str = Query("all", description="'my' for own tasks, 'all' for hierarchy"),
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """
    List follow-up actions with tabbed view support and hierarchy scoping.
    Tabs:
    - 'due_today': Pending actions due today
    - 'overdue': Pending actions where due time has passed
    - 'upcoming': Pending actions due after today
    - 'completed': Completed actions
    - 'all': All actions
    """
    now = datetime.now(timezone.utc)
    today = now.date()
    start_of_today = datetime.combine(today, time.min, tzinfo=timezone.utc)
    end_of_today = datetime.combine(today, time.max, tzinfo=timezone.utc)

    allowed_ids = await FollowupService.get_authorized_employee_ids(db, current_employee, requested_scope=scope)

    stmt = (
        select(Followup)
        .options(
            selectinload(Followup.employee),
            selectinload(Followup.lead),
            selectinload(Followup.field_visit)
        )
        .where(Followup.is_archived.is_(False))
    )

    if allowed_ids is not None:
        stmt = stmt.where(Followup.employee_id.in_(allowed_ids))

    if lead_id:
        stmt = stmt.where(Followup.lead_id == lead_id)

    if field_visit_id:
        stmt = stmt.where(Followup.field_visit_id == field_visit_id)

    # Tab filter logic
    if tab == "due_today":
        stmt = stmt.where(
            Followup.status == FollowupStatus.PENDING.value,
            Followup.due_at >= start_of_today,
            Followup.due_at <= end_of_today
        ).order_by(asc(Followup.due_at))
    elif tab == "overdue":
        stmt = stmt.where(
            Followup.status == FollowupStatus.PENDING.value,
            Followup.due_at < now
        ).order_by(asc(Followup.due_at))
    elif tab == "upcoming":
        stmt = stmt.where(
            Followup.status == FollowupStatus.PENDING.value,
            Followup.due_at > end_of_today
        ).order_by(asc(Followup.due_at))
    elif tab == "completed":
        stmt = stmt.where(
            Followup.status == FollowupStatus.COMPLETED.value
        ).order_by(desc(Followup.completed_at))
    else:
        stmt = stmt.order_by(asc(Followup.due_at))

    result = await db.execute(stmt)
    items = result.scalars().all()

    responses = []
    for item in items:
        resp = FollowupResponse.model_validate(item)
        resp.employee_name = item.employee.full_name if item.employee else None
        resp.lead_title = item.lead.title if item.lead else None
        resp.is_overdue = item.is_overdue
        responses.append(resp)

    return responses


@router.post("/", response_model=FollowupResponse, status_code=status.HTTP_201_CREATED)
async def create_followup(
    data: FollowupCreate,
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Schedule a new follow-up action linked to Lead, Customer, or Visit."""
    item = await FollowupService.create_followup(db, data, current_employee)
    loaded = await FollowupService.get_followup_by_id(db, item.id, current_employee)
    resp = FollowupResponse.model_validate(loaded)
    resp.employee_name = loaded.employee.full_name if loaded.employee else None
    resp.lead_title = loaded.lead.title if loaded.lead else None
    resp.is_overdue = loaded.is_overdue
    return resp


@router.get("/{followup_id}", response_model=FollowupResponse)
async def get_followup(
    followup_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Fetch follow-up by ID."""
    item = await FollowupService.get_followup_by_id(db, followup_id, current_employee)
    resp = FollowupResponse.model_validate(item)
    resp.employee_name = item.employee.full_name if item.employee else None
    resp.lead_title = item.lead.title if item.lead else None
    resp.is_overdue = item.is_overdue
    return resp


@router.post("/{followup_id}/complete", response_model=FollowupResponse)
async def complete_followup(
    followup_id: uuid.UUID,
    data: FollowupCompleteRequest,
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Complete a follow-up action with recorded outcome."""
    item = await FollowupService.get_followup_by_id(db, followup_id, current_employee)
    updated = await FollowupService.complete_followup(db, item, data, current_employee)
    resp = FollowupResponse.model_validate(updated)
    resp.employee_name = updated.employee.full_name if updated.employee else None
    resp.lead_title = updated.lead.title if updated.lead else None
    resp.is_overdue = updated.is_overdue
    return resp


@router.post("/{followup_id}/reschedule", response_model=FollowupResponse)
async def reschedule_followup(
    followup_id: uuid.UUID,
    data: FollowupRescheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Reschedule promised date/time with audit trail reason."""
    item = await FollowupService.get_followup_by_id(db, followup_id, current_employee)
    updated = await FollowupService.reschedule_followup(db, item, data, current_employee)
    resp = FollowupResponse.model_validate(updated)
    resp.employee_name = updated.employee.full_name if updated.employee else None
    resp.lead_title = updated.lead.title if updated.lead else None
    resp.is_overdue = updated.is_overdue
    return resp


@router.post("/{followup_id}/cancel", response_model=FollowupResponse)
async def cancel_followup(
    followup_id: uuid.UUID,
    data: FollowupCancelRequest,
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Cancel follow-up with reason."""
    item = await FollowupService.get_followup_by_id(db, followup_id, current_employee)
    updated = await FollowupService.cancel_followup(db, item, data, current_employee)
    resp = FollowupResponse.model_validate(updated)
    resp.employee_name = updated.employee.full_name if updated.employee else None
    resp.lead_title = updated.lead.title if updated.lead else None
    resp.is_overdue = updated.is_overdue
    return resp


@router.get("/{followup_id}/history", response_model=List[FollowupHistoryResponse])
async def get_followup_history(
    followup_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Audit trail of completions, reschedules, and cancellations."""
    await FollowupService.get_followup_by_id(db, followup_id, current_employee)
    return await FollowupService.get_history(db, followup_id)
