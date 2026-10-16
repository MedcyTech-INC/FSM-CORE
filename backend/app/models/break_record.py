import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Integer, String, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr
from app.config import get_settings
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class BreakRecord(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Work pause and resumption intervals.
    Table name dynamically resolved from TableRegistry.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.breaks

    attendance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.attendance}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    attendance: Mapped["Attendance"] = relationship("Attendance", back_populates="breaks")
    employee: Mapped["Employee"] = relationship("Employee")

    __table_args__ = (
        Index("ix_breaks_active", "employee_id", "end_time"),
    )
