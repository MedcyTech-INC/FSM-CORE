import uuid
from datetime import date, time, datetime
from typing import Optional, List
from sqlalchemy import (
    String,
    Boolean,
    Float,
    Integer,
    Date,
    Time,
    DateTime,
    Text,
    ForeignKey,
    Index,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr

from app.config import get_settings
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class DailySalesPlan(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Master Daily Sales Plan Itinerary.
    Dynamically resolved via TableRegistry.
    Acts as the ephemeral scheduling and recommendation layer.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.daily_sales_plans

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    plan_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    revision_type: Mapped[str] = mapped_column(String(50), default="AI_INITIAL", nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        default="DRAFT",
        nullable=False,
        index=True
    )  # DRAFT, PENDING_APPROVAL, APPROVED, IN_PROGRESS, COMPLETED, CONFLICT_DETECTED, SUPERSEDED

    total_planned_stops: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_planned_distance_meters: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_planned_duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    routing_engine: Mapped[str] = mapped_column(
        String(50),
        default="OSRM_NETWORK",
        nullable=False
    )  # OSRM_NETWORK or HAVERSINE_ESTIMATED

    idempotency_key: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False)

    approved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="SET NULL"),
        nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    items: Mapped[List["DailySalesPlanItem"]] = relationship(
        "DailySalesPlanItem",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="DailySalesPlanItem.sequence_order"
    )
    revisions: Mapped[List["DailySalesPlanRevision"]] = relationship(
        "DailySalesPlanRevision",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="DailySalesPlanRevision.version"
    )

    __table_args__ = (
        UniqueConstraint("employee_id", "plan_date", "version", name="uq_plan_emp_date_version"),
        Index("ix_plans_emp_date_status", "employee_id", "plan_date", "status"),
        {"extend_existing": True},
    )


class DailySalesPlanItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Ordered stop or time block within a daily sales plan.
    Supports physical customer stops, non-visit call blocks, and protected lunch breaks.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.daily_sales_plan_items

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.daily_sales_plans}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    sequence_order: Mapped[int] = mapped_column(Integer, nullable=False)
    activity_type: Mapped[str] = mapped_column(
        String(50),
        default="PHYSICAL_VISIT",
        nullable=False
    )  # PHYSICAL_VISIT, PHONE_CALL, ADMIN_DESK, LUNCH_BREAK

    planned_arrival_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    planned_departure_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    estimated_duration_minutes: Mapped[int] = mapped_column(Integer, default=20, nullable=False)

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

    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    location_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    stop_type: Mapped[str] = mapped_column(
        String(50),
        default="AI_RECOMMENDED",
        nullable=False
    )  # AI_RECOMMENDED, MANAGER_MANDATORY, TASK_VISIT

    recommendation_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    recommendation_reasons: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict, nullable=True)

    status: Mapped[str] = mapped_column(
        String(50),
        default="PENDING",
        nullable=False,
        index=True
    )  # PENDING, EN_ROUTE, ARRIVED, VISITED, SKIPPED, EXTERNALLY_RESOLVED, REASSIGNED

    field_visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.field_visits}.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    transit_distance_m: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    transit_duration_s: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    plan: Mapped["DailySalesPlan"] = relationship("DailySalesPlan", back_populates="items")
    obligations: Mapped[List["DailySalesPlanItemObligation"]] = relationship(
        "DailySalesPlanItemObligation",
        back_populates="plan_item",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("plan_id", "sequence_order", name="uq_item_plan_sequence"),
        Index("ix_plan_items_lead_status", "lead_id", "status"),
    )


class DailySalesPlanItemObligation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Multi-obligation junction table.
    Links one planned stop to 1..N distinct business records (Lead, Follow-up, or Manager Task).
    Maintains independent fulfillment states and prevents duplicate physical visits.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.daily_sales_plan_item_obligations

    plan_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.daily_sales_plan_items}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    obligation_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )  # LEAD_CONVERSION, FOLLOW_UP, MANAGER_TASK

    obligation_title: Mapped[str] = mapped_column(String(255), nullable=False)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Strongly-typed source foreign keys
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.leads}.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    follow_up_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.followups}.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    task_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.tasks}.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    # Independent fulfillment state per obligation
    fulfillment_status: Mapped[str] = mapped_column(
        String(50),
        default="PENDING",
        nullable=False,
        index=True
    )  # PENDING, FULFILLED, UNFULFILLED_RESCHEDULED, CANCELLED

    outcome_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fulfilled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rescheduled_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Relationships
    plan_item: Mapped["DailySalesPlanItem"] = relationship("DailySalesPlanItem", back_populates="obligations")

    __table_args__ = (
        CheckConstraint(
            "lead_id IS NOT NULL OR follow_up_id IS NOT NULL OR task_id IS NOT NULL",
            name="chk_obligation_source_anchor"
        ),
    )


class DailySalesPlanRevision(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Immutable historical audit snapshot.
    Stores previous plan versions when representative customizations or midday replans occur.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.daily_sales_plan_revisions

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.daily_sales_plans}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    revision_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )  # AI_INITIAL, REP_CUSTOMIZED, MIDDAY_REPLAN, MANAGER_MODIFIED

    plan_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="RESTRICT"),
        nullable=False
    )

    # Relationships
    plan: Mapped["DailySalesPlan"] = relationship("DailySalesPlan", back_populates="revisions")
