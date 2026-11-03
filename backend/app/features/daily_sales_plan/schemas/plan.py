import uuid
from datetime import date, time, datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class PlanGenerateRequest(BaseModel):
    employee_id: uuid.UUID
    plan_date: date
    start_latitude: float = Field(..., ge=-90.0, le=90.0)
    start_longitude: float = Field(..., ge=-180.0, le=180.0)
    max_stops: int = Field(default=6, ge=1, le=15)
    idempotency_key: uuid.UUID
    force_regenerate: bool = False


class PlanReplanRequest(BaseModel):
    current_latitude: float = Field(..., ge=-90.0, le=90.0)
    current_longitude: float = Field(..., ge=-180.0, le=180.0)
    replan_reason: str = Field(..., max_length=200)


class PlanItemStartRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    proof_photo: Optional[str] = None  # Base64 string per arch.pdf


class PlanItemSkipRequest(BaseModel):
    skip_reason: str = Field(..., min_length=3, max_length=255)


class ObligationFulfillmentItem(BaseModel):
    obligation_id: uuid.UUID
    fulfillment_status: str = Field(
        ...,
        description="FULFILLED, UNFULFILLED_RESCHEDULED, CANCELLED"
    )
    notes: Optional[str] = None
    rescheduled_date: Optional[date] = None


class NextFollowUpPayload(BaseModel):
    scheduled_date: date
    scheduled_time: Optional[time] = None
    title: str = Field(..., max_length=300)
    urgency: str = "NORMAL"
    action_type: str = "Visit"


class PlanItemCompleteRequest(BaseModel):
    idempotency_key: uuid.UUID
    actual_latitude: float = Field(..., ge=-90.0, le=90.0)
    actual_longitude: float = Field(..., ge=-180.0, le=180.0)
    visit_outcome: str = Field(
        ...,
        description="SUCCESSFUL_MEETING, DOCTOR_UNAVAILABLE, RESCHEDULE_REQUESTED, GATEKEEPER_BLOCKED"
    )
    notes: Optional[str] = None
    updated_lead_stage: Optional[str] = None
    actual_converted_value: Optional[float] = None
    obligations: List[ObligationFulfillmentItem] = Field(default_factory=list)
    next_follow_up: Optional[NextFollowUpPayload] = None


class PlanApproveRequest(BaseModel):
    notes: Optional[str] = None


class PlanObligationResponse(BaseModel):
    id: uuid.UUID
    plan_item_id: uuid.UUID
    obligation_type: str
    obligation_title: str
    is_mandatory: bool
    lead_id: Optional[uuid.UUID] = None
    follow_up_id: Optional[uuid.UUID] = None
    task_id: Optional[uuid.UUID] = None
    fulfillment_status: str
    outcome_notes: Optional[str] = None
    fulfilled_at: Optional[datetime] = None
    rescheduled_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PlanItemResponse(BaseModel):
    id: uuid.UUID
    plan_id: uuid.UUID
    sequence_order: int
    activity_type: str
    planned_arrival_time: Optional[time] = None
    planned_departure_time: Optional[time] = None
    estimated_duration_minutes: int
    lead_id: Optional[uuid.UUID] = None
    customer_id: Optional[uuid.UUID] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_address: Optional[str] = None
    stop_type: str
    recommendation_score: Optional[float] = None
    recommendation_reasons: Optional[Dict[str, Any]] = None
    status: str
    field_visit_id: Optional[uuid.UUID] = None
    transit_distance_m: float
    transit_duration_s: int
    obligations: List[PlanObligationResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PlanResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    plan_date: date
    version: int
    revision_type: str
    status: str
    total_planned_stops: int
    total_planned_distance_meters: float
    total_planned_duration_seconds: int
    routing_engine: str
    idempotency_key: uuid.UUID
    approved_by_id: Optional[uuid.UUID] = None
    approved_at: Optional[datetime] = None
    items: List[PlanItemResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
