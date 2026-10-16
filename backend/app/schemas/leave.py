import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class LeaveApplyRequest(BaseModel):
    leave_type: str = Field(..., description="CASUAL, SICK, EARNED, UNPAID")
    start_date: date
    end_date: date
    reason: str


class LeaveApproveRequest(BaseModel):
    action: str = Field(..., description="APPROVE or REJECT")
    rejection_reason: Optional[str] = None


class LeaveBalanceResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    leave_type: str
    year: int
    allocated_days: float
    used_days: float
    remaining_days: float

    model_config = {"from_attributes": True}


class LeaveRequestResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    leave_type: str
    start_date: date
    end_date: date
    days_count: float
    reason: str
    status: str
    approved_by_id: Optional[uuid.UUID] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
