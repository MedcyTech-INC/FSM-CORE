import uuid
import enum
from datetime import date, datetime
from typing import Optional, List
from sqlalchemy import Date, DateTime, Float, Integer, String, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr
from app.config import get_settings
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class AttendanceStatus(str, enum.Enum):
    PRESENT = "PRESENT"
    HALF_DAY = "HALF_DAY"
    ABSENT = "ABSENT"
    ON_LEAVE = "ON_LEAVE"


class VerificationStatus(str, enum.Enum):
    VERIFIED = "VERIFIED"
    GEOFENCE_FLAGGED = "GEOFENCE_FLAGGED"
    ACCURACY_DEGRADED = "ACCURACY_DEGRADED"
    MANUAL_OVERRIDE = "MANUAL_OVERRIDE"


class Attendance(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Daily attendance work session.
    Table name dynamically resolved from TableRegistry.
    Photo proof is stored as Base64 in PostgreSQL TEXT per architectural safety guidelines.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.attendance

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    work_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    punch_in_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    punch_out_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    punch_in_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    punch_in_lon: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    punch_out_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    punch_out_lon: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Base64 photo string storage (as mandated in arch.pdf to support active pilot data)
    punch_in_proof: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    punch_out_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(50), default=AttendanceStatus.PRESENT.value, nullable=False)
    verification_status: Mapped[str] = mapped_column(String(50), default=VerificationStatus.VERIFIED.value, nullable=False)
    working_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    employee: Mapped["Employee"] = relationship("Employee")
    breaks: Mapped[List["BreakRecord"]] = relationship("BreakRecord", back_populates="attendance", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_attendance_emp_date", "employee_id", "work_date", unique=True),
    )
