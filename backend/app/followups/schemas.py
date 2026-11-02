import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.followups.models import FollowupStatus, FollowupActionType, FollowupPriority


class FollowupCreate(BaseModel):
    # Context (at least one must be provided)
    lead_id: Optional[uuid.UUID] = None
    lead_customer_id: Optional[uuid.UUID] = None
    field_visit_id: Optional[uuid.UUID] = None
    customer_name: Optional[str] = Field(None, max_length=200)

    # Action definition
    action_type: str = Field(default=FollowupActionType.CALL.value)
    title: str = Field(..., min_length=2, max_length=300)
    due_at: datetime
    priority: FollowupPriority = Field(default=FollowupPriority.MEDIUM)
    notes: Optional[str] = None

    employee_id: Optional[uuid.UUID] = None  # Assignee (defaults to current user)

    @model_validator(mode="after")
    def validate_context(self):
        if not self.lead_id and not self.lead_customer_id and not self.field_visit_id:
            raise ValueError("Follow-up must be linked to at least one context: a Lead, a Customer, or a Field Visit.")
        return self


class FollowupUpdate(BaseModel):
    action_type: Optional[str] = None
    title: Optional[str] = Field(None, min_length=2, max_length=300)
    due_at: Optional[datetime] = None
    priority: Optional[FollowupPriority] = None
    notes: Optional[str] = None


class FollowupCompleteRequest(BaseModel):
    outcome: str = Field(..., min_length=2, description="Recorded result of the completed action")


class FollowupRescheduleRequest(BaseModel):
    new_due_at: datetime
    reason: str = Field(..., min_length=2, description="Reason for moving the promised due date")


class FollowupCancelRequest(BaseModel):
    cancel_reason: str = Field(..., min_length=2, description="Reason for cancelling this action")


class FollowupHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    followup_id: uuid.UUID
    actor_id: uuid.UUID
    actor_name: Optional[str] = None
    event_type: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    notes: Optional[str] = None
    occurred_at: datetime


class FollowupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: Optional[str] = None
    created_by_id: uuid.UUID
    created_by_name: Optional[str] = None

    lead_id: Optional[uuid.UUID] = None
    lead_title: Optional[str] = None
    lead_customer_id: Optional[uuid.UUID] = None
    field_visit_id: Optional[uuid.UUID] = None
    customer_name: Optional[str] = None

    action_type: str
    title: str
    due_at: datetime
    priority: str
    notes: Optional[str] = None

    status: str
    outcome: Optional[str] = None
    cancel_reason: Optional[str] = None
    completed_at: Optional[datetime] = None

    is_overdue: bool = False
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class DueSummaryResponse(BaseModel):
    due_today: int
    overdue: int
    upcoming: int
    completed_today: int
