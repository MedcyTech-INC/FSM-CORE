from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.models.employee import Employee
from app.models.attendance import Attendance
from app.models.break_record import BreakRecord
from app.schemas.attendance import BreakStartRequest, BreakResponse

router = APIRouter(prefix="/api/breaks", tags=["Breaks"])


@router.post("/start", response_model=BreakResponse)
async def start_break(
    data: BreakStartRequest,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """Pause active working session and begin a break."""
    today = date.today()
    now = datetime.now(timezone.utc)

    # Verify active clock-in
    stmt_att = select(Attendance).where(
        Attendance.employee_id == current_employee.id,
        Attendance.work_date == today
    )
    result_att = await db.execute(stmt_att)
    attendance = result_att.scalar_one_or_none()

    if not attendance or not attendance.punch_in_time or attendance.punch_out_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot start a break without an active clock-in session"
        )

    # Check if there is already an open break
    stmt_open = select(BreakRecord).where(
        BreakRecord.employee_id == current_employee.id,
        BreakRecord.end_time.is_(None)
    )
    open_break = (await db.execute(stmt_open)).scalar_one_or_none()
    if open_break:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A break session is already in progress"
        )

    break_rec = BreakRecord(
        attendance_id=attendance.id,
        employee_id=current_employee.id,
        start_time=now,
        reason=data.reason,
        duration_minutes=0
    )
    db.add(break_rec)
    await db.commit()
    await db.refresh(break_rec)
    return break_rec


@router.post("/end", response_model=BreakResponse)
async def end_break(
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """Resume active working session and conclude open break interval."""
    now = datetime.now(timezone.utc)

    stmt_open = select(BreakRecord).where(
        BreakRecord.employee_id == current_employee.id,
        BreakRecord.end_time.is_(None)
    )
    open_break = (await db.execute(stmt_open)).scalar_one_or_none()
    if not open_break:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active break session found to resume from"
        )

    open_break.end_time = now
    delta_mins = int((now - open_break.start_time).total_seconds() / 60.0)
    open_break.duration_minutes = max(1, delta_mins)

    await db.commit()
    await db.refresh(open_break)
    return open_break
