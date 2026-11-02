from sqlalchemy import Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, declared_attr
from app.config import get_settings
from app.database.base import Base, TimestampMixin


class SystemConfig(Base, TimestampMixin):
    """
    Persistent tenant-level configuration and module feature flags.
    Stores active feature registry state in PostgreSQL to survive server reboots
    and keep multi-worker processes perfectly synchronized.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.system_config

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    features: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
