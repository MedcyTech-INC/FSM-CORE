import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Header, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.models.employee import Employee
from app.features.revenue_leakage.schemas import (
    AlertActionCreateRequest,
    AlertDetailResponse,
    AlertItemResponse,
    PaginatedAlertsResponse,
    RulePatchRequest,
    RuleResponse,
    ScanRunResponse,
)
from app.features.revenue_leakage.service import RevenueLeakageService

router = APIRouter(prefix="/api/v1/revenue-leakage", tags=["Revenue Leakage Detection"])
leakage_service = RevenueLeakageService()


@router.get("/alerts", response_model=PaginatedAlertsResponse)
async def list_alerts(
    rule_code: Optional[str] = Query(None, description="Filter by rule code"),
    status: Optional[str] = Query(None, description="Filter by alert status (active, acknowledged, resolved, dismissed)"),
    attention_priority: Optional[str] = Query(None, description="Filter by priority (low, medium, high)"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type (customer, lead, territory)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    GET /revenue-leakage/alerts: List operational warning alerts in the caller's scope.
    Sorted by attention priority then last observed timestamp.
    """
    return await leakage_service.list_alerts(
        db=db,
        actor=current_employee,
        rule_code=rule_code,
        status=status,
        attention_priority=attention_priority,
        entity_type=entity_type,
        page=page,
        page_size=page_size,
    )


@router.get("/alerts/{alert_id}", response_model=AlertDetailResponse)
async def get_alert_detail(
    alert_id: uuid.UUID,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    GET /revenue-leakage/alerts/{alert_id}: Single alert detail with observations, actions, and earlier occurrences.
    Records view audit in alert_views.
    """
    return await leakage_service.get_alert_detail(
        db=db,
        actor=current_employee,
        alert_id=alert_id,
    )


@router.post("/alerts/{alert_id}/actions", response_model=AlertItemResponse)
async def record_alert_action(
    alert_id: uuid.UUID,
    data: AlertActionCreateRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    POST /revenue-leakage/alerts/{alert_id}/actions: Acknowledge, resolve, dismiss, or add note.
    Optimistic lock via expected_version protects against concurrent overwrites.
    """
    return await leakage_service.record_action(
        db=db,
        actor=current_employee,
        alert_id=alert_id,
        data=data,
        idempotency_key=idempotency_key,
    )


@router.get("/rules", response_model=List[RuleResponse])
async def list_rules(
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    GET /revenue-leakage/rules: List all 5 operational warning rules with configured thresholds and ratios.
    Allowed roles: Senior Manager and above.
    """
    return await leakage_service.list_rules(
        db=db,
        actor=current_employee,
    )


@router.patch("/rules/{rule_id}", response_model=RuleResponse)
async def patch_rule(
    rule_id: uuid.UUID,
    data: RulePatchRequest,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    PATCH /revenue-leakage/rules/{rule_id}: Edit thresholds or ratios with mandatory audit reason.
    Allowed roles: Senior Manager and above.
    """
    return await leakage_service.patch_rule(
        db=db,
        actor=current_employee,
        rule_id=rule_id,
        data=data,
    )


@router.get("/scan-runs", response_model=List[ScanRunResponse])
async def list_scan_runs(
    limit: int = Query(50, ge=1, le=100),
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    GET /revenue-leakage/scan-runs: Recent scanner runs and status.
    Allowed roles: Senior Manager and above.
    """
    return await leakage_service.list_scan_runs(
        db=db,
        actor=current_employee,
        limit=limit,
    )
