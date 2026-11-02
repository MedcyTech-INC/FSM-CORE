import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

from app.shared_contracts.enums import (
    MetricType,
    EntityType,
    TargetStatus,
    TargetState,
)


class TargetProgressResponse(BaseModel):
    current_value: Decimal
    last_updated_at: datetime

    class Config:
        from_attributes = True


class TargetAssignmentCreate(BaseModel):
    entity_type: EntityType
    entity_id: uuid.UUID


class TargetAssignmentResponse(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    progress: Optional[TargetProgressResponse] = None

    class Config:
        from_attributes = True


class TargetCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    metric_type: MetricType
    target_value: Decimal = Field(..., ge=0)
    start_date: date
    end_date: date
    assignments: List[TargetAssignmentCreate] = Field(..., min_length=1, max_length=500)

    @field_validator("end_date")
    @classmethod
    def validate_dates(cls, end_date: date, info) -> date:
        start_date = info.data.get("start_date")
        if start_date and end_date <= start_date:
            raise ValueError("end_date must be strictly after start_date")
        return end_date

    @model_validator(mode="after")
    def validate_count_metric_integers(self):
        count_metrics = [MetricType.DOCTOR_VISITS, MetricType.NEW_LEADS, MetricType.CONVERSIONS]
        if self.metric_type in count_metrics:
            if self.target_value != self.target_value.to_integral():
                raise ValueError(f"target_value must be a whole number for count metric {self.metric_type.value}")
        return self


class TargetResponse(BaseModel):
    id: uuid.UUID
    title: str
    metric_type: str
    target_value: Decimal
    start_date: date
    end_date: date
    status: str
    version: int
    created_by: uuid.UUID
    created_at: datetime
    assignments: List[TargetAssignmentResponse]

    class Config:
        from_attributes = True


class TargetPatchAssignment(BaseModel):
    entity_type: EntityType
    entity_id: uuid.UUID
    backfill: bool = False


class TargetPatchRequest(BaseModel):
    version: int = Field(..., description="Expected current version for optimistic locking")
    reason: str = Field(..., min_length=5, max_length=500)
    target_value: Optional[Decimal] = Field(default=None, ge=0)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    add_assignments: Optional[List[TargetPatchAssignment]] = None
    remove_assignment_ids: Optional[List[uuid.UUID]] = None

    @model_validator(mode="after")
    def validate_no_metric_type(self):
        # metric_type cannot be edited (Critic Gap MT-7)
        if hasattr(self, "metric_type") and getattr(self, "metric_type", None) is not None:
            raise ValueError("metric_type cannot be changed; cancel and create a new target")
        return self


class TargetCancelRequest(BaseModel):
    version: int = Field(..., description="Expected current version")
    reason: str = Field(..., min_length=5, max_length=500)


class MyProgressItem(BaseModel):
    """
    Frozen contract (payload_version 1) used by:
    - GET /targets/my-progress
    - GET /targets/ai-metrics/{user_id}
    """
    payload_version: int = Field(default=1)
    target_id: uuid.UUID
    title: str
    scope: str  # representative, team, territory, branch
    entity_id: uuid.UUID
    metric_type: str
    target_value: Decimal
    current_value: Decimal
    own_contribution: Decimal
    gap_remaining: Decimal
    days_left: int
    required_daily_run_rate: Optional[Decimal] = None
    percent_complete: Optional[Decimal] = None
    state: str  # upcoming, active, achieved, ended_short
    adjusted: bool = False
    start_date: date
    end_date: date


class TargetDetailResponse(TargetResponse):
    changes: List[dict] = []
