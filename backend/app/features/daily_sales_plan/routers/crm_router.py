from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.features.daily_sales_plan.models.crm import (
    Customer,
    FollowUp,
    Lead,
    MonthlyTarget,
)
from app.features.daily_sales_plan.schemas.crm import (
    CustomerResponse,
    FollowUpCreate,
    FollowUpResponse,
    LeadCreate,
    LeadResponse,
    MonthlyTargetResponse,
)
from app.models.employee import Employee
from app.services.hierarchy_service import HierarchyService

router = APIRouter()


@router.get("/leads", response_model=List[LeadResponse])
async def list_leads(
    employee_id: Optional[uuid.UUID] = Query(default=None),
    stage: Optional[str] = Query(default=None),
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists commercial leads assigned to an employee with hierarchy verification.
    """
    target_emp_id = employee_id or current_employee.id
    if target_emp_id != current_employee.id:
        can_access = await HierarchyService.can_access_employee(db, current_employee, target_emp_id)
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Target employee is outside your organizational reporting hierarchy",
            )

    stmt = select(Lead).where(
        Lead.employee_id == target_emp_id,
        Lead.is_archived.is_(False),
    )
    if stage:
        stmt = stmt.where(Lead.stage == stage.upper())

    stmt = stmt.order_by(Lead.updated_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(
    payload: LeadCreate,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """Creates a new sales opportunity lead."""
    if payload.employee_id != current_employee.id:
        can_access = await HierarchyService.can_access_employee(db, current_employee, payload.employee_id)
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Target employee is outside your organizational reporting hierarchy",
            )

    lead = Lead(
        employee_id=payload.employee_id,
        created_by_id=current_employee.id,
        customer_id=payload.customer_id,
        customer_name=payload.customer_name,
        customer_type=payload.customer_type,
        title=payload.title,
        opportunity_type=payload.opportunity_type,
        interested_product_service=payload.interested_product_service,
        customer_response=payload.customer_response,
        lead_source=payload.lead_source,
        stage=payload.stage.upper(),
        priority=payload.priority.upper(),
        expected_value=payload.expected_value,
        expected_close_date=payload.expected_close_date,
        location_city=payload.location_city,
        contact_person=payload.contact_person,
        contact_phone=payload.contact_phone,
        latitude=payload.latitude,
        longitude=payload.longitude,
        notes=payload.notes,
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return lead


@router.get("/followups", response_model=List[FollowUpResponse])
async def list_followups(
    employee_id: Optional[uuid.UUID] = Query(default=None),
    status_filter: Optional[str] = Query(default="PENDING", alias="status"),
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """Lists scheduled commitments and callbacks."""
    target_emp_id = employee_id or current_employee.id
    if target_emp_id != current_employee.id:
        can_access = await HierarchyService.can_access_employee(db, current_employee, target_emp_id)
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Target employee is outside your organizational reporting hierarchy",
            )

    stmt = select(FollowUp).where(
        FollowUp.employee_id == target_emp_id,
        FollowUp.is_archived.is_(False),
    )
    if status_filter:
        stmt = stmt.where(FollowUp.status == status_filter.upper())

    stmt = stmt.order_by(FollowUp.due_at.asc())
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("/followups", response_model=FollowUpResponse, status_code=status.HTTP_201_CREATED)
async def create_followup(
    payload: FollowUpCreate,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """Schedules a new follow-up callback or visit."""
    if payload.employee_id != current_employee.id:
        can_access = await HierarchyService.can_access_employee(db, current_employee, payload.employee_id)
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Target employee is outside your organizational reporting hierarchy",
            )

    fu = FollowUp(
        employee_id=payload.employee_id,
        created_by_id=current_employee.id,
        lead_id=payload.lead_id,
        customer_id=payload.customer_id,
        field_visit_id=payload.field_visit_id,
        customer_name=payload.customer_name,
        action_type=payload.action_type,
        title=payload.title,
        due_at=payload.due_at,
        priority=payload.priority.upper(),
        notes=payload.notes,
        status="PENDING",
    )
    db.add(fu)
    await db.commit()
    await db.refresh(fu)
    return fu


@router.get("/monthly-targets/current", response_model=Optional[MonthlyTargetResponse])
async def get_current_monthly_target(
    employee_id: Optional[uuid.UUID] = Query(default=None),
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves target quota and achieved pacing for current month."""
    target_emp_id = employee_id or current_employee.id
    if target_emp_id != current_employee.id:
        can_access = await HierarchyService.can_access_employee(db, current_employee, target_emp_id)
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Target employee is outside your organizational reporting hierarchy",
            )

    today = date.today()
    first_of_month = date(today.year, today.month, 1)

    stmt = select(MonthlyTarget).where(
        MonthlyTarget.employee_id == target_emp_id,
        MonthlyTarget.target_month == first_of_month,
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


@router.get("/customers", response_model=List[CustomerResponse])
async def list_customers(
    search: Optional[str] = Query(default=None),
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """Universal Customer Directory listing."""
    stmt = select(Customer).where(Customer.is_active.is_(True))
    if search:
        stmt = stmt.where(Customer.name.ilike(f"%{search}%"))
    stmt = stmt.order_by(Customer.name.asc()).limit(50)
    res = await db.execute(stmt)
    return list(res.scalars().all())
