import uuid
from datetime import date
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.monthly_target.models import Target, TargetAssignment
from app.features.monthly_target.ledger import LedgerService
from app.features.monthly_target.ports import SourceRecordsProvider, DatabaseSourceRecordsProvider
from app.shared_contracts.enums import EntityType, EntryType


class BackfillService:
    @staticmethod
    async def backfill_target(
        db: AsyncSession,
        target: Target,
        assignments: List[TargetAssignment],
        records_provider: SourceRecordsProvider = None,
        today: date = None,
    ) -> int:
        """
        T-10 / Critic Gap MT-1: Replays historical qualifying records from start_date
        up to min(end_date, today) through the ledger engine.
        Progress starts accurate rather than at zero.
        """
        if records_provider is None:
            records_provider = DatabaseSourceRecordsProvider()

        current_day = today or date.today()
        if target.start_date >= current_day:
            return 0  # Not backdated

        cutoff_date = min(target.end_date, current_day)
        total_backfilled = 0

        for assignment in assignments:
            # Currently supported for representative assignments
            if assignment.entity_type == EntityType.REPRESENTATIVE.value:
                records = await records_provider.get_qualifying_records(
                    db=db,
                    metric_type=target.metric_type,
                    employee_id=assignment.entity_id,
                    start_date=target.start_date,
                    end_date=cutoff_date,
                )

                for rec in records:
                    inserted = await LedgerService.record_entry(
                        db=db,
                        assignment_id=assignment.id,
                        source_event_id=rec["source_event_id"],
                        source_event_type=rec["source_event_type"],
                        entry_type=EntryType.CONTRIBUTION.value,
                        delta=rec["delta"],
                        contributor_id=rec["contributor_id"],
                        occurred_at=rec["occurred_at"],
                        business_date=rec["business_date"],
                        excluded=False,
                    )
                    if inserted:
                        total_backfilled += 1

        return total_backfilled
