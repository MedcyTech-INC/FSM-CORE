import uuid
from typing import Optional
from sqlalchemy import String, Boolean, Float, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class Customer(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Canonical Unified Customer Master.
    Harmonizes doctors, chemists, clinics, farmers, and facilities across CRM, route planning, and detailing.
    """
    __tablename__ = "customers"
    __table_args__ = (
        Index("ix_customers_tenant_type", "tenant_id", "customer_type"),
        Index("ix_customers_tenant_branch", "tenant_id", "branch_id"),
        Index("ix_customers_tenant_active", "tenant_id", "is_active"),
        {"schema": "fsm_app"},
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fsm_system.tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    branch_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fsm_app.branches.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_type: Mapped[str] = mapped_column(String(50), default="Doctor", nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    location_city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant")
    branch: Mapped[Optional["Branch"]] = relationship("Branch")
