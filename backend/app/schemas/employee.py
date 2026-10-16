import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field


class EmployeeBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: str
    rank: Optional[str] = None
    territory: Optional[str] = None
    is_active: bool = True
    reporting_to_id: Optional[uuid.UUID] = None
    metadata_json: Optional[Dict[str, Any]] = Field(default_factory=dict)


class EmployeeCreate(EmployeeBase):
    password: str = Field(..., min_length=6)


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    rank: Optional[str] = None
    territory: Optional[str] = None
    is_active: Optional[bool] = None
    reporting_to_id: Optional[uuid.UUID] = None
    metadata_json: Optional[Dict[str, Any]] = None


class EmployeeResponse(EmployeeBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EmployeeOrgNode(BaseModel):
    id: uuid.UUID
    full_name: str
    role: str
    territory: Optional[str] = None
    reporting_to_id: Optional[uuid.UUID] = None
    depth: int = 1
    subordinates: List["EmployeeOrgNode"] = Field(default_factory=list)

    model_config = {"from_attributes": True}
