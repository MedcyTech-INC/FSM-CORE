import uuid
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class CustomerBase(BaseModel):
    name: str = Field(..., max_length=200)
    customer_type: str = Field(default="Doctor", max_length=50)
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    location_city: Optional[str] = None
    location_area: Optional[str] = None
    territory: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: bool = True


class CustomerCreate(CustomerBase):
    pass


class CustomerResponse(CustomerBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class LeadBase(BaseModel):
    customer_id: Optional[uuid.UUID] = None
    customer_name: Optional[str] = None
    customer_type: str = "Doctor"
    title: str = Field(..., max_length=300)
    opportunity_type: str = "Hospital service"
    interested_product_service: Optional[str] = None
    customer_response: Optional[str] = None
    lead_source: str = "Doctor Visit"
    stage: str = "NEW"
    priority: str = "MEDIUM"
    expected_value: Optional[float] = None
    expected_close_date: Optional[date] = None
    location_city: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None


class LeadCreate(LeadBase):
    employee_id: uuid.UUID


class LeadUpdate(BaseModel):
    title: Optional[str] = None
    stage: Optional[str] = None
    priority: Optional[str] = None
    expected_value: Optional[float] = None
    actual_converted_value: Optional[float] = None
    expected_close_date: Optional[date] = None
    notes: Optional[str] = None
    conversion_outcome: Optional[str] = None
    loss_reason: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class LeadResponse(LeadBase):
    id: uuid.UUID
    employee_id: uuid.UUID
    created_by_id: uuid.UUID
    actual_converted_value: Optional[float] = None
    last_interaction_date: Optional[datetime] = None
    conversion_outcome: Optional[str] = None
    loss_reason: Optional[str] = None
    closed_at: Optional[datetime] = None
    field_visit_id: Optional[uuid.UUID] = None
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class FollowUpBase(BaseModel):
    lead_id: Optional[uuid.UUID] = None
    customer_id: Optional[uuid.UUID] = None
    field_visit_id: Optional[uuid.UUID] = None
    customer_name: Optional[str] = None
    action_type: str = "Call"
    title: str = Field(..., max_length=300)
    due_at: datetime
    priority: str = "MEDIUM"
    notes: Optional[str] = None
    status: str = "PENDING"


class FollowUpCreate(FollowUpBase):
    employee_id: uuid.UUID


class FollowUpUpdate(BaseModel):
    title: Optional[str] = None
    due_at: Optional[datetime] = None
    priority: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    outcome: Optional[str] = None
    cancel_reason: Optional[str] = None


class FollowUpResponse(FollowUpBase):
    id: uuid.UUID
    employee_id: uuid.UUID
    created_by_id: uuid.UUID
    outcome: Optional[str] = None
    cancel_reason: Optional[str] = None
    completed_at: Optional[datetime] = None
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MonthlyTargetResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    target_month: date
    target_revenue: float
    achieved_revenue: float
    target_visits: int
    achieved_visits: int
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

