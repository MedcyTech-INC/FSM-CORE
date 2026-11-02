from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class HolidayCreateRequest(BaseModel):
    holiday_date: date = Field(..., description="Date of the holiday (YYYY-MM-DD)")
    name: str = Field(..., min_length=2, max_length=100, description="Holiday name (e.g. Diwali, Eid)")
    region: Optional[str] = Field("National", max_length=50, description="Region (e.g. National, Maharashtra, North)")


class HolidayResponse(BaseModel):
    holiday_date: date
    name: str
    region: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
