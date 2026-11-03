import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy import String, Boolean, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class Tenant(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Corporate B2B Paying Tenant.
    Houses subscription tier, status, branding, and features in the control plane.
    """
    __tablename__ = "tenants"
    __table_args__ = {"schema": "fsm_system"}

    slug: Mapped[str] = mapped_column(String(63), unique=True, nullable=False, index=True)
    legal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    trade_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    subscription_tier: Mapped[str] = mapped_column(String(50), default="standard", nullable=False)

    # Relationships
    features: Mapped[List["TenantFeature"]] = relationship("TenantFeature", back_populates="tenant", cascade="all, delete-orphan")
    branding: Mapped[Optional["TenantBranding"]] = relationship("TenantBranding", back_populates="tenant", uselist=False, cascade="all, delete-orphan")


class TenantFeature(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Granular feature toggle entitlement per tenant.
    """
    __tablename__ = "tenant_features"
    __table_args__ = (
        Index("uq_tenant_feature", "tenant_id", "feature_key", unique=True),
        {"schema": "fsm_system"},
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fsm_system.tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    feature_key: Mapped[str] = mapped_column(String(50), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="features")


class TenantBranding(Base, TimestampMixin):
    """
    White-label branding and UI vocabulary mappings per tenant.
    """
    __tablename__ = "tenant_branding"
    __table_args__ = {"schema": "fsm_system"}

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fsm_system.tenants.id", ondelete="CASCADE"),
        primary_key=True,
    )
    brand_name: Mapped[str] = mapped_column(String(100), nullable=False)
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    primary_color: Mapped[str] = mapped_column(String(20), default="#00897B", nullable=False)
    terminology_mapping: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        default=lambda: {"target": "Doctor", "visit": "DCR Call"},
        nullable=False
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="branding")
