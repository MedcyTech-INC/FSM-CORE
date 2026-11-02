import enum
import uuid
from typing import Optional, List
from sqlalchemy import String, Boolean, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr
from app.config import get_settings
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class EmployeeRole(str, enum.Enum):
    ADMIN = "ADMIN"
    GM = "GM"      # General Manager
    ZSM = "ZSM"    # Zonal Sales Manager
    RSM = "RSM"    # Regional Sales Manager
    MR = "MR"      # Medical Representative / Field Officer / Field Executive
    FINANCE = "FINANCE"  # Finance & Accounts / Disbursement Officer


class Employee(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Universal workforce identity entity.
    Table name is resolved dynamically from TableRegistry (no hardcoding).
    Supports hierarchical reporting structures via self-referential reporting_to.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.employees

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    
    role: Mapped[str] = mapped_column(String(50), default=EmployeeRole.MR.value, nullable=False, index=True)
    rank: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    territory: Mapped[Optional[str]] = mapped_column(String(150), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    # Hierarchical tree: Self-referential reporting_to
    reporting_to_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Extensible metadata for multi-vertical attributes (e.g. employee code, department, territory polygon)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict, nullable=True)

    # Relationships
    reporting_to: Mapped[Optional["Employee"]] = relationship(
        "Employee",
        remote_side="Employee.id",
        back_populates="subordinates"
    )
    subordinates: Mapped[List["Employee"]] = relationship(
        "Employee",
        back_populates="reporting_to"
    )

    __table_args__ = (
        Index("ix_employees_active_role", "is_active", "role"),
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
