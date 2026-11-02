import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Protocol, Set, Tuple
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.leave_request import LeaveRequest, LeaveRequestStatus
from app.features.monthly_target.models import Holiday, OrgMembershipHistory


class LeaveProvider(Protocol):
    """Interface for querying approved employee leave dates."""
    async def get_approved_leaves(
        self, db: AsyncSession, employee_id: uuid.UUID, start_date: date, end_date: date
    ) -> Set[date]: ...


class HolidayProvider(Protocol):
    """Interface for querying official holidays."""
    async def get_holidays(
        self, db: AsyncSession, start_date: date, end_date: date, region: Optional[str] = None
    ) -> Set[date]: ...


class MembershipProvider(Protocol):
    """Interface for resolving team, territory, branch as of an event timestamp."""
    async def get_membership_at(
        self, db: AsyncSession, employee_id: uuid.UUID, timestamp: datetime
    ) -> Optional[Tuple[uuid.UUID, uuid.UUID, uuid.UUID]]:
        """Returns (team_id, territory_id, branch_id) as of timestamp."""
        ...


class SourceRecordsProvider(Protocol):
    """Interface for reading qualifying historical activity for target backfills."""
    async def get_qualifying_records(
        self,
        db: AsyncSession,
        metric_type: str,
        employee_id: uuid.UUID,
        start_date: date,
        end_date: date,
    ) -> List[Dict[str, Any]]: ...


# Default Production Implementations
class DatabaseLeaveProvider:
    async def get_approved_leaves(
        self, db: AsyncSession, employee_id: uuid.UUID, start_date: date, end_date: date
    ) -> Set[date]:
        stmt = select(LeaveRequest).where(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status == LeaveRequestStatus.APPROVED.value,
            LeaveRequest.start_date <= end_date,
            LeaveRequest.end_date >= start_date,
        )
        result = await db.execute(stmt)
        requests = result.scalars().all()

        leave_dates: Set[date] = set()
        from datetime import timedelta
        for req in requests:
            curr = max(req.start_date, start_date)
            last = min(req.end_date, end_date)
            while curr <= last:
                leave_dates.add(curr)
                curr += timedelta(days=1)
        return leave_dates


class DatabaseHolidayProvider:
    async def get_holidays(
        self, db: AsyncSession, start_date: date, end_date: date, region: Optional[str] = None
    ) -> Set[date]:
        stmt = select(Holiday.holiday_date).where(
            Holiday.holiday_date >= start_date,
            Holiday.holiday_date <= end_date,
        )
        result = await db.execute(stmt)
        return set(result.scalars().all())


class DatabaseMembershipProvider:
    async def get_membership_at(
        self, db: AsyncSession, employee_id: uuid.UUID, timestamp: datetime
    ) -> Optional[Tuple[uuid.UUID, uuid.UUID, uuid.UUID]]:
        stmt = select(OrgMembershipHistory).where(
            OrgMembershipHistory.employee_id == employee_id,
            OrgMembershipHistory.effective_from <= timestamp,
            or_(
                OrgMembershipHistory.effective_to.is_(None),
                OrgMembershipHistory.effective_to > timestamp,
            ),
        )
        result = await db.execute(stmt)
        record = result.scalar_one_or_none()
        if record:
            return (record.team_id, record.territory_id, record.branch_id)
        return None


class DatabaseSourceRecordsProvider:
    async def get_qualifying_records(
        self,
        db: AsyncSession,
        metric_type: str,
        employee_id: uuid.UUID,
        start_date: date,
        end_date: date,
    ) -> List[Dict[str, Any]]:
        """Reads historical field visits from existing field_visits table for backfilling."""
        if metric_type == "doctor_visits":
            from app.models.field_visit import FieldVisit, VisitStatus
            stmt = select(FieldVisit).where(
                FieldVisit.employee_id == employee_id,
                FieldVisit.visit_date >= start_date,
                FieldVisit.visit_date <= end_date,
                FieldVisit.status == VisitStatus.COMPLETED.value,
            )
            res = await db.execute(stmt)
            visits = res.scalars().all()
            return [
                {
                    "source_event_id": v.id,
                    "source_event_type": "visit_completed",
                    "delta": Decimal("1.00"),
                    "occurred_at": v.completion_time or datetime.combine(v.visit_date, datetime.min.time()),
                    "business_date": v.visit_date,
                    "contributor_id": v.employee_id,
                }
                for v in visits
            ]
        return []
