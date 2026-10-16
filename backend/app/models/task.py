import uuid
import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, String, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr
from app.config import get_settings
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class TaskPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class TaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    OVERDUE = "OVERDUE"
    CANCELLED = "CANCELLED"


class Task(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Manager task delegations and follow-ups.
    Table name dynamically resolved from TableRegistry.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.tasks

    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    assignee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    priority: Mapped[str] = mapped_column(String(50), default=TaskPriority.MEDIUM.value, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default=TaskStatus.PENDING.value, nullable=False, index=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    creator: Mapped["Employee"] = relationship("Employee", foreign_keys=[creator_id])
    assignee: Mapped["Employee"] = relationship("Employee", foreign_keys=[assignee_id])

    __table_args__ = (
        Index("ix_tasks_assignee_status", "assignee_id", "status"),
    )
