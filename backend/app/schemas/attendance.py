import uuid
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ClockInRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy_meters: Optional[float] = None
    proof_image: Optional[str] = None  # Base64 string per arch.pdf


class ClockOutRequest(BaseModel):
    latitude: float
    longitude: float
    summary: Optional[str] = None


class BreakStartRequest(BaseModel):
    reason: Optional[str] = "Rest Break"


class BreakEndRequest(BaseModel):
    pass


class BreakResponse(BaseModel):
    id: uuid.UUID
    attendance_id: uuid.UUID
    start_time: datetime
    end_time: Optional[datetime] = None
    reason: Optional[str] = None
    duration_minutes: int

    model_config = {"from_attributes": True}


class AttendanceResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    work_date: date
    punch_in_time: Optional[datetime] = None
    punch_out_time: Optional[datetime] = None
    punch_in_lat: Optional[float] = None
    punch_in_lon: Optional[float] = None
    punch_out_lat: Optional[float] = None
    punch_out_lon: Optional[float] = None
    punch_in_proof: Optional[str] = None
    punch_out_summary: Optional[str] = None
    status: str
    verification_status: str
    working_minutes: int
    breaks: List[BreakResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}
