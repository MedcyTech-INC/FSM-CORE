import logging
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

logger = logging.getLogger("fsm_core.field_visits")
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

    # Publish VisitCompletedEvent to transactional outbox for Monthly Target tracking
    if visit.target_type and visit.target_type.upper() in ["DOCTOR", "HOSPITAL", "CLINIC"]:
        from app.shared_contracts.events import VisitCompletedEvent, publish_event
        from app.features.monthly_target.outbox import OutboxSweeper

        # Read actual geofence validity from the visit record / custom fields
        custom = visit.custom_fields or {}
        is_valid_geofence = False
        if "is_valid_geofence" in custom:
            is_valid_geofence = bool(custom["is_valid_geofence"])
        elif "geofence_verified" in custom:
            is_valid_geofence = bool(custom["geofence_verified"])
        elif "is_geofence_valid" in custom:
            is_valid_geofence = bool(custom["is_geofence_valid"])

        event = VisitCompletedEvent(
            visit_id=visit.id,
            representative_id=visit.employee_id,
            completed_at=now,
            is_valid_geofence=is_valid_geofence,
        )
        event_id = await publish_event(db, event)

        # Store event_id in custom_fields for lineage and downstream reversals
        merged = dict(visit.custom_fields or {})
        merged["target_event_id"] = str(event_id)
        merged["is_valid_geofence"] = is_valid_geofence
        visit.custom_fields = merged

        await db.commit()
        await db.refresh(visit)
        try:
            await OutboxSweeper.process_single_row(db, event_id)
        except Exception as exc:
            logger.error(
                f"Failed immediate outbox processing for event {event_id} on visit {visit.id}: {str(exc)}",
                exc_info=True,
            )
            # Background sweeper will retry if transient failure
        return visit

    await db.commit()
    await db.refresh(visit)
    return visit


@router.patch("/{visit_id}/cancel", response_model=FieldVisitResponse)
async def cancel_visit(
    visit_id: uuid.UUID,
    reason: Optional[str] = None,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """Cancel a field visit. If previously completed and credited, emits VisitCancelledEvent for target reversal."""
    now = datetime.now(timezone.utc)
    stmt = select(FieldVisit).where(FieldVisit.id == visit_id, FieldVisit.employee_id == current_employee.id)
    visit = (await db.execute(stmt)).scalar_one_or_none()

    if not visit:
        raise HTTPException(status_code=404, detail="Field visit not found")

    was_completed = (visit.status == VisitStatus.COMPLETED.value)
    visit.status = VisitStatus.CANCELLED.value

    # If previously completed and logged for targets, publish reversal event
    if was_completed and visit.target_type and visit.target_type.upper() in ["DOCTOR", "HOSPITAL", "CLINIC"]:
        from app.shared_contracts.events import VisitCancelledEvent, publish_event
        from app.features.monthly_target.outbox import OutboxSweeper

        custom = visit.custom_fields or {}
        orig_event_id_str = custom.get("target_event_id")
        orig_event_id = uuid.UUID(orig_event_id_str) if orig_event_id_str else visit.id

        event = VisitCancelledEvent(
            original_event_id=orig_event_id,
            visit_id=visit.id,
            reason=reason or "Visit cancelled after completion",
        )
        event_id = await publish_event(db, event)
        await db.commit()
        await db.refresh(visit)
        try:
            await OutboxSweeper.process_single_row(db, event_id)
        except Exception as exc:
            logger.error(
                f"Failed immediate outbox processing for reversal event {event_id} on visit {visit.id}: {str(exc)}",
                exc_info=True,
            )
            # Background sweeper will retry if transient failure
        return visit

    await db.commit()
    await db.refresh(visit)
    return visit
