import uuid
from datetime import date, datetime, timezone
from typing import Optional, List
from sqlalchemy import (
    String,
    Boolean,
    Float,
    Integer,
    Date,
    DateTime,
    Text,
    ForeignKey,
    Index,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr

from app.config import get_settings
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class Customer(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Universal Customer Directory entity (fsm_customers).
    Stores doctor, clinic, hospital, chemist, distributor, or facility master info.
    Dynamically resolved via TableRegistry.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.customers

    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    customer_type: Mapped[str] = mapped_column(String(50), default="Doctor", nullable=False, index=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    location_city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    location_area: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    territory: Mapped[Optional[str]] = mapped_column(String(150), nullable=True, index=True)

    # Spatial coordinates for optional geocoding / routing
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    __table_args__ = {"extend_existing": True}

    # Relationships
    leads: Mapped[List["Lead"]] = relationship("Lead", back_populates="customer")
    followups: Mapped[List["FollowUp"]] = relationship("FollowUp", back_populates="customer")


class Lead(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Commercial Opportunity entity (fsm_leads).
    Dynamically resolved via TableRegistry.
    Primary system of record for sales deals, stages, and expected values.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.fsm_leads

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="RESTRICT"),
        nullable=False
    )
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.customers}.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    customer_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    customer_type: Mapped[str] = mapped_column(String(50), default="Doctor", nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    opportunity_type: Mapped[str] = mapped_column(String(80), default="Hospital service", nullable=False)
    interested_product_service: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    customer_response: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    lead_source: Mapped[str] = mapped_column(String(80), default="Doctor Visit", nullable=False)

    stage: Mapped[str] = mapped_column(
        String(50),
        default="NEW",
        nullable=False,
        index=True
    )
    priority: Mapped[str] = mapped_column(
        String(20),
        default="MEDIUM",
        nullable=False,
        index=True
    )

    expected_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    actual_converted_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    expected_close_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    location_city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Spatial coordinates for route optimization
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_interaction_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=True
    )
    conversion_outcome: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    loss_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    field_visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.field_visits}.id", ondelete="SET NULL"),
        nullable=True
    )
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    # Relationships
    customer: Mapped[Optional["Customer"]] = relationship("Customer", back_populates="leads")
    followups: Mapped[List["FollowUp"]] = relationship("FollowUp", back_populates="lead")

    __table_args__ = (
        CheckConstraint(
            "stage IN ('NEW', 'CONTACTED', 'INTERESTED', 'QUALIFIED', 'CONVERTED', 'LOST')",
            name="chk_fsm_lead_stage"
        ),
        CheckConstraint(
            "priority IN ('HIGH', 'MEDIUM', 'LOW')",
            name="chk_fsm_lead_priority"
        ),
        Index("ix_fsm_leads_emp_stage", "employee_id", "stage"),
        {"extend_existing": True},
    )


class FollowUp(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Actionable Commitment / Callback entity (fsm_followups).
    Supports standalone follow-ups anchored by lead_id, customer_id, or field_visit_id.
    Dynamically resolved via TableRegistry.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.fsm_followups

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="RESTRICT"),
        nullable=False
    )
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.fsm_leads}.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.customers}.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    field_visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.field_visits}.id", ondelete="SET NULL"),
        nullable=True
    )
    customer_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    action_type: Mapped[str] = mapped_column(String(80), default="Call", nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(20), default="MEDIUM", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False, index=True)
    outcome: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cancel_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    # Relationships
    lead: Mapped[Optional["Lead"]] = relationship("Lead", back_populates="followups")
    customer: Mapped[Optional["Customer"]] = relationship("Customer", back_populates="followups")

    __table_args__ = (
        CheckConstraint(
            "priority IN ('HIGH', 'MEDIUM', 'LOW')",
            name="chk_fsm_followup_priority"
        ),
        CheckConstraint(
            "status IN ('PENDING', 'COMPLETED', 'CANCELLED')",
            name="chk_fsm_followup_status"
        ),
        CheckConstraint(
            "lead_id IS NOT NULL OR customer_id IS NOT NULL OR field_visit_id IS NOT NULL",
            name="chk_fsm_followup_anchor"
        ),
        Index("ix_fsm_followups_emp_status_due", "employee_id", "status", "due_at"),
        {"extend_existing": True},
    )


class ActivityHistory(Base, UUIDPrimaryKeyMixin):
    """
    Unified Activity History Timeline (fsm_activity_history).
    Dynamically resolved via TableRegistry.
    Captures stage changes, follow-up completions, and visit outcomes.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.activity_history

    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.fsm_leads}.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    followup_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.fsm_followups}.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.customers}.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    actor_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    activity_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )

    __table_args__ = {"extend_existing": True}


class MonthlyTarget(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Monthly Sales Target Quota entity (monthly_targets).
    Dynamically resolved via TableRegistry.
    Used for employee pacing heuristic calculations in Daily Sales Planning.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.monthly_targets

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    target_month: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    target_revenue: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    achieved_revenue: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    target_visits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    achieved_visits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE", nullable=False)

    __table_args__ = (
        Index("ix_monthly_targets_emp_month", "employee_id", "target_month", unique=True),
        {"extend_existing": True},
    )

