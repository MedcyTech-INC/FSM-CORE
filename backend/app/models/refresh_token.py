import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr
from app.config import get_settings
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class RefreshToken(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Cryptographic refresh tokens for secure session rotation.
    Table name dynamically resolved from TableRegistry.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.refresh_tokens

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    device_fingerprint: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    employee: Mapped["Employee"] = relationship("Employee")

    __table_args__ = (
        Index("ix_tokens_emp_valid", "employee_id", "is_revoked", "expires_at"),
    )
