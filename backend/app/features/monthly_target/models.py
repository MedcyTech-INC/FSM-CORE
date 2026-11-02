import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin
from app.shared_contracts.enums import (
    MetricType,
    EntityType,
    TargetStatus,
    EntryType,
)

SCHEMA = "fsm_app"
PREFIX = "fsm_monthly_targets_"


class Target(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = f"{PREFIX}targets"
    __table_args__ = (
        Index("ix_targets_dates", "start_date", "end_date"),
        Index("ix_targets_metric", "metric_type"),
        Index("ix_targets_status", "status"),
        Index(
            "uq_targets_idempotency",
            "created_by",
            "idempotency_key",
            unique=True,
            postgresql_where=text("idempotency_key IS NOT NULL"),
        ),
        {"schema": SCHEMA},
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    metric_type: Mapped[str] = mapped_column(
        SAEnum(MetricType, name="metric_type", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    target_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        SAEnum(TargetStatus, name="target_status", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        default=TargetStatus.ACTIVE.value,
        nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    final_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    adjusted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    assignments: Mapped[List["TargetAssignment"]] = relationship(
        "TargetAssignment", back_populates="target", cascade="all, delete-orphan", lazy="selectin"
    )
    changes: Mapped[List["TargetChange"]] = relationship(
        "TargetChange", back_populates="target", cascade="all, delete-orphan", lazy="selectin"
    )


class TargetAssignment(Base, UUIDPrimaryKeyMixin):
    __tablename__ = f"{PREFIX}assignments"
    __table_args__ = (
        UniqueConstraint("target_id", "entity_type", "entity_id", name="uq_target_assignment"),
        Index("ix_target_assignments_entity", "entity_type", "entity_id"),
        Index("ix_target_assignments_target", "target_id"),
        {"schema": SCHEMA},
    )

    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.{PREFIX}targets.id", ondelete="RESTRICT"), nullable=False
    )
    entity_type: Mapped[str] = mapped_column(
        SAEnum(EntityType, name="entity_type", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    target: Mapped["Target"] = relationship("Target", back_populates="assignments")
    progress: Mapped[Optional["TargetProgress"]] = relationship(
        "TargetProgress", back_populates="assignment", uselist=False, cascade="all, delete-orphan", lazy="selectin"
    )


class TargetProgress(Base, UUIDPrimaryKeyMixin):
    __tablename__ = f"{PREFIX}progress"
    __table_args__ = (
        {"schema": SCHEMA},
    )

    assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.{PREFIX}assignments.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    current_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    last_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    assignment: Mapped["TargetAssignment"] = relationship("TargetAssignment", back_populates="progress")


class TargetProgressEntry(Base, UUIDPrimaryKeyMixin):
    __tablename__ = f"{PREFIX}progress_entries"
    __table_args__ = (
        UniqueConstraint("assignment_id", "source_event_id", "entry_type", name="uq_progress_entry"),
        Index("ix_progress_entries_assignment_date", "assignment_id", "business_date"),
        Index("ix_progress_entries_source_event", "source_event_id"),
        {"schema": SCHEMA},
    )

    assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.{PREFIX}assignments.id", ondelete="RESTRICT"), nullable=False
    )
    source_event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    source_event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entry_type: Mapped[str] = mapped_column(
        SAEnum(EntryType, name="entry_type", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    delta: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    contributor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    business_date: Mapped[date] = mapped_column(Date, nullable=False)
    excluded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    excluded_reason: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class TargetChange(Base, UUIDPrimaryKeyMixin):
    __tablename__ = f"{PREFIX}changes"
    __table_args__ = (
        Index("ix_target_changes_target_version", "target_id", "version"),
        {"schema": SCHEMA},
    )

    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.{PREFIX}targets.id", ondelete="RESTRICT"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    field: Mapped[str] = mapped_column(String(50), nullable=False)
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    changed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    target: Mapped["Target"] = relationship("Target", back_populates="changes")


class OrgMembershipHistory(Base, UUIDPrimaryKeyMixin):
    __tablename__ = f"{PREFIX}org_membership_history"
    __table_args__ = (
        Index("ix_org_membership_emp", "employee_id"),
        {"schema": SCHEMA},
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    territory_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    effective_to: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class EventOutbox(Base):
    __tablename__ = f"{PREFIX}event_outbox"
    __table_args__ = (
        Index("ix_outbox_unprocessed", "created_at", postgresql_where=text("processed_at IS NULL")),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    event_version: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class ProcessedEvent(Base):
    __tablename__ = f"{PREFIX}processed_events"
    __table_args__ = ({"schema": SCHEMA},)

    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class FailedEvent(Base, UUIDPrimaryKeyMixin):
    __tablename__ = f"{PREFIX}failed_events"
    __table_args__ = ({"schema": SCHEMA},)

    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    event_version: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class MetricDefinition(Base):
    __tablename__ = f"{PREFIX}metric_definitions"
    __table_args__ = ({"schema": SCHEMA},)

    metric_type: Mapped[str] = mapped_column(
        SAEnum(MetricType, name="metric_type", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        primary_key=True,
    )
    source_event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    counts_what: Mapped[str] = mapped_column(Text, nullable=False)
    date_field: Mapped[str] = mapped_column(String(50), nullable=False)
    dedupe_rule: Mapped[str] = mapped_column(Text, nullable=False)
    is_integer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Holiday(Base):
    __tablename__ = "holidays"
    __table_args__ = ({"schema": SCHEMA},)

    holiday_date: Mapped[date] = mapped_column(Date, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    region: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class ReconciliationRun(Base, UUIDPrimaryKeyMixin):
    __tablename__ = f"{PREFIX}reconciliation_runs"
    __table_args__ = ({"schema": SCHEMA},)

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="running", nullable=False)
    targets_checked: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    drifts_found: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class ReconciliationDrift(Base, UUIDPrimaryKeyMixin):
    __tablename__ = f"{PREFIX}reconciliation_drifts"
    __table_args__ = ({"schema": SCHEMA},)

    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.{PREFIX}reconciliation_runs.id", ondelete="CASCADE"), nullable=False
    )
    assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.{PREFIX}assignments.id", ondelete="CASCADE"), nullable=False
    )
    stored_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    recomputed_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    source_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class ArchivedTotal(Base):
    __tablename__ = f"{PREFIX}archived_totals"
    __table_args__ = ({"schema": SCHEMA},)

    assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.{PREFIX}assignments.id", ondelete="CASCADE"), primary_key=True
    )
    entry_count: Mapped[int] = mapped_column(Integer, nullable=False)
    entry_sum: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    archived_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
