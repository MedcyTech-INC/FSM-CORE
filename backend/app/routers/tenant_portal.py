import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.models.tenant import Tenant, TenantBranding, TenantFeature
from app.models.branch import Branch
from app.schemas.tenant import (
    TenantResponse,
    TenantBrandingResponse,
    BranchResponse,
    TenantFeatureItem,
)

router = APIRouter(prefix="/api/tenant", tags=["Tenant Portal & White-Label"])


@router.get("/branding", response_model=TenantBrandingResponse)
async def get_tenant_branding(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the white-label branding assets and UI vocabulary dictionary
    for the active tenant resolved from middleware.
    """
    tenant_id = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        # Fallback to default branding
        return TenantBrandingResponse(
            brand_name="FSM Core Platform",
            primary_color="#00897B",
            terminology_mapping={"target": "Doctor", "visit": "DCR Call", "customer": "Clinic/Hospital"}
        )

    stmt = select(TenantBranding).where(TenantBranding.tenant_id == tenant_id)
    branding = (await db.execute(stmt)).scalar_one_or_none()
    if not branding:
        return TenantBrandingResponse(
            brand_name="FSM Core",
            primary_color="#00897B",
            terminology_mapping={"target": "Doctor", "visit": "DCR Call"}
        )

    return TenantBrandingResponse.model_validate(branding)


@router.get("/branches", response_model=List[BranchResponse])
async def list_tenant_branches(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Returns all operational branches under the current tenant organization."""
    tenant_id = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        return []

    stmt = (
        select(Branch)
        .where(Branch.tenant_id == tenant_id, Branch.is_active.is_(True))
        .order_by(Branch.is_head_office.desc(), Branch.name.asc())
    )
    result = await db.execute(stmt)
    return [BranchResponse.model_validate(b) for b in result.scalars().all()]


@router.get("/features", response_model=List[TenantFeatureItem])
async def list_tenant_features(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Returns active feature entitlements for the current tenant."""
    tenant_id = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        return []

    stmt = select(TenantFeature).where(TenantFeature.tenant_id == tenant_id)
    result = await db.execute(stmt)
    return [TenantFeatureItem(feature_key=f.feature_key, is_enabled=f.is_enabled) for f in result.scalars().all()]


@router.get("/profile", response_model=TenantResponse)
async def get_tenant_profile(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Returns active corporate tenant profile."""
    tenant_id = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active tenant context resolved"
        )

    stmt = select(Tenant).where(Tenant.id == tenant_id)
    tenant = (await db.execute(stmt)).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return TenantResponse.model_validate(tenant)
