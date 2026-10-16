import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.models.employee import Employee
from app.models.field_session import FieldSession, FieldSessionStatus
from app.schemas.field import FieldSessionStartRequest, FieldSessionEndRequest, FieldSessionResponse
from app.services.geofence_service import GeofenceService

router = APIRouter(prefix="/api/field-sessions", tags=["Field Travel Sessions"])


@router.post("/start", response_model=FieldSessionResponse, status_code=status.HTTP_201_CREATED)
async def start_field_session(
    data: FieldSessionStartRequest,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """Begin field travel tracking for the day."""
    now = datetime.now(timezone.utc)

    # Check for existing active session
    stmt_active = select(FieldSession).where(
        FieldSession.employee_id == current_employee.id,
        FieldSession.status == FieldSessionStatus.ACTIVE.value
    )
    active = (await db.execute(stmt_active)).scalar_one_or_none()
    if active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A field travel session is already active"
        )

    session = FieldSession(
        employee_id=current_employee.id,
        start_time=now,
        start_lat=data.latitude,
        start_lon=data.longitude,
        accumulated_distance_km=0.0,
        status=FieldSessionStatus.ACTIVE.value
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/{session_id}/end", response_model=FieldSessionResponse)
async def end_field_session(
    session_id: uuid.UUID,
    data: FieldSessionEndRequest,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """Conclude field travel session and finalize calculated distance."""
    now = datetime.now(timezone.utc)

    stmt = select(FieldSession).where(
        FieldSession.id == session_id,
        FieldSession.employee_id == current_employee.id
    )
    session = (await db.execute(stmt)).scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Field session not found")

    if session.status == FieldSessionStatus.COMPLETED.value:
        raise HTTPException(status_code=400, detail="Session is already completed")

    session.end_time = now
    session.end_lat = data.latitude
    session.end_lon = data.longitude
    session.status = FieldSessionStatus.COMPLETED.value

    # Compute distance between start and end as minimum baseline
    dist_meters = GeofenceService.haversine_distance_meters(
        session.start_lat, session.start_lon, data.latitude, data.longitude
    )
    session.accumulated_distance_km = round(dist_meters / 1000.0, 2)

    await db.commit()
    await db.refresh(session)
    return session
