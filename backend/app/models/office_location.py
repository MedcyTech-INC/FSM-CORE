from typing import Optional
from sqlalchemy import String, Float, Integer, Boolean, text
from sqlalchemy.orm import Mapped, mapped_column, declared_attr
from geoalchemy2 import Geometry
from app.config import get_settings
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class OfficeLocation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Approved base or geofenced operational location.
    Table name dynamically resolved from TableRegistry.
    Uses PostGIS spatial geometry point for hardware geofencing.
    """
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return get_settings().tables.office_locations

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    radius_meters: Mapped[int] = mapped_column(Integer, default=150, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # PostGIS Spatial point representation (WGS 84, SRID 4326)
    coordinates: Mapped[Optional[str]] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326, spatial_index=True),
        nullable=True
    )
