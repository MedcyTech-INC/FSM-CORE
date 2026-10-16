import uuid
from datetime import date, datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.models.employee import Employee
from app.models.field_visit import FieldVisit, VisitStatus
from app.schemas.field import FieldVisitCreate, FieldVisitStart, FieldVisitComplete, FieldVisitResponse

router = APIRouter(prefix="/api/field-visits", tags=["Field Visits & DCR"])


@router.get("/", response_model=List[FieldVisitResponse])
async def list_visits(
    visit_date: Optional[date] = None,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve scheduled field visits for a given date (defaults to today)."""
    target_date = visit_date or date.today()
    stmt = (
        select(FieldVisit)
        .where(FieldVisit.employee_id == current_employee.id, FieldVisit.visit_date == target_date)
        .order_by(FieldVisit.created_at)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/", response_model=FieldVisitResponse, status_code=status.HTTP_201_CREATED)
async def create_visit(
    data: FieldVisitCreate,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """Schedule a new field visit to a target entity (Doctor, Chemist, Farmer, Facility, Dealer)."""
    visit = FieldVisit(
        session_id=data.session_id,
        employee_id=current_employee.id,
        target_type=data.target_type,
        target_name=data.target_name,
        target_identifier=data.target_identifier,
        visit_date=data.visit_date,
        status=VisitStatus.SCHEDULED.value,
        custom_fields=data.custom_fields or {}
    )
    db.add(visit)
    await db.commit()
    await db.refresh(visit)
    return visit


@router.patch("/{visit_id}/start", response_model=FieldVisitResponse)
async def start_visit(
    visit_id: uuid.UUID,
    data: FieldVisitStart,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """Mark physical arrival at the visit target, recording GPS coordinates and Base64 proof photo."""
    now = datetime.now(timezone.utc)
    stmt = select(FieldVisit).where(FieldVisit.id == visit_id, FieldVisit.employee_id == current_employee.id)
    visit = (await db.execute(stmt)).scalar_one_or_none()

    if not visit:
        raise HTTPException(status_code=404, detail="Field visit not found")

    visit.arrival_time = now
    visit.latitude = data.latitude
    visit.longitude = data.longitude
    visit.proof_photo = data.proof_photo
    visit.status = VisitStatus.IN_PROGRESS.value

    await db.commit()
    await db.refresh(visit)
    return visit


@router.patch("/{visit_id}/complete", response_model=FieldVisitResponse)
async def complete_visit(
    visit_id: uuid.UUID,
    data: FieldVisitComplete,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """Mark visit completed, documenting discussion notes and updating industry-specific payload."""
    now = datetime.now(timezone.utc)
    stmt = select(FieldVisit).where(FieldVisit.id == visit_id, FieldVisit.employee_id == current_employee.id)
    visit = (await db.execute(stmt)).scalar_one_or_none()

    if not visit:
        raise HTTPException(status_code=404, detail="Field visit not found")

    if not visit.arrival_time:
        raise HTTPException(status_code=400, detail="Cannot complete a visit that has not been started")

    visit.completion_time = now
    visit.discussion_notes = data.discussion_notes
    visit.status = VisitStatus.COMPLETED.value

    if data.custom_fields:
        merged = dict(visit.custom_fields or {})
        merged.update(data.custom_fields)
        visit.custom_fields = merged

    await db.commit()
    await db.refresh(visit)
    return visit
