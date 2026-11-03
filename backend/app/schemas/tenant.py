import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr


class BranchCreateRequest(BaseModel):
    name: str = Field(..., max_length=150, description="Branch display name")
    branch_code: str = Field(..., max_length=50, description="Unique branch code within tenant")
    city: str = Field(..., max_length=100, description="Branch city")
    is_head_office: bool = Field(default=False, description="Is this branch the corporate HQ?")


class BranchResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    branch_code: str
    city: str
    is_head_office: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TenantBrandingResponse(BaseModel):
    brand_name: str
    logo_url: Optional[str] = None
    primary_color: str = "#00897B"
    terminology_mapping: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class TenantFeatureItem(BaseModel):
    feature_key: str
    is_enabled: bool


class TenantCreateRequest(BaseModel):
    legal_name: str = Field(..., max_length=255, description="Registered legal company name")
    slug: str = Field(..., max_length=63, pattern=r"^[a-z0-9][a-z0-9\-]{1,61}[a-z0-9]$", description="URL-safe unique identifier")
    trade_name: Optional[str] = Field(None, max_length=255, description="Commercial trading brand name")
    subscription_tier: str = Field(default="standard", description="Subscription level")
    admin_email: EmailStr = Field(..., description="Root administrator email")
    admin_password: str = Field(..., min_length=8, description="Root administrator initial password")
    admin_first_name: str = Field(default="System", max_length=100)
    admin_last_name: str = Field(default="Administrator", max_length=100)
    primary_branch_name: str = Field(default="Corporate Headquarters", max_length=150)
    primary_branch_city: str = Field(default="Mumbai", max_length=100)
    primary_color: Optional[str] = Field(default="#00897B")
    terminology_mapping: Optional[Dict[str, Any]] = None


class TenantResponse(BaseModel):
    id: uuid.UUID
    slug: str
    legal_name: str
    trade_name: Optional[str] = None
    subscription_tier: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TenantDetailResponse(TenantResponse):
    branding: Optional[TenantBrandingResponse] = None
    features: List[TenantFeatureItem] = Field(default_factory=list)
    branches: List[BranchResponse] = Field(default_factory=list)
    root_admin_id: Optional[uuid.UUID] = None
