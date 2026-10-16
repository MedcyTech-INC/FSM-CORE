import uuid
from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.models.employee import Employee
from app.models.attendance import Attendance, AttendanceStatus, VerificationStatus
from app.schemas.attendance import ClockInRequest, ClockOutRequest, AttendanceResponse
from app.services.geofence_service import GeofenceService

router = APIRouter(prefix="/api/attendance", tags=["Attendance & Geofence"])


@router.post("/clock-in", response_model=AttendanceResponse)
async def clock_in(
    data: ClockInRequest,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """
    Punch-in with GPS coordinates and Base64 proof photo.
    Evaluates spatial geofence against approved office boundaries.
    """
    today = date.today()
    now = datetime.now(timezone.utc)

    # Check if already punched in today
    stmt = (
        select(Attendance)
        .options(selectinload(Attendance.breaks))
        .where(Attendance.employee_id == current_employee.id, Attendance.work_date == today)
    )
    result = await db.execute(stmt)
    existing_attendance = result.scalar_one_or_none()

    if existing_attendance and existing_attendance.punch_in_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee has already clocked in for today"
        )

    # Spatial geofence evaluation
    is_geofence_valid, verif_status, matched_office, distance = await GeofenceService.verify_geofence(
        db,
        latitude=data.latitude,
        longitude=data.longitude,
        accuracy_meters=data.accuracy_meters
    )

    if existing_attendance:
        # Update existing record (e.g. if previously marked on leave or absent)
        existing_attendance.punch_in_time = now
        existing_attendance.punch_in_lat = data.latitude
        existing_attendance.punch_in_lon = data.longitude
        existing_attendance.punch_in_proof = data.proof_image
        existing_attendance.status = AttendanceStatus.PRESENT.value
        existing_attendance.verification_status = verif_status
        record = existing_attendance
    else:
        record = Attendance(
            employee_id=current_employee.id,
            work_date=today,
            punch_in_time=now,
            punch_in_lat=data.latitude,
            punch_in_lon=data.longitude,
            punch_in_proof=data.proof_image,
            status=AttendanceStatus.PRESENT.value,
            verification_status=verif_status,
            working_minutes=0
        )
        db.add(record)

    await db.commit()
    await db.refresh(record)
    return record


@router.post("/clock-out", response_model=AttendanceResponse)
async def clock_out(
    data: ClockOutRequest,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """Punch-out with coordinates and end-of-day summary, computing total working hours."""
    today = date.today()
    now = datetime.now(timezone.utc)

    stmt = (
        select(Attendance)
        .options(selectinload(Attendance.breaks))
        .where(Attendance.employee_id == current_employee.id, Attendance.work_date == today)
    )
    result = await db.execute(stmt)
    attendance = result.scalar_one_or_none()

    if not attendance or not attendance.punch_in_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot clock out: No active clock-in recorded for today"
        )

    if attendance.punch_out_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee has already clocked out for today"
        )

    attendance.punch_out_time = now
    attendance.punch_out_lat = data.latitude
    attendance.punch_out_lon = data.longitude
    attendance.punch_out_summary = data.summary

    # Calculate total duration minus break minutes
    total_delta = (now - attendance.punch_in_time).total_seconds() / 60.0
    total_break_minutes = sum(b.duration_minutes for b in attendance.breaks if b.end_time is not None)
    attendance.working_minutes = max(0, int(total_delta - total_break_minutes))

    await db.commit()
    await db.refresh(attendance)
    return attendance


@router.get("/today", response_model=Optional[AttendanceResponse])
async def get_today_attendance(
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve today's active attendance session and break logs."""
    today = date.today()
    stmt = (
        select(Attendance)
        .options(selectinload(Attendance.breaks))
        .where(Attendance.employee_id == current_employee.id, Attendance.work_date == today)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
