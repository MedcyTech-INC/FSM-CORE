import enum
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
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
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin

SCHEMA = "fsm_app"
PREFIX = "fsm_revenue_leakage_"


# ==============================================================================
# Enums
# ==============================================================================

class RuleCode(str, enum.Enum):
    UNVISITED_CLIENT = "unvisited_client"
    ABANDONED_LEAD = "abandoned_lead"
    DECLINING_FREQUENCY = "declining_frequency"
    INACTIVE_OPPORTUNITY = "inactive_opportunity"
    UNDERPERFORMING_TERRITORY = "underperforming_territory"


class Classification(str, enum.Enum):
    OPERATIONAL_WARNING = "operational_warning"
    POTENTIAL_EXPOSURE = "potential_exposure"
    CONFIRMED_COMMERCIAL_LOSS = "confirmed_commercial_loss"
    VERIFIED_FINANCIAL_DISCREPANCY = "verified_financial_discrepancy"


class AttentionPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class AlertStatus(str, enum.Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class ActionType(str, enum.Enum):
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"
    NOTE = "note"
    ESCALATED = "escalated"
    AUTO_CLEARED = "auto_cleared"


class Outcome(str, enum.Enum):
    NORMAL_VARIATION = "normal_variation"
    INVESTIGATION_NEEDED = "investigation_needed"
    CORRECTIVE_ACTION_TAKEN = "corrective_action_taken"
    COMMERCIAL_OUTCOME_EVIDENCED = "commercial_outcome_evidenced"
    CONDITION_CLEARED = "condition_cleared"


class ObservationReason(str, enum.Enum):
    CREATED = "created"
    PRIORITY_CHANGED = "priority_changed"
    VALUE_CHANGED = "value_changed"
    RESOLVED = "resolved"
    SUPPRESSED_RECURRENCE = "suppressed_recurrence"


class ScanStatus(str, enum.Enum):
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    PARTIAL = "partial"
    SKIPPED_SOURCE_MISSING = "skipped_source_missing"


class ScanMode(str, enum.Enum):
    BASELINE = "baseline"
    NORMAL = "normal"


class NotificationKind(str, enum.Enum):
    CREATED = "created"
    PRIORITY_RAISED = "priority_raised"
    ESCALATED = "escalated"


# ==============================================================================
# Models
# ==============================================================================

class LeakageRule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = f"{PREFIX}rules"
    __table_args__ = ({"schema": SCHEMA},)

    rule_code: Mapped[str] = mapped_column(
        SAEnum(RuleCode, name="rule_code", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        unique=True,
        nullable=False,
    )
    rule_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    threshold_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    threshold_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    medium_priority_ratio: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("1.50"), nullable=False)
    high_priority_ratio: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("2.00"), nullable=False)
    change_ratio: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.10"), nullable=False)
    cooldown_days: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    dismiss_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    autoclear_scans: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    escalation_days: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    min_history_months: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    params: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    required_sources: Mapped[List[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    changes: Mapped[List["RuleChange"]] = relationship(
        "RuleChange", back_populates="rule", cascade="all, delete-orphan", lazy="selectin"
    )


class RuleChange(Base, UUIDPrimaryKeyMixin):
    __tablename__ = f"{PREFIX}rule_changes"
    __table_args__ = (
        Index("ix_rule_changes_rule_time", "rule_id", "changed_at"),
        {"schema": SCHEMA},
    )

    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.{PREFIX}rules.id", ondelete="RESTRICT"), nullable=False
    )
    field: Mapped[str] = mapped_column(String(50), nullable=False)
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    changed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    rule: Mapped["LeakageRule"] = relationship("LeakageRule", back_populates="changes")


class LeakageAlert(Base, UUIDPrimaryKeyMixin):
    __tablename__ = f"{PREFIX}alerts"
    __table_args__ = (
        Index(
            "uq_active_leakage_alert",
            "rule_id",
            "entity_type",
            "entity_id",
            unique=True,
            postgresql_where=text("status IN ('active', 'acknowledged')"),
        ),
        Index("ix_leakage_alerts_status_prio", "status", "attention_priority"),
        Index("ix_leakage_alerts_entity", "entity_type", "entity_id"),
        Index("ix_leakage_alerts_previous", "previous_alert_id"),
        {"schema": SCHEMA},
    )

    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.{PREFIX}rules.id", ondelete="RESTRICT"), nullable=False
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'customer', 'lead', 'territory'
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    classification: Mapped[str] = mapped_column(
        SAEnum(Classification, name="classification", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        default=Classification.OPERATIONAL_WARNING.value,
        nullable=False,
    )
    attention_priority: Mapped[str] = mapped_column(
        SAEnum(AttentionPriority, name="attention_priority", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    priority_reason: Mapped[str] = mapped_column(String(500), nullable=False)
    observation: Mapped[dict] = mapped_column(JSONB, nullable=False)
    exposure_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    exposure_basis: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(
        SAEnum(AlertStatus, name="alert_status", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        default=AlertStatus.ACTIVE.value,
        nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    occurrence_no: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    previous_alert_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    first_detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    last_observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    last_notified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    clear_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    suppressed_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    escalation_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    escalated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    rule: Mapped["LeakageRule"] = relationship("LeakageRule")
    actions: Mapped[List["AlertAction"]] = relationship(
        "AlertAction", back_populates="alert", cascade="all, delete-orphan", lazy="selectin"
    )
    observations: Mapped[List["AlertObservation"]] = relationship(
        "AlertObservation", back_populates="alert", cascade="all, delete-orphan", lazy="selectin"
    )


class AlertAction(Base, UUIDPrimaryKeyMixin):
    __tablename__ = f"{PREFIX}alert_actions"
    __table_args__ = (
        Index(
            "uq_alert_action_idemp",
            "alert_id",
            "idempotency_key",
            unique=True,
            postgresql_where=text("idempotency_key IS NOT NULL"),
        ),
        Index("ix_alert_actions_alert_created", "alert_id", "created_at"),
        {"schema": SCHEMA},
    )

    alert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.{PREFIX}alerts.id", ondelete="RESTRICT"), nullable=False
    )
    action_type: Mapped[str] = mapped_column(
        SAEnum(ActionType, name="action_type", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    outcome: Mapped[Optional[str]] = mapped_column(
        SAEnum(Outcome, name="outcome", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        nullable=True,
    )
    action_taken: Mapped[str] = mapped_column(String(255), nullable=False)
    evidence_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    action_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    alert: Mapped["LeakageAlert"] = relationship("LeakageAlert", back_populates="actions")


class AlertObservation(Base, UUIDPrimaryKeyMixin):
    __tablename__ = f"{PREFIX}alert_observations"
    __table_args__ = (
        Index("ix_alert_obs_alert_time", "alert_id", "observed_at"),
        {"schema": SCHEMA},
    )

    alert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.{PREFIX}alerts.id", ondelete="CASCADE"), nullable=False
    )
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    observation: Mapped[dict] = mapped_column(JSONB, nullable=False)
    attention_priority: Mapped[str] = mapped_column(
        SAEnum(AttentionPriority, name="attention_priority", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(
        SAEnum(ObservationReason, name="observation_reason", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )

    alert: Mapped["LeakageAlert"] = relationship("LeakageAlert", back_populates="observations")


class AlertChain(Base):
    __tablename__ = f"{PREFIX}alert_chains"
    __table_args__ = ({"schema": SCHEMA},)

    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.{PREFIX}rules.id", ondelete="RESTRICT"), primary_key=True
    )
    entity_type: Mapped[str] = mapped_column(String(50), primary_key=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    last_alert_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    last_occurrence_no: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    suppressed_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class ScanRun(Base, UUIDPrimaryKeyMixin):
    __tablename__ = f"{PREFIX}scan_runs"
    __table_args__ = (
        Index("ix_scan_runs_rule_started", "rule_code", "started_at"),
        {"schema": SCHEMA},
    )

    rule_code: Mapped[str] = mapped_column(
        SAEnum(RuleCode, name="rule_code", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    mode: Mapped[str] = mapped_column(
        SAEnum(ScanMode, name="scan_mode", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        default=ScanMode.NORMAL.value,
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    heartbeat_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(
        SAEnum(ScanStatus, name="scan_status", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        default=ScanStatus.RUNNING.value,
        nullable=False,
    )
    rows_evaluated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    alerts_created: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    alerts_updated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    alerts_cleared: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    skipped_not_synced: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    attempt: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)


class SourceAvailability(Base):
    __tablename__ = f"{PREFIX}source_availability"
    __table_args__ = ({"schema": SCHEMA},)

    source_key: Mapped[str] = mapped_column(String(50), primary_key=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class UserSyncState(Base):
    __tablename__ = f"{PREFIX}user_sync_state"
    __table_args__ = ({"schema": SCHEMA},)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    last_synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class AlertNotification(Base, UUIDPrimaryKeyMixin):
    __tablename__ = f"{PREFIX}alert_notifications"
    __table_args__ = (
        UniqueConstraint("alert_id", "recipient_id", "kind", "attention_priority", name="uq_alert_notification"),
        Index("ix_alert_notifications_pending", "status", "created_at"),
        {"schema": SCHEMA},
    )

    alert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.{PREFIX}alerts.id", ondelete="CASCADE"), nullable=False
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    kind: Mapped[str] = mapped_column(
        SAEnum(NotificationKind, name="notification_kind", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    attention_priority: Mapped[str] = mapped_column(
        SAEnum(AttentionPriority, name="attention_priority", schema=SCHEMA, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    digest_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class AlertView(Base, UUIDPrimaryKeyMixin):
    __tablename__ = f"{PREFIX}alert_views"
    __table_args__ = (
        Index("ix_alert_views_alert", "alert_id", "viewed_at"),
        {"schema": SCHEMA},
    )

    alert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.{PREFIX}alerts.id", ondelete="CASCADE"), nullable=False
    )
    viewer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    action: Mapped[str] = mapped_column(String(20), default="view", nullable=False)  # 'view', 'export'
    viewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
