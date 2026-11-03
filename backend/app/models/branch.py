import uuid
from typing import List, Optional
from sqlalchemy import String, Boolean, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class Branch(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Operational branch / regional division under a corporate tenant.
    Owns local office geofences, local reporting hierarchies, and regional quotas.
    """
    __tablename__ = "branches"
    __table_args__ = (
        Index("uq_branches_tenant_code", "tenant_id", "branch_code", unique=True),
        Index("ix_branches_tenant_active", "tenant_id", "is_active"),
        {"schema": "fsm_app"},
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fsm_system.tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    branch_code: Mapped[str] = mapped_column(String(50), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    is_head_office: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant")
    employees: Mapped[List["Employee"]] = relationship("Employee", back_populates="branch")
