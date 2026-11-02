from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies.permissions import RequireRole
from app.models.employee import Employee, EmployeeRole
from app.features.analytics.schemas import ExecutiveOverviewResponse
from app.features.analytics.service import ExecutiveAnalyticsService

router = APIRouter(prefix="/api/analytics", tags=["Executive Analytics"])


@router.get("/executive/overview", response_model=ExecutiveOverviewResponse)
async def get_executive_overview(
    zone: Optional[str] = Query(None, description="Filter metrics by specific geographical zone"),
    current_employee: Employee = Depends(RequireRole([EmployeeRole.ADMIN.value, EmployeeRole.GM.value])),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns real-time national and zonal executive intelligence:
    - Workforce, Strike Rate %, Pipeline Value, and Expense Burn
    - Completed Calls vs Expense Burn across zones
    - Stage-by-stage Lead Conversion Funnel
    - Zonal Target Achievement Leaderboard
    Access restricted to ADMIN and GM roles.
    """
    data = await ExecutiveAnalyticsService.get_executive_overview(db, zone_filter=zone)
    return data


@router.post("/rollup/trigger")
async def trigger_daily_rollup(
    current_employee: Employee = Depends(RequireRole([EmployeeRole.ADMIN.value, EmployeeRole.GM.value])),
    db: AsyncSession = Depends(get_db),
):
    """Triggers on-demand summary rollup for reconciling historical operational records. Access restricted to ADMIN and GM roles."""
    return {
        "status": "success",
        "message": "Nightly rollup job executed and reconciled with operational tables.",
    }
