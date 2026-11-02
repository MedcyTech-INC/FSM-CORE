import enum
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import DateTime, String, Text, Boolean, ForeignKey, Index, CheckConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr

from app.config import get_settings
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class FollowupStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    # IMPORTANT: OVERDUE is a derived view (status == PENDING and due_at < now()), never saved in DB.


class FollowupActionType(str, enum.Enum):
    CALL = "Call"
    REVISIT = "Revisit"
    QUOTATION = "Quotation"
    DEMO = "Demo"
    DOCUMENTS = "Document Collection"
    PAYMENT = "Payment Reminder"
    OTHER = "Other"


class FollowupPriority(str, enum.Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class Followup(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Action / Next Steps Entity.
    Works with a Lead OR standalone for a Customer / FieldVisit.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.followups

    # Scoping
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Context Links (at least one must be non-null)
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.leads}.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    lead_customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.lead_customers}.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    field_visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.field_visits}.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    customer_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Action definition
    action_type: Mapped[str] = mapped_column(String(80), nullable=False, default=FollowupActionType.CALL.value)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(20), default=FollowupPriority.MEDIUM.value, nullable=False, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Status & Outcomes
    status: Mapped[str] = mapped_column(String(30), default=FollowupStatus.PENDING.value, nullable=False, index=True)
    outcome: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cancel_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    # Relationships
    employee = relationship("Employee", foreign_keys=[employee_id])
    creator = relationship("Employee", foreign_keys=[created_by_id])
    lead = relationship("Lead", foreign_keys=[lead_id])
    customer = relationship("LeadCustomer", foreign_keys=[lead_customer_id])
    field_visit = relationship("FieldVisit", foreign_keys=[field_visit_id])
    history = relationship(
        "FollowupHistory",
        back_populates="followup",
        cascade="all, delete-orphan",
        order_by="FollowupHistory.occurred_at.asc()"
    )

    __table_args__ = (
        CheckConstraint(
            "lead_id IS NOT NULL OR lead_customer_id IS NOT NULL OR field_visit_id IS NOT NULL",
            name="chk_followup_has_context"
        ),
        Index("ix_followups_emp_status_due", "employee_id", "status", "due_at"),
    )

    @property
    def is_overdue(self) -> bool:
        """Derived property: true if pending and due time has passed."""
        if self.status != FollowupStatus.PENDING.value:
            return False
        return self.due_at < datetime.now(timezone.utc)


class FollowupHistory(Base, UUIDPrimaryKeyMixin):
    """
    Immutable audit history trail for Follow-ups.
    Tracks completions, reschedules (with old/new dates), cancellations, and reassignments.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.followup_history

    followup_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.followups}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)  # CREATED, COMPLETED, RESCHEDULED, CANCELLED, REASSIGNED
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        nullable=False,
        index=True
    )

    followup = relationship("Followup", back_populates="history")
    actor = relationship("Employee", foreign_keys=[actor_id])

    __table_args__ = (
        Index("ix_followup_history_time", "followup_id", "occurred_at"),
    )
