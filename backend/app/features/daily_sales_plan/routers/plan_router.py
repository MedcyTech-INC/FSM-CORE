from __future__ import annotations

import uuid
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.features.daily_sales_plan.schemas.plan import (
    PlanApproveRequest,
    PlanGenerateRequest,
    PlanItemCompleteRequest,
    PlanItemResponse,
    PlanItemSkipRequest,
    PlanItemStartRequest,
    PlanReplanRequest,
    PlanResponse,
)
from app.features.daily_sales_plan.services.plan_service import PlanService, MANAGER_ROLES
from app.models.employee import Employee
from app.services.hierarchy_service import HierarchyService

router = APIRouter()
plan_service = PlanService()


@router.post("/generate", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
async def generate_plan(
    payload: PlanGenerateRequest,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    Generates an optimized AI daily sales plan with 2-Opt TSPTW routing.
    Enforces cluster-wide concurrency locking and leave verification.
    """
    if current_employee.id != payload.employee_id:
        can_access = await HierarchyService.can_access_employee(db, current_employee, payload.employee_id)
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Target employee is outside your organizational reporting hierarchy",
            )

    plan = await plan_service.generate_daily_plan(db, payload, current_employee)
    return plan


@router.get("/daily", response_model=PlanResponse)
async def get_daily_plan(
    plan_date: Optional[date] = Query(default=None, alias="date"),
    employee_id: Optional[uuid.UUID] = Query(default=None),
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves the daily sales plan for a given representative and date.
    Strictly read-only query (no database mutations on fetch).
    """
    target_date = plan_date or date.today()
    target_emp_id = employee_id or current_employee.id

    if target_emp_id != current_employee.id:
        can_access = await HierarchyService.can_access_employee(db, current_employee, target_emp_id)
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Target employee is outside your organizational reporting hierarchy",
            )

    plan = await plan_service.get_daily_plan(db, target_emp_id, target_date)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No daily sales plan found for employee {target_emp_id} on {target_date}",
        )
    return plan


@router.post("/{id}/replan", response_model=PlanResponse)
async def replan_sales_plan(
    id: uuid.UUID,
    payload: PlanReplanRequest,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    Midday replanning: Freezes active/completed stops and re-sequences pending stops.
    Increments plan version and snapshots revision audit trail.
    """
    plan = await plan_service.replan_plan(db, id, current_employee, payload)
    return plan


@router.post("/{id}/reconcile", response_model=PlanResponse)
async def reconcile_sales_plan(
    id: uuid.UUID,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    Reconciles pending stops against out-of-band external completions in CRM.
    Transitions qualifying stops to EXTERNALLY_RESOLVED.
    """
    plan = await plan_service.reconcile_plan_obligations(db, id, current_employee)
    return plan


@router.post("/{id}/approve", response_model=PlanResponse)
async def approve_sales_plan(
    id: uuid.UUID,
    payload: Optional[PlanApproveRequest] = None,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    Manager approval transition: Moves a DRAFT plan to APPROVED.
    """
    notes = payload.notes if payload else None
    plan = await plan_service.approve_plan(db, id, current_employee, notes=notes)
    return plan


@router.post("/items/{item_id}/start", response_model=PlanItemResponse)
async def start_stop(
    item_id: uuid.UUID,
    payload: PlanItemStartRequest,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    Transitions stop status to ARRIVED, validates ownership and records arrival metadata.
    """
    item = await plan_service.start_plan_item(db, item_id, current_employee, payload)
    return item


@router.post("/items/{item_id}/complete", response_model=PlanItemResponse)
async def complete_stop(
    item_id: uuid.UUID,
    payload: PlanItemCompleteRequest,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    Completes a planned stop, fulfills obligations, and advances CRM stages.
    Representatives (MR) are restricted to NEGOTIATION; WON/LOST requires Manager review.
    """
    item = await plan_service.complete_plan_item(db, item_id, current_employee, payload)
    return item


@router.post("/items/{item_id}/skip", response_model=PlanItemResponse)
async def skip_stop(
    item_id: uuid.UUID,
    payload: PlanItemSkipRequest,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    Skips a planned stop with mandatory reason. Obligations rescheduled, lead stage untouched.
    """
    item = await plan_service.skip_plan_item(db, item_id, current_employee, payload.skip_reason)
    return item
