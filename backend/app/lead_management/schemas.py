import uuid
from datetime import date, datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from app.lead_management.models import LeadStage, LeadPriority, LeadCustomerType


# -----------------------------------------------------------------------------
# Customer Schemas
# -----------------------------------------------------------------------------
class LeadCustomerBase(BaseModel):
    name: str = Field(..., max_length=200)
    customer_type: str = Field(default=LeadCustomerType.DOCTOR.value)
    phone: Optional[str] = Field(None, max_length=20)
    location_city: Optional[str] = Field(None, max_length=100)
    location_area: Optional[str] = Field(None, max_length=150)
    territory: Optional[str] = Field(None, max_length=150)
    metadata_json: Optional[Dict[str, Any]] = None


class LeadCustomerCreate(LeadCustomerBase):
    pass


class LeadCustomerResponse(LeadCustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


# -----------------------------------------------------------------------------
# Lead History Schemas
# -----------------------------------------------------------------------------
class LeadHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lead_id: uuid.UUID
    actor_id: uuid.UUID
    actor_name: Optional[str] = None
    event_type: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    notes: Optional[str] = None
    occurred_at: datetime


# -----------------------------------------------------------------------------
# Lead Mutation Schemas
# -----------------------------------------------------------------------------
class LeadCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=300)
    lead_type: str = Field(..., max_length=80)
    interested_product_service: Optional[str] = Field(None, max_length=200)
    customer_response: Optional[str] = Field(None, max_length=200)
    lead_source: str = Field(default="Doctor Visit", max_length=80)
    priority: LeadPriority = Field(default=LeadPriority.MEDIUM)
    expected_value: Optional[float] = Field(None, ge=0)
    expected_close_date: Optional[date] = None

    # Target entity
    lead_customer_id: Optional[uuid.UUID] = None
    customer_name: Optional[str] = Field(None, max_length=200)
    customer_type: str = Field(default=LeadCustomerType.DOCTOR.value, max_length=50)

    # Contact & location
    location_city: Optional[str] = Field(None, max_length=100)
    contact_person: Optional[str] = Field(None, max_length=150)
    contact_phone: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None

    # Context links
    field_visit_id: Optional[uuid.UUID] = None
    employee_id: Optional[uuid.UUID] = None  # If manager is assigning at creation


class LeadUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=300)
    lead_type: Optional[str] = Field(None, max_length=80)
    interested_product_service: Optional[str] = Field(None, max_length=200)
    customer_response: Optional[str] = Field(None, max_length=200)
    lead_source: Optional[str] = Field(None, max_length=80)
    priority: Optional[LeadPriority] = None
    expected_value: Optional[float] = Field(None, ge=0)
    actual_converted_value: Optional[float] = Field(None, ge=0)
    expected_close_date: Optional[date] = None
    location_city: Optional[str] = Field(None, max_length=100)
    contact_person: Optional[str] = Field(None, max_length=150)
    contact_phone: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None


class LeadStageChangeRequest(BaseModel):
    new_stage: LeadStage
    actual_converted_value: Optional[float] = None  # Optional when new_stage == CONVERTED
    conversion_outcome: Optional[str] = None      # Required if new_stage == CONVERTED
    loss_reason: Optional[str] = None             # Required if new_stage == LOST
    notes: Optional[str] = None


class LeadAssignRequest(BaseModel):
    new_employee_id: uuid.UUID
    notes: Optional[str] = None


# -----------------------------------------------------------------------------
# Lead Query / Response Schemas
# -----------------------------------------------------------------------------
class LeadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: Optional[str] = None
    created_by_id: uuid.UUID
    created_by_name: Optional[str] = None

    lead_customer_id: Optional[uuid.UUID] = None
    customer_name: Optional[str] = None
    customer_type: str

    title: str
    lead_type: str
    interested_product_service: Optional[str] = None
    customer_response: Optional[str] = None
    lead_source: str
    stage: str
    priority: str
    expected_value: Optional[float] = None
    actual_converted_value: Optional[float] = None
    expected_close_date: Optional[date] = None
    location_city: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    last_interaction_date: Optional[datetime] = None

    conversion_outcome: Optional[str] = None
    loss_reason: Optional[str] = None
    closed_at: Optional[datetime] = None

    field_visit_id: Optional[uuid.UUID] = None
    next_follow_up_due: Optional[datetime] = None
    next_follow_up_title: Optional[str] = None
    pending_followups_count: int = 0

    is_archived: bool
    created_at: datetime
    updated_at: datetime


class LeadSummaryResponse(BaseModel):
    total_leads: int
    open_leads: int
    interested_leads: int = 0
    qualified_leads: int = 0
    converted_leads: int
    lost_leads: int
    needs_attention_count: int = 0
    total_pipeline_value: float
    my_leads_count: int
