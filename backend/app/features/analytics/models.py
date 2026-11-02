import uuid
from datetime import date
from typing import Optional
from sqlalchemy import Date, Float, Integer, String, Numeric, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, declared_attr
from app.config import get_settings
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class AnalyticsDailySummary(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Pre-aggregated daily operational and financial metrics.
    Eliminates expensive full-table scans over millions of raw attendance,
    visit, and expense rows for executive dashboards.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.analytics_daily_summary

    summary_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    zone: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    completed_calls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_target_calls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    strike_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    expense_burn: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    pipeline_value: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0, nullable=False)

    __table_args__ = (
        UniqueConstraint("summary_date", "zone", "employee_id", name="uq_analytics_summary_date_zone_emp"),
        Index("idx_analytics_date_zone", "summary_date", "zone"),
    )


class Lead(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Commercial pipeline leads for conversion funnel tracking.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.leads

    assigned_employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    zone: Mapped[str] = mapped_column(String(100), default="North Zone", nullable=False)
    client_name: Mapped[str] = mapped_column(String(200), nullable=False)
    stage: Mapped[str] = mapped_column(String(50), default="DISCOVERY", nullable=False)  # DISCOVERY, CONTACTED, SAMPLING, COMMITMENT, CLOSED_WON
    expected_value: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
