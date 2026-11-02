import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Optional, Union
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

CURRENT_EVENT_VERSION = 1


class BaseFSMEvent(BaseModel):
    """
    Standard base event contract with idempotency ID and explicit versioning.
    Critic Gap P-6: Versioned events; unknown versions are rejected.
    """
    event_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    event_version: int = Field(default=CURRENT_EVENT_VERSION)
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("event_version")
    @classmethod
    def validate_version(cls, v: int) -> int:
        if v != CURRENT_EVENT_VERSION:
            raise ValueError(f"Unsupported event version {v}. Current supported version is {CURRENT_EVENT_VERSION}")
        return v


# 1. Doctor Visits
class VisitCompletedEvent(BaseFSMEvent):
    event_type: str = "visit_completed"
    visit_id: uuid.UUID
    representative_id: uuid.UUID
    doctor_id: Optional[uuid.UUID] = None
    completed_at: datetime
    is_valid_geofence: bool = True


class VisitApprovedEvent(BaseFSMEvent):
    event_type: str = "visit_approved"
    visit_id: uuid.UUID
    representative_id: uuid.UUID
    approved_at: datetime


class VisitRejectedEvent(BaseFSMEvent):
    event_type: str = "visit_rejected"
    original_event_id: uuid.UUID
    visit_id: uuid.UUID
    reason: Optional[str] = None


class VisitCancelledEvent(BaseFSMEvent):
    event_type: str = "visit_cancelled"
    original_event_id: uuid.UUID
    visit_id: uuid.UUID
    reason: Optional[str] = None


# 2. Leads & Conversions
class LeadCreatedEvent(BaseFSMEvent):
    event_type: str = "lead_created"
    lead_id: uuid.UUID
    representative_id: uuid.UUID
    created_at: datetime


class LeadConvertedEvent(BaseFSMEvent):
    event_type: str = "lead_converted"
    lead_id: uuid.UUID
    representative_id: uuid.UUID
    converted_at: datetime


class LeadConversionRevertedEvent(BaseFSMEvent):
    event_type: str = "lead_conversion_reverted"
    original_event_id: uuid.UUID
    lead_id: uuid.UUID
    reason: Optional[str] = None


# 3. Revenue & Orders
class OrderClosedEvent(BaseFSMEvent):
    event_type: str = "order_closed"
    order_id: uuid.UUID
    representative_id: uuid.UUID
    customer_id: Optional[uuid.UUID] = None
    order_value: Decimal = Field(..., ge=0)
    closed_at: datetime


class OrderCancelledEvent(BaseFSMEvent):
    event_type: str = "order_cancelled"
    original_event_id: uuid.UUID
    order_id: uuid.UUID
    reason: Optional[str] = None


# 4. Collections
class CollectionRecordedEvent(BaseFSMEvent):
    event_type: str = "collection_recorded"
    payment_id: uuid.UUID
    representative_id: uuid.UUID
    customer_id: Optional[uuid.UUID] = None
    amount: Decimal = Field(..., ge=0)
    recorded_at: datetime


class CollectionBouncedEvent(BaseFSMEvent):
    event_type: str = "collection_bounced"
    original_event_id: uuid.UUID
    payment_id: uuid.UUID
    reason: Optional[str] = None


EventUnion = Union[
    VisitCompletedEvent,
    VisitApprovedEvent,
    VisitRejectedEvent,
    VisitCancelledEvent,
    LeadCreatedEvent,
    LeadConvertedEvent,
    LeadConversionRevertedEvent,
    OrderClosedEvent,
    OrderCancelledEvent,
    CollectionRecordedEvent,
    CollectionBouncedEvent,
]


async def publish_event(
    session: AsyncSession,
    event: BaseFSMEvent,
    schema: str = "fsm_app"
) -> uuid.UUID:
    """
    Publish event using Transactional Outbox pattern.
    Writes row into event_outbox in the producer's exact transaction.
    """
    event_type = getattr(event, "event_type", type(event).__name__.lower())
    payload_json = event.model_dump_json()

    query = text(f"""
        INSERT INTO {schema}.fsm_monthly_targets_event_outbox (
            id, event_type, event_version, payload, created_at, attempts
        ) VALUES (
            :id, :event_type, :event_version, CAST(:payload AS jsonb), NOW(), 0
        )
    """)

    await session.execute(
        query,
        {
            "id": str(event.event_id),
            "event_type": event_type,
            "event_version": event.event_version,
            "payload": payload_json,
        }
    )
    return event.event_id
