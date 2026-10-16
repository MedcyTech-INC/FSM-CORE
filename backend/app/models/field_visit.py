import uuid
import enum
from datetime import date, datetime
from typing import Optional
from sqlalchemy import Date, DateTime, Float, String, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr
from app.config import get_settings
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class VisitStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    MISSED = "MISSED"
    CANCELLED = "CANCELLED"


class FieldVisit(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Universal Field Visit entity (Multi-Vertical Ready).
    Table name dynamically resolved from TableRegistry.
    Supports Pharma (Doctors/Chemists), Agri (Farmers/Dealers), and Industrial (Facilities/Plants).
    Photo proof stored as Base64 in PostgreSQL TEXT per arch.pdf.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.field_visits

    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.field_sessions}.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Universal target entity metadata (Doctor, Chemist, Farmer, Facility, Dealer, etc.)
    target_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    target_name: Mapped[str] = mapped_column(String(200), nullable=False)
    target_identifier: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Registration ID, Doctor Code, Asset ID

    visit_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    arrival_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completion_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Base64 photo storage for check-in proofs
    proof_photo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    discussion_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default=VisitStatus.SCHEDULED.value, nullable=False, index=True)

    # Multi-Vertical extensible payload (sample products, crop diagnosis, equipment inspection checklists)
    custom_fields: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict, nullable=True)

    session: Mapped[Optional["FieldSession"]] = relationship("FieldSession", back_populates="visits")
    employee: Mapped["Employee"] = relationship("Employee")

    __table_args__ = (
        Index("ix_visits_emp_date", "employee_id", "visit_date"),
    )
