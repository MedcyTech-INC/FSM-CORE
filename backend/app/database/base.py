import uuid
from datetime import datetime, timezone
from typing import Any, Dict
from sqlalchemy import DateTime, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """
    Base Declarative class for all Master Core ORM entities.
    Table names are dynamically supplied via the configuration TableRegistry.
    """
    def to_dict(self) -> Dict[str, Any]:
        """Convert model instance attributes to dictionary."""
        result = {}
        for key in self.__mapper__.c.keys():
            val = getattr(self, key)
            if isinstance(val, (datetime, uuid.UUID)):
                val = str(val)
            result[key] = val
        return result


class UUIDPrimaryKeyMixin:
    """Provides standard UUID primary key."""
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
        index=True
    )


class TimestampMixin:
    """Provides automatic UTC timestamps for entity auditability."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )
