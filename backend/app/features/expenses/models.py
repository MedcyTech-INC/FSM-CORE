import uuid
import enum
from datetime import date, datetime
from typing import Optional, List, Any
from sqlalchemy import Date, DateTime, Float, String, Text, Boolean, ForeignKey, Index, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr
from app.config import get_settings
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class ExpenseCategory(str, enum.Enum):
    FUEL = "fuel"
    TRAVEL_TICKET = "travel_ticket"
    FOOD_ALLOWANCE = "food_allowance"
    ACCOMMODATION = "accommodation"
    TOLL_PARKING = "toll_parking"
    CLIENT_ENTERTAINMENT = "client_entertainment"
    MISCELLANEOUS = "miscellaneous"


class ExpenseStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    SENT_BACK = "sent_back"
    PENDING_ZSM_APPROVAL = "pending_zsm_approval"
    MANAGER_APPROVED = "manager_approved"
    ZSM_APPROVED = "zsm_approved"
    FINANCE_VERIFIED = "finance_verified"
    APPROVED = "approved"       # Preserved for backward compatibility
    REIMBURSED = "reimbursed"   # Paid
    REJECTED = "rejected"


class ExpenseValidationStatus(str, enum.Enum):
    PASSED = "passed"
    FLAGGED = "flagged"
    SUSPICIOUS = "suspicious"


class Expense(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Field Expense Claim with forensic watermarking, anti-fraud telemetry checks,
    and split-bill reconciliation.
    Table name dynamically resolved from TableRegistry.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.expenses

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    field_session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.field_sessions}.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    category: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    claim_date: Mapped[date] = mapped_column(Date, nullable=False)

    receipt_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Split-bill metadata
    is_split_bill: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    split_with_employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="SET NULL"),
        nullable=True
    )
    receipt_invoice_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    total_receipt_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Automated validation & fraud checks
    image_sha256: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    validation_status: Mapped[str] = mapped_column(String(50), default=ExpenseValidationStatus.PASSED.value, nullable=False)
    validation_flags: Mapped[List[Any]] = mapped_column(JSON, default=list, nullable=False)

    # Approval & reimbursement workflow
    status: Mapped[str] = mapped_column(String(50), default=ExpenseStatus.SUBMITTED.value, nullable=False, index=True)
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="SET NULL"),
        nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reimbursed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Multi-tier hierarchical audit fields
    manager_reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="SET NULL"),
        nullable=True
    )
    manager_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    manager_review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    zsm_reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="SET NULL"),
        nullable=True
    )
    zsm_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    zsm_review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    finance_reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="SET NULL"),
        nullable=True
    )
    finance_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finance_review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payment_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", foreign_keys=[employee_id])
    split_with_employee: Mapped[Optional["Employee"]] = relationship("Employee", foreign_keys=[split_with_employee_id])
    reviewer: Mapped[Optional["Employee"]] = relationship("Employee", foreign_keys=[reviewed_by])
    manager_reviewer: Mapped[Optional["Employee"]] = relationship("Employee", foreign_keys=[manager_reviewed_by])
    zsm_reviewer: Mapped[Optional["Employee"]] = relationship("Employee", foreign_keys=[zsm_reviewed_by])
    finance_reviewer: Mapped[Optional["Employee"]] = relationship("Employee", foreign_keys=[finance_reviewed_by])
    session: Mapped[Optional["FieldSession"]] = relationship("FieldSession", foreign_keys=[field_session_id])

    __table_args__ = (
        Index("idx_expenses_emp_date", "employee_id", "claim_date"),
        Index("idx_expenses_status", "status"),
        Index("idx_expenses_invoice", "receipt_invoice_number", "claim_date"),
        Index("idx_expenses_sha", "image_sha256"),
    )
