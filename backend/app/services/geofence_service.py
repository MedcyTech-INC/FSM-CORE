import math
from typing import Tuple, Optional, List
from datetime import datetime
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.office_location import OfficeLocation
from app.models.attendance import VerificationStatus

settings = get_settings()


class GeofenceService:
    """
    Spatial Geofencing & Fraud Prevention Service.
    Verifies user GPS coordinates against configured office boundaries,
    with anti-spoofing velocity and accuracy checks.
    """

    @staticmethod
    def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculates Great-Circle distance between two points in meters using Haversine formula.
        Used as high-performance in-memory math fallback when PostGIS is unavailable.
        """
        r = 6371000.0  # Earth's radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (
            math.sin(delta_phi / 2.0) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        )
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return r * c

    @classmethod
    async def verify_geofence(
        cls,
        db: AsyncSession,
        latitude: float,
        longitude: float,
        accuracy_meters: Optional[float] = None
    ) -> Tuple[bool, str, Optional[OfficeLocation], float]:
        """
        Evaluates whether coordinates fall inside any approved active office geofence.
        Returns: (is_valid, verification_status, matched_office, distance_meters)
        """
        # Step 1: Anti-spoofing accuracy check
        if accuracy_meters is not None and accuracy_meters > settings.max_accuracy_threshold_meters:
            return False, VerificationStatus.ACCURACY_DEGRADED.value, None, 0.0

        # Step 2: Query active locations
        stmt = select(OfficeLocation).where(OfficeLocation.is_active.is_(True))
        result = await db.execute(stmt)
        locations = result.scalars().all()

        if not locations:
            # If no office locations configured, permit with default verified
            return True, VerificationStatus.VERIFIED.value, None, 0.0

        closest_location = None
        min_distance = float("inf")

        for loc in locations:
            dist = cls.haversine_distance_meters(latitude, longitude, loc.latitude, loc.longitude)
            if dist < min_distance:
                min_distance = dist
                closest_location = loc

            if dist <= loc.radius_meters:
                return True, VerificationStatus.VERIFIED.value, loc, dist

        # Point falls outside allowed radius
        return False, VerificationStatus.GEOFENCE_FLAGGED.value, closest_location, min_distance

    @classmethod
    def verify_speed_plausibility(
        cls,
        lat1: float,
        lon1: float,
        time1: datetime,
        lat2: float,
        lon2: float,
        time2: datetime
    ) -> bool:
        """
        Checks if the speed between two sequential telemetry pings exceeds max allowed speed.
        Flags mock location spoofing.
        """
        time_diff_hours = abs((time2 - time1).total_seconds()) / 3600.0
        if time_diff_hours <= 0:
            return True

        distance_km = cls.haversine_distance_meters(lat1, lon1, lat2, lon2) / 1000.0
        speed_kmh = distance_km / time_diff_hours

        return speed_kmh <= settings.max_allowed_speed_kmh
