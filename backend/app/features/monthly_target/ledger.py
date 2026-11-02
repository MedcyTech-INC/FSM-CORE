import uuid
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

SCHEMA = "fsm_app"
PREFIX = "fsm_monthly_targets_"


class LedgerService:
    @staticmethod
    async def record_entry(
        db: AsyncSession,
        assignment_id: uuid.UUID,
        source_event_id: uuid.UUID,
        source_event_type: str,
        entry_type: str,
        delta: Decimal,
        contributor_id: uuid.UUID,
        occurred_at: datetime,
        business_date: date,
        excluded: bool = False,
        excluded_reason: str = None,
    ) -> bool:
        """
        T-12: Inserts a single ledger entry with ON CONFLICT DO NOTHING.
        Only when a row was inserted, updates target_progress.current_value atomically.
        Guarantees that replayed/duplicate events never double-count.
        """
        insert_sql = text(f"""
            INSERT INTO {SCHEMA}.{PREFIX}progress_entries (
                id, assignment_id, source_event_id, source_event_type,
                entry_type, delta, contributor_id, occurred_at,
                business_date, excluded, excluded_reason, created_at
            ) VALUES (
                gen_random_uuid(), :assignment_id, :source_event_id, :source_event_type,
                :entry_type, :delta, :contributor_id, :occurred_at,
                :business_date, :excluded, :excluded_reason, now()
            )
            ON CONFLICT (assignment_id, source_event_id, entry_type) DO NOTHING
            RETURNING id;
        """)

        res = await db.execute(
            insert_sql,
            {
                "assignment_id": assignment_id,
                "source_event_id": source_event_id,
                "source_event_type": source_event_type,
                "entry_type": entry_type,
                "delta": delta,
                "contributor_id": contributor_id,
                "occurred_at": occurred_at,
                "business_date": business_date,
                "excluded": excluded,
                "excluded_reason": excluded_reason,
            },
        )
        row = res.first()

        if row and not excluded:
            # Row was newly inserted and not excluded: update progress atomically
            update_sql = text(f"""
                UPDATE {SCHEMA}.{PREFIX}progress
                SET current_value = current_value + :delta,
                    last_updated_at = now()
                WHERE assignment_id = :assignment_id;
            """)
            await db.execute(update_sql, {"delta": delta, "assignment_id": assignment_id})
            return True

        return False

    @staticmethod
    async def recompute_progress(db: AsyncSession, assignment_id: uuid.UUID) -> Decimal:
        """
        Recomputes target_progress.current_value as the sum of non-excluded ledger entries.
        Used after dates are adjusted or during nightly reconciliation.
        """
        sql = text(f"""
            WITH entry_sum AS (
                SELECT COALESCE(SUM(delta), 0.00) AS total
                FROM {SCHEMA}.{PREFIX}progress_entries
                WHERE assignment_id = :assignment_id AND excluded = FALSE
            )
            UPDATE {SCHEMA}.{PREFIX}progress
            SET current_value = entry_sum.total,
                last_updated_at = now()
            FROM entry_sum
            WHERE {SCHEMA}.{PREFIX}progress.assignment_id = :assignment_id
            RETURNING current_value;
        """)
        res = await db.execute(sql, {"assignment_id": assignment_id})
        val = res.scalar() or Decimal("0.00")
        return val
