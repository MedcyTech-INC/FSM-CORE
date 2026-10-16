import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    assignee_id: uuid.UUID
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: str = "MEDIUM"


class TaskUpdateStatus(BaseModel):
    status: str = Field(..., description="PENDING, IN_PROGRESS, COMPLETED, CANCELLED")


class TaskResponse(BaseModel):
    id: uuid.UUID
    creator_id: uuid.UUID
    assignee_id: uuid.UUID
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: str
    status: str
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
