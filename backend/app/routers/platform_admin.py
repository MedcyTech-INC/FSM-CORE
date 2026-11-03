import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.models.tenant import Tenant, TenantFeature, TenantBranding
from app.models.branch import Branch
from app.models.employee import Employee, EmployeeRole
from app.services.auth_service import AuthService
from app.schemas.tenant import (
    TenantCreateRequest,
    TenantResponse,
    TenantDetailResponse,
    BranchCreateRequest,
    BranchResponse,
    TenantFeatureItem,
    TenantBrandingResponse,
)

router = APIRouter(prefix="/admin/platform", tags=["Platform Super-Admin"])


@router.post("/tenants", response_model=TenantDetailResponse, status_code=status.HTTP_201_CREATED)
async def provision_tenant(
    payload: TenantCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Platform Super-Admin Level 1: Provisions a new corporate client organization.
    Creates:
    1. Tenant record in fsm_system.tenants
    2. Primary Corporate HQ Branch in fsm_app.branches
    3. Root Tenant Administrator in fsm_app.employees
    4. Default Feature Entitlements in fsm_system.tenant_features
    5. White-Label Branding Profile in fsm_system.tenant_branding
    """
    # 1. Check slug uniqueness
    stmt = select(Tenant).where(Tenant.slug == payload.slug)
    existing_tenant = (await db.execute(stmt)).scalar_one_or_none()
    if existing_tenant:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tenant slug '{payload.slug}' is already registered."
        )

    # 2. Create Tenant
    tenant = Tenant(
        slug=payload.slug,
        legal_name=payload.legal_name,
        trade_name=payload.trade_name or payload.legal_name,
        subscription_tier=payload.subscription_tier,
        is_active=True,
    )
    db.add(tenant)
    await db.flush()

    # 3. Create Primary HQ Branch
    hq_branch = Branch(
        tenant_id=tenant.id,
        name=payload.primary_branch_name,
        branch_code=f"HQ-{payload.slug.upper()[:10]}",
        city=payload.primary_branch_city,
        is_head_office=True,
        is_active=True,
    )
    db.add(hq_branch)
    await db.flush()

    # 4. Create Root Tenant Administrator
    root_admin = Employee(
        tenant_id=tenant.id,
        branch_id=hq_branch.id,
        is_tenant_root_admin=True,
        email=payload.admin_email,
        password_hash=AuthService.hash_password(payload.admin_password),
        first_name=payload.admin_first_name,
        last_name=payload.admin_last_name,
        role=EmployeeRole.ADMIN.value,
        rank="Executive Director",
        territory="National Corporate Headquarters",
        is_active=True,
        metadata_json={"provisioned_by": "platform_super_admin"}
    )
    db.add(root_admin)
    await db.flush()

    # 5. Provision Default Features
    default_feature_keys = [
        "attendance", "field_visits", "leaves", "tasks",
        "expenses", "analytics", "monthly_targets",
        "revenue_leakage", "lead_management", "followups"
    ]
    feature_items = []
    for f_key in default_feature_keys:
        tf = TenantFeature(tenant_id=tenant.id, feature_key=f_key, is_enabled=True)
        db.add(tf)
        feature_items.append(TenantFeatureItem(feature_key=f_key, is_enabled=True))

    # 6. Provision White-Label Branding
    branding = TenantBranding(
        tenant_id=tenant.id,
        brand_name=payload.trade_name or payload.legal_name,
        primary_color=payload.primary_color or "#00897B",
        terminology_mapping=payload.terminology_mapping or {"target": "Doctor", "visit": "DCR Call"},
    )
    db.add(branding)

    await db.commit()
    await db.refresh(tenant)

    return TenantDetailResponse(
        id=tenant.id,
        slug=tenant.slug,
        legal_name=tenant.legal_name,
        trade_name=tenant.trade_name,
        subscription_tier=tenant.subscription_tier,
        is_active=tenant.is_active,
        created_at=tenant.created_at,
        branding=TenantBrandingResponse(
            brand_name=branding.brand_name,
            logo_url=branding.logo_url,
            primary_color=branding.primary_color,
            terminology_mapping=branding.terminology_mapping,
        ),
        features=feature_items,
        branches=[
            BranchResponse(
                id=hq_branch.id,
                tenant_id=hq_branch.tenant_id,
                name=hq_branch.name,
                branch_code=hq_branch.branch_code,
                city=hq_branch.city,
                is_head_office=hq_branch.is_head_office,
                is_active=hq_branch.is_active,
                created_at=hq_branch.created_at,
            )
        ],
        root_admin_id=root_admin.id,
    )


@router.post("/tenants/{tenant_id}/branches", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
async def attach_branch(
    tenant_id: uuid.UUID,
    payload: BranchCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Platform Super-Admin Level 1: Attaches a new regional branch under an existing corporate tenant.
    Never forks an existing client into a disconnected tenant.
    """
    stmt = select(Tenant).where(Tenant.id == tenant_id, Tenant.is_active.is_(True))
    tenant = (await db.execute(stmt)).scalar_one_or_none()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Corporate tenant not found or inactive."
        )

    # Check branch code uniqueness within tenant
    code_stmt = select(Branch).where(Branch.tenant_id == tenant_id, Branch.branch_code == payload.branch_code)
    existing_branch = (await db.execute(code_stmt)).scalar_one_or_none()
    if existing_branch:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Branch code '{payload.branch_code}' already exists under tenant '{tenant.slug}'."
        )

    branch = Branch(
        tenant_id=tenant_id,
        name=payload.name,
        branch_code=payload.branch_code,
        city=payload.city,
        is_head_office=payload.is_head_office,
        is_active=True,
    )
    db.add(branch)
    await db.commit()
    await db.refresh(branch)

    return BranchResponse.model_validate(branch)


@router.get("/tenants", response_model=List[TenantResponse])
async def list_tenants(db: AsyncSession = Depends(get_db)):
    """Lists all corporate client organizations."""
    stmt = select(Tenant).order_by(Tenant.created_at.desc())
    result = await db.execute(stmt)
    return [TenantResponse.model_validate(t) for t in result.scalars().all()]


@router.get("/tenants/{tenant_id}", response_model=TenantDetailResponse)
async def get_tenant_detail(tenant_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Fetches complete tenant profile with branches, feature entitlements, and branding."""
    stmt = (
        select(Tenant)
        .options(
            selectinload(Tenant.features),
            selectinload(Tenant.branding),
        )
        .where(Tenant.id == tenant_id)
    )
    result = await db.execute(stmt)
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    branch_stmt = select(Branch).where(Branch.tenant_id == tenant_id).order_by(Branch.created_at)
    branches = (await db.execute(branch_stmt)).scalars().all()

    return TenantDetailResponse(
        id=tenant.id,
        slug=tenant.slug,
        legal_name=tenant.legal_name,
        trade_name=tenant.trade_name,
        subscription_tier=tenant.subscription_tier,
        is_active=tenant.is_active,
        created_at=tenant.created_at,
        branding=TenantBrandingResponse.model_validate(tenant.branding) if tenant.branding else None,
        features=[TenantFeatureItem(feature_key=f.feature_key, is_enabled=f.is_enabled) for f in tenant.features],
        branches=[BranchResponse.model_validate(b) for b in branches],
    )
