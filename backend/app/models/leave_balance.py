import uuid
from sqlalchemy import Float, Integer, String, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr
from app.config import get_settings
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class LeaveBalance(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Employee leave quotas and available balance ledger.
    Table name dynamically resolved from TableRegistry.
    Used in atomic SELECT ... FOR UPDATE transactions to prevent race conditions.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.leave_balances

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{get_settings().tables.employees}.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    leave_type: Mapped[str] = mapped_column(String(50), nullable=False)  # CASUAL, SICK, EARNED, UNPAID
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    allocated_days: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    used_days: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    remaining_days: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    employee: Mapped["Employee"] = relationship("Employee")

    __table_args__ = (
        Index("ix_leave_balance_emp_type_year", "employee_id", "leave_type", "year", unique=True),
    )
