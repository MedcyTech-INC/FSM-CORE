import uuid
from datetime import date, datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class FieldSessionStartRequest(BaseModel):
    latitude: float
    longitude: float


class FieldSessionEndRequest(BaseModel):
    latitude: float
    longitude: float


class FieldSessionResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    start_time: datetime
    end_time: Optional[datetime] = None
    start_lat: float
    start_lon: float
    end_lat: Optional[float] = None
    end_lon: Optional[float] = None
    accumulated_distance_km: float
    status: str

    model_config = {"from_attributes": True}


class FieldVisitCreate(BaseModel):
    target_type: str = Field(..., description="DOCTOR, CHEMIST, FARMER, DEALER, FACILITY, PLANT")
    target_name: str
    target_identifier: Optional[str] = None
    visit_date: date
    session_id: Optional[uuid.UUID] = None
    custom_fields: Optional[Dict[str, Any]] = Field(default_factory=dict)


class FieldVisitStart(BaseModel):
    latitude: float
    longitude: float
    proof_photo: Optional[str] = None  # Base64 string per arch.pdf


class FieldVisitComplete(BaseModel):
    discussion_notes: str
    custom_fields: Optional[Dict[str, Any]] = None


class FieldVisitResponse(BaseModel):
    id: uuid.UUID
    session_id: Optional[uuid.UUID] = None
    employee_id: uuid.UUID
    target_type: str
    target_name: str
    target_identifier: Optional[str] = None
    visit_date: date
    arrival_time: Optional[datetime] = None
    completion_time: Optional[datetime] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    proof_photo: Optional[str] = None
    discussion_notes: Optional[str] = None
    status: str
    custom_fields: Optional[Dict[str, Any]] = None

    model_config = {"from_attributes": True}
