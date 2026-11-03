import enum
import uuid
from datetime import date, datetime, timezone
from typing import Optional, List
from sqlalchemy import Date, DateTime, Float, String, Text, Boolean, ForeignKey, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr

from app.config import get_settings
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class LeadStage(str, enum.Enum):
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    INTERESTED = "INTERESTED"
    QUALIFIED = "QUALIFIED"
    CONVERTED = "CONVERTED"
    LOST = "LOST"


class LeadPriority(str, enum.Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class LeadCustomerType(str, enum.Enum):
    DOCTOR = "Doctor"
    CLINIC = "Clinic"
    HOSPITAL = "Hospital"
    PHARMACY = "Pharmacy"
    DISTRIBUTOR = "Distributor"
    OTHER = "Other"


class LeadCustomer(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Reusable customer / master contact for leads and visits.
    Prevents duplicating doctors/clinics across multiple opportunities.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.lead_customers

    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    customer_type: Mapped[str] = mapped_column(String(50), nullable=False, default=LeadCustomerType.DOCTOR.value, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    location_city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    location_area: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    territory: Mapped[Optional[str]] = mapped_column(String(150), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict, nullable=True)

    __table_args__ = (
        Index("ix_lead_customers_active_type", "is_active", "customer_type"),
    )


class Lead(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Business Opportunity (Lead) entity.
    Scoped by employee hierarchy. Can link to an existing FieldVisit.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.leads

    # Multi-Tenant Scoping
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fsm_system.tenants.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    # Owner & Creator scoping
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Customer reference (reusable master contact or inline fallback)
    lead_customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.lead_customers}.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    customer_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    customer_type: Mapped[str] = mapped_column(String(50), default=LeadCustomerType.DOCTOR.value, nullable=False)

    # Opportunity details
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    lead_type: Mapped[str] = mapped_column(String(80), nullable=False)  # Hospital Service, Medicine Supply, Equipment, etc.
    interested_product_service: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    customer_response: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    lead_source: Mapped[str] = mapped_column(String(80), nullable=False, default="Doctor Visit")
    stage: Mapped[str] = mapped_column(String(50), default=LeadStage.NEW.value, nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(20), default=LeadPriority.MEDIUM.value, nullable=False, index=True)
    expected_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    expected_close_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    location_city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_interaction_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Closed state attributes
    actual_converted_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    conversion_outcome: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    loss_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Cross-feature link to FieldVisit
    field_visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.field_visits}.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    # Relationships
    employee = relationship("Employee", foreign_keys=[employee_id])
    creator = relationship("Employee", foreign_keys=[created_by_id])
    customer = relationship("LeadCustomer", foreign_keys=[lead_customer_id])
    field_visit = relationship("FieldVisit", foreign_keys=[field_visit_id])
    history = relationship(
        "LeadHistory",
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="LeadHistory.occurred_at.asc()"
    )

    __table_args__ = (
        Index("ix_leads_emp_stage", "employee_id", "stage"),
        Index("ix_leads_stage_priority", "stage", "priority"),
        Index("ix_leads_tenant_stage", "tenant_id", "stage"),
    )

    @property
    def opportunity_type(self) -> str:
        return self.lead_type

    @opportunity_type.setter
    def opportunity_type(self, val: str) -> None:
        self.lead_type = val

    @property
    def customer_id(self) -> Optional[uuid.UUID]:
        return self.lead_customer_id

    @customer_id.setter
    def customer_id(self, val: Optional[uuid.UUID]) -> None:
        self.lead_customer_id = val


class LeadHistory(Base, UUIDPrimaryKeyMixin):
    """
    Immutable audit history trail for a Lead.
    Records creation, stage transitions, ownership reassignments, notes, and closure.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.lead_history

    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.leads}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)  # CREATED, STAGE_CHANGED, ASSIGNED, CLOSED, REOPENED, UPDATED
    field_name: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        nullable=False,
        index=True
    )

    lead = relationship("Lead", back_populates="history")
    actor = relationship("Employee", foreign_keys=[actor_id])

    __table_args__ = (
        Index("ix_lead_history_lead_time", "lead_id", "occurred_at"),
    )
