from __future__ import annotations

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
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr

from app.config import get_settings
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin

# Import Canonical Unified Models from Lead Management, Follow-ups, and Master Customer
from app.lead_management.models import Lead, LeadCustomer
from app.followups.models import Followup as FollowUp
from app.models.customer import Customer


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
        ForeignKey(f"{get_settings().tables.leads}.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    followup_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.followups}.id", ondelete="SET NULL"),
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


__all__ = [
    "Customer",
    "Lead",
    "LeadCustomer",
    "FollowUp",
    "ActivityHistory",
    "MonthlyTarget",
]
