from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.dependencies.permissions import RequireRole
from app.models.employee import Employee, EmployeeRole
from app.features.monthly_target.models import Holiday
from app.schemas.holiday import HolidayCreateRequest, HolidayResponse

router = APIRouter(prefix="/api/v1/holidays", tags=["Company Holidays"])


@router.get("", response_model=List[HolidayResponse])
async def list_holidays(
    year: Optional[int] = Query(None, description="Filter holidays by calendar year (e.g. 2026, 2027)"),
    region: Optional[str] = Query(None, description="Filter by region (e.g. National, Maharashtra)"),
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    List company holidays. Available to all authenticated employees.
    Optionally filter by year and region.
    """
    stmt = select(Holiday).order_by(Holiday.holiday_date.asc())

    filters = []
    if year is not None:
        filters.append(extract("year", Holiday.holiday_date) == year)
    if region:
        filters.append(Holiday.region == region)

    if filters:
        stmt = stmt.where(and_(*filters))

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=HolidayResponse, status_code=status.HTTP_201_CREATED)
async def add_or_update_holiday(
    data: HolidayCreateRequest,
    current_employee: Employee = Depends(RequireRole([EmployeeRole.ADMIN.value, EmployeeRole.GM.value])),
    db: AsyncSession = Depends(get_db),
):
    """
    Add or update a holiday in the calendar.
    Restricted to Admins and General Managers.
    """
    stmt = select(Holiday).where(Holiday.holiday_date == data.holiday_date)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        existing.name = data.name
        existing.region = data.region
        await db.commit()
        await db.refresh(existing)
        return existing

    new_holiday = Holiday(
        holiday_date=data.holiday_date,
        name=data.name,
        region=data.region,
    )
    db.add(new_holiday)
    await db.commit()
    await db.refresh(new_holiday)
    return new_holiday


@router.delete("/{holiday_date}", status_code=status.HTTP_200_OK)
async def delete_holiday(
    holiday_date: date,
    current_employee: Employee = Depends(RequireRole([EmployeeRole.ADMIN.value, EmployeeRole.GM.value])),
    db: AsyncSession = Depends(get_db),
):
    """
    Remove a holiday from the calendar.
    Restricted to Admins and General Managers.
    """
    stmt = select(Holiday).where(Holiday.holiday_date == holiday_date)
    result = await db.execute(stmt)
    holiday = result.scalar_one_or_none()

    if not holiday:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Holiday on {holiday_date} not found",
        )

    await db.delete(holiday)
    await db.commit()
    return {"deleted": True, "holiday_date": str(holiday_date)}
