import uuid
import enum
from datetime import datetime
from typing import Optional, List
from sqlalchemy import DateTime, Float, String, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr
from app.config import get_settings
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class FieldSessionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"


class FieldSession(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Day travel session and location tracking for field workforce.
    Table name dynamically resolved from TableRegistry.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.field_sessions

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    start_lat: Mapped[float] = mapped_column(Float, nullable=False)
    start_lon: Mapped[float] = mapped_column(Float, nullable=False)
    end_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    end_lon: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    accumulated_distance_km: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default=FieldSessionStatus.ACTIVE.value, nullable=False, index=True)

    employee: Mapped["Employee"] = relationship("Employee")
    visits: Mapped[List["FieldVisit"]] = relationship("FieldVisit", back_populates="session")

    __table_args__ = (
        Index("ix_field_sessions_emp_active", "employee_id", "status"),
    )
