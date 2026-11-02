import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, or_, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.models.employee import Employee
from app.lead_management.models import Lead, LeadCustomer, LeadStage, LeadPriority
from app.lead_management.schemas import (
    LeadCreate,
    LeadUpdate,
    LeadResponse,
    LeadStageChangeRequest,
    LeadAssignRequest,
    LeadSummaryResponse,
    LeadHistoryResponse,
    LeadCustomerCreate,
    LeadCustomerResponse,
)
from app.lead_management.service import LeadService

router = APIRouter(tags=["Lead Management"])


# -----------------------------------------------------------------------------
# Customer Master Endpoints
# -----------------------------------------------------------------------------
@router.get("/api/lead-customers/search", response_model=List[LeadCustomerResponse])
async def search_customers(
    q: Optional[str] = Query(None, description="Search term for customer name or phone"),
    customer_type: Optional[str] = None,
    limit: int = 15,
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Fuzzy search existing doctors/clinics/hospitals in the customer master."""
    stmt = select(LeadCustomer).where(LeadCustomer.is_active.is_(True))
    if q and q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.where(or_(LeadCustomer.name.ilike(term), LeadCustomer.phone.ilike(term)))
    if customer_type:
        stmt = stmt.where(LeadCustomer.customer_type == customer_type)

    stmt = stmt.order_by(LeadCustomer.name.asc()).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/api/lead-customers/", response_model=LeadCustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    data: LeadCustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Add a new reusable contact/doctor to the master directory."""
    customer = LeadCustomer(
        name=data.name.strip(),
        customer_type=data.customer_type,
        phone=data.phone,
        location_city=data.location_city,
        location_area=data.location_area,
        territory=data.territory,
        metadata_json=data.metadata_json or {},
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


# -----------------------------------------------------------------------------
# Lead Opportunity Endpoints
# -----------------------------------------------------------------------------
@router.get("/api/leads/summary", response_model=LeadSummaryResponse)
async def get_lead_summary(
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Dashboard KPIs: total leads, open leads, converted, lost, pipeline value."""
    return await LeadService.get_summary_metrics(db, current_employee)


@router.get("/api/leads/", response_model=List[LeadResponse])
async def list_leads(
    stage: Optional[str] = None,
    priority: Optional[str] = None,
    scope: str = Query("all", description="'my' for own leads, 'all' for hierarchy"),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Retrieve leads scoped by reporting hierarchy and filtered by stage/priority."""
    allowed_ids = await LeadService.get_authorized_employee_ids(db, current_employee, requested_scope=scope)

    stmt = (
        select(Lead)
        .options(selectinload(Lead.employee), selectinload(Lead.customer))
        .where(Lead.is_archived.is_(False))
    )

    if allowed_ids is not None:
        stmt = stmt.where(Lead.employee_id.in_(allowed_ids))

    if stage:
        stmt = stmt.where(Lead.stage == stage)

    if priority:
        stmt = stmt.where(Lead.priority == priority)

    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Lead.title.ilike(term),
                Lead.customer_name.ilike(term),
                Lead.location_city.ilike(term)
            )
        )

    stmt = stmt.order_by(desc(Lead.created_at))
    result = await db.execute(stmt)
    leads = result.scalars().all()

    # Format response with employee details
    responses = []
    for lead in leads:
        resp = LeadResponse.model_validate(lead)
        resp.employee_name = lead.employee.full_name if lead.employee else None
        responses.append(resp)

    return responses


@router.post("/api/leads/", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(
    data: LeadCreate,
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Record a new business opportunity (from visit or standalone)."""
    lead = await LeadService.create_lead(db, data, current_employee)
    lead_loaded = await LeadService.get_lead_by_id(db, lead.id, current_employee)
    resp = LeadResponse.model_validate(lead_loaded)
    resp.employee_name = lead_loaded.employee.full_name if lead_loaded.employee else None
    return resp


@router.get("/api/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Fetch complete lead details."""
    lead = await LeadService.get_lead_by_id(db, lead_id, current_employee)
    resp = LeadResponse.model_validate(lead)
    resp.employee_name = lead.employee.full_name if lead.employee else None
    return resp


@router.patch("/api/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: uuid.UUID,
    data: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Update editable details of an opportunity."""
    lead = await LeadService.get_lead_by_id(db, lead_id, current_employee)
    updated = await LeadService.update_lead(db, lead, data, current_employee)
    resp = LeadResponse.model_validate(updated)
    resp.employee_name = updated.employee.full_name if updated.employee else None
    return resp


@router.post("/api/leads/{lead_id}/stage", response_model=LeadResponse)
async def change_stage(
    lead_id: uuid.UUID,
    data: LeadStageChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Advance or close lead stage with validation and audit trail."""
    lead = await LeadService.get_lead_by_id(db, lead_id, current_employee)
    updated = await LeadService.change_stage(db, lead, data, current_employee)
    resp = LeadResponse.model_validate(updated)
    resp.employee_name = updated.employee.full_name if updated.employee else None
    return resp


@router.post("/api/leads/{lead_id}/assign", response_model=LeadResponse)
async def assign_lead(
    lead_id: uuid.UUID,
    data: LeadAssignRequest,
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Reassign lead ownership to another team member (managers only)."""
    lead = await LeadService.get_lead_by_id(db, lead_id, current_employee)
    updated = await LeadService.reassign_lead(db, lead, data, current_employee)
    resp = LeadResponse.model_validate(updated)
    resp.employee_name = updated.employee.full_name if updated.employee else None
    return resp


@router.get("/api/leads/{lead_id}/timeline", response_model=List[LeadHistoryResponse])
async def get_lead_timeline(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    """Chronological activity and audit history for the opportunity."""
    # Ensure authorization
    await LeadService.get_lead_by_id(db, lead_id, current_employee)
    return await LeadService.get_history(db, lead_id)
