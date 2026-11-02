import uuid
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Header, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.models.employee import Employee
from app.features.monthly_target.schemas import (
    TargetCreateRequest,
    TargetResponse,
    TargetPatchRequest,
    TargetCancelRequest,
    MyProgressItem,
    TargetDetailResponse,
)
from app.features.monthly_target.service import MonthlyTargetService

router = APIRouter(prefix="/api/v1/targets", tags=["Monthly Targets"])
target_service = MonthlyTargetService()


@router.post("/", response_model=TargetResponse, status_code=status.HTTP_201_CREATED)
async def create_target(
    data: TargetCreateRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    POST /targets: Create a target with assignments.
    Accepts Idempotency-Key header to prevent duplicate submissions on flaky networks.
    """
    return await target_service.create_target(
        db=db,
        actor=current_employee,
        data=data,
        idempotency_key=idempotency_key,
    )


@router.get("/my-progress", response_model=List[MyProgressItem])
async def get_my_progress(
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    GET /targets/my-progress: Returns every active target that applies to the signed-in user,
    including individual, team, territory, and branch targets with scope and own contribution.
    """
    return await target_service.get_my_progress(db=db, current_employee=current_employee)


@router.get("/ai-metrics/{user_id}", response_model=List[MyProgressItem])
async def get_ai_metrics(
    user_id: uuid.UUID,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    GET /targets/ai-metrics/{user_id}: Frozen contract for AI Daily Sales Plan.
    Server-side hierarchy enforced.
    """
    return await target_service.get_ai_metrics(db=db, actor=current_employee, user_id=user_id)


@router.get("/", response_model=List[TargetResponse])
async def list_targets(
    period_start: Optional[date] = Query(None),
    period_end: Optional[date] = Query(None),
    metric_type: Optional[str] = Query(None),
    assignee_id: Optional[uuid.UUID] = Query(None),
    target_status: Optional[str] = Query(None, alias="status"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    GET /targets: List targets scoped to the caller's downward hierarchy.
    Paginated with filters.
    """
    targets, _ = await target_service.list_targets(
        db=db,
        actor=current_employee,
        period_start=period_start,
        period_end=period_end,
        metric_type=metric_type,
        assignee_id=assignee_id,
        status=target_status,
        limit=limit,
        offset=offset,
    )
    return targets


@router.get("/{target_id}", response_model=TargetDetailResponse)
async def get_target_detail(
    target_id: uuid.UUID,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """GET /targets/{target_id}: One target with assignments, progress and change history."""
    return await target_service.get_target_detail(db=db, actor=current_employee, target_id=target_id)


@router.patch("/{target_id}", response_model=TargetResponse)
async def update_target(
    target_id: uuid.UUID,
    data: TargetPatchRequest,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    PATCH /targets/{target_id}: Modify target value, dates, or assignees.
    Requires version for optimistic concurrency control (returns 409 on version mismatch).
    """
    return await target_service.update_target(
        db=db,
        actor=current_employee,
        target_id=target_id,
        req=data,
    )


@router.post("/{target_id}/cancel", response_model=TargetResponse)
async def cancel_target(
    target_id: uuid.UUID,
    data: TargetCancelRequest,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """POST /targets/{target_id}/cancel: Soft-cancels target with version check and documented reason."""
    return await target_service.cancel_target(
        db=db,
        actor=current_employee,
        target_id=target_id,
        req=data,
    )
