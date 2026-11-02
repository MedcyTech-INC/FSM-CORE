import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, model_validator

from app.features.revenue_leakage.models import (
    RuleCode,
    Classification,
    AttentionPriority,
    AlertStatus,
    ActionType,
    Outcome,
    ObservationReason,
    ScanStatus,
    ScanMode,
    NotificationKind,
)


class AlertObservationResponse(BaseModel):
    id: Optional[uuid.UUID] = None
    observed_at: datetime
    observation: Dict[str, Any]
    attention_priority: AttentionPriority
    reason: ObservationReason

    model_config = {"from_attributes": True}


class AlertActionResponse(BaseModel):
    id: uuid.UUID
    alert_id: uuid.UUID
    action_type: ActionType
    outcome: Optional[Outcome] = None
    action_taken: str
    evidence_reference: Optional[str] = None
    notes: Optional[str] = None
    action_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class EarlierOccurrenceItem(BaseModel):
    id: uuid.UUID
    occurrence_no: int
    status: AlertStatus
    first_detected_at: datetime
    resolved_at: Optional[datetime] = None
    archived: bool = False

    model_config = {"from_attributes": True}


class AlertItemResponse(BaseModel):
    id: uuid.UUID
    rule_code: Union[RuleCode, str]
    rule_name: str
    entity_type: str
    entity_id: uuid.UUID
    entity_label: Optional[str] = None
    owner_id: Optional[uuid.UUID] = None
    classification: Union[Classification, str] = Classification.OPERATIONAL_WARNING
    attention_priority: Union[AttentionPriority, str]
    priority_reason: str
    observation: Dict[str, Any]
    exposure_amount: Optional[Decimal] = None
    exposure_basis: Optional[str] = None
    status: Union[AlertStatus, str]
    version: int
    occurrence_no: int
    previous_alert_id: Optional[uuid.UUID] = None
    first_detected_at: datetime
    last_observed_at: datetime
    resolved_at: Optional[datetime] = None
    suppressed_until: Optional[datetime] = None
    clear_streak: int = 0
    escalation_level: int = 0

    model_config = {"from_attributes": True}


class AlertDetailResponse(AlertItemResponse):
    observations: List[AlertObservationResponse] = Field(default_factory=list)
    actions: List[AlertActionResponse] = Field(default_factory=list)
    occurrences: List[EarlierOccurrenceItem] = Field(default_factory=list)


class PaginatedAlertsResponse(BaseModel):
    items: List[AlertItemResponse] = Field(default_factory=list)
    total: int
    page: int
    page_size: int


class AlertActionCreateRequest(BaseModel):
    action_type: ActionType
    expected_version: int
    outcome: Optional[Outcome] = None
    action_taken: str = Field(..., min_length=5, max_length=255)
    evidence_reference: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=1000)

    @model_validator(mode="after")
    def validate_action_fields(self) -> "AlertActionCreateRequest":
        # Outcome required for resolved & dismissed
        if self.action_type in [ActionType.RESOLVED, ActionType.DISMISSED]:
            if not self.outcome:
                raise ValueError(f"outcome is required when action_type is {self.action_type.value}")
            if self.outcome == Outcome.CONDITION_CLEARED:
                raise ValueError("condition_cleared outcome is reserved for the automated system scanner")

        # Evidence required when outcome is commercial_outcome_evidenced
        if self.outcome == Outcome.COMMERCIAL_OUTCOME_EVIDENCED:
            if not self.evidence_reference or not self.evidence_reference.strip():
                raise ValueError("evidence_reference is required when outcome is commercial_outcome_evidenced")

        return self


class RuleResponse(BaseModel):
    id: uuid.UUID
    rule_code: RuleCode
    rule_name: str
    description: Optional[str] = None
    threshold_days: int
    threshold_value: Decimal
    medium_priority_ratio: Decimal
    high_priority_ratio: Decimal
    change_ratio: Decimal
    cooldown_days: int
    dismiss_days: int
    autoclear_scans: int
    escalation_days: int
    min_history_months: int
    params: Dict[str, Any]
    required_sources: List[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RulePatchRequest(BaseModel):
    threshold_days: Optional[int] = Field(None, ge=1)
    threshold_value: Optional[Decimal] = Field(None, ge=0)
    medium_priority_ratio: Optional[Decimal] = Field(None, ge=1.0)
    high_priority_ratio: Optional[Decimal] = None
    change_ratio: Optional[Decimal] = Field(None, gt=0, le=1.0)
    cooldown_days: Optional[int] = Field(None, ge=0)
    dismiss_days: Optional[int] = Field(None, ge=0)
    autoclear_scans: Optional[int] = Field(None, ge=1)
    escalation_days: Optional[int] = Field(None, ge=1)
    min_history_months: Optional[int] = Field(None, ge=1)
    params: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    reason: str = Field(..., min_length=5, max_length=500)

    @model_validator(mode="after")
    def validate_ratios(self) -> "RulePatchRequest":
        if self.medium_priority_ratio is not None and self.high_priority_ratio is not None:
            if self.high_priority_ratio <= self.medium_priority_ratio:
                raise ValueError("high_priority_ratio must be strictly greater than medium_priority_ratio")
        return self


class ScanRunResponse(BaseModel):
    id: uuid.UUID
    rule_code: RuleCode
    mode: ScanMode
    started_at: datetime
    heartbeat_at: datetime
    finished_at: Optional[datetime] = None
    status: ScanStatus
    rows_evaluated: int
    alerts_created: int
    alerts_updated: int
    alerts_cleared: int
    skipped_not_synced: int
    attempt: int
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}


# Backward compatibility aliases
ObservationDTO = AlertObservationResponse
ActionDTO = AlertActionResponse
OccurrenceDTO = EarlierOccurrenceItem
AlertResponse = AlertItemResponse
AlertActionRequest = AlertActionCreateRequest
