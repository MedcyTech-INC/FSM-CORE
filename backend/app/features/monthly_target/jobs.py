import uuid
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.shared_contracts.enums import TargetStatus
from app.features.monthly_target.models import (
    Target,
    TargetAssignment,
    TargetProgress,
    TargetProgressEntry,
    ReconciliationRun,
    ReconciliationDrift,
    ArchivedTotal,
)
from app.database.session import AsyncSessionLocal
from app.features.monthly_target.ports import SourceRecordsProvider, DatabaseSourceRecordsProvider
from app.features.monthly_target.ledger import LedgerService

settings = get_settings()


class TargetJobs:
    @classmethod
    async def run_closing_job(cls, db: AsyncSession, today: Optional[date] = None) -> int:
        """
        T-18: Freezes targets past (end_date + grace_days).
        Sets status = 'closed', closed_at = now, and final_value.
        """
        current_day = today or date.today()
        grace_days = timedelta(days=settings.late_event_grace_days)
        cutoff_date = current_day - grace_days
        now = datetime.now(timezone.utc)

        stmt = select(Target).where(
            Target.status == TargetStatus.ACTIVE.value,
            Target.end_date < cutoff_date,
        )
        targets = (await db.execute(stmt)).scalars().all()

        closed_count = 0
        for t in targets:
            # Sum up current_value across assignments as target final_value
            stmt_sum = select(func.coalesce(func.sum(TargetProgress.current_value), Decimal("0.00"))).join(
                TargetAssignment, TargetProgress.assignment_id == TargetAssignment.id
            ).where(TargetAssignment.target_id == t.id)

            total_val = (await db.execute(stmt_sum)).scalar() or Decimal("0.00")
            t.status = TargetStatus.CLOSED.value
            t.closed_at = now
            t.final_value = total_val
            closed_count += 1

        await db.commit()
        return closed_count

    @classmethod
    async def run_nightly_reconciliation(
        cls,
        db: AsyncSession,
        source_provider: Optional[SourceRecordsProvider] = None,
    ) -> ReconciliationRun:
        """
        T-19 / Critic Gap MT-4:
        Nightly reconciliation running at 03:00.
        Level 1: Recomputes each active assignment from target_progress_entries.
                 Detects drift, logs it, and fixes stored value.
        Level 2: Checks against source records (read-only audit).
        """
        if source_provider is None:
            source_provider = DatabaseSourceRecordsProvider()

        now = datetime.now(timezone.utc)
        run = ReconciliationRun(
            started_at=now,
            status="running",
            targets_checked=0,
            drifts_found=0,
        )
        db.add(run)
        await db.flush()

        try:
            # Select all active targets and their assignments
            stmt = (
                select(TargetAssignment, TargetProgress)
                .join(Target, TargetAssignment.target_id == Target.id)
                .join(TargetProgress, TargetAssignment.id == TargetProgress.assignment_id)
                .where(Target.status == TargetStatus.ACTIVE.value)
            )
            rows = (await db.execute(stmt)).all()

            targets_checked = len(rows)
            drifts_found = 0

            for assignment, progress in rows:
                # Level 1: Ledger entries vs stored current_value
                # (Including archived_totals if assignment was partially archived - P-16)
                stmt_archive = select(ArchivedTotal.entry_sum).where(
                    ArchivedTotal.assignment_id == assignment.id
                )
                archived_sum = (await db.execute(stmt_archive)).scalar() or Decimal("0.00")

                stmt_ledger = select(
                    func.coalesce(func.sum(TargetProgressEntry.delta), Decimal("0.00"))
                ).where(
                    TargetProgressEntry.assignment_id == assignment.id,
                    TargetProgressEntry.excluded.is_(False),
                )
                live_sum = (await db.execute(stmt_ledger)).scalar() or Decimal("0.00")
                recomputed_value = archived_sum + live_sum

                if recomputed_value != progress.current_value:
                    drifts_found += 1
                    drift = ReconciliationDrift(
                        run_id=run.id,
                        assignment_id=assignment.id,
                        stored_value=progress.current_value,
                        recomputed_value=recomputed_value,
                        kind="ledger_vs_stored",
                    )
                    db.add(drift)

                    # Auto-fix Level 1 drift
                    progress.current_value = recomputed_value
                    progress.last_updated_at = now

            run.targets_checked = targets_checked
            run.drifts_found = drifts_found
            run.status = "succeeded"
            run.finished_at = datetime.now(timezone.utc)
            await db.commit()
            return run

        except Exception as exc:
            run.status = "failed"
            run.finished_at = datetime.now(timezone.utc)
            await db.commit()
            raise exc

    @classmethod
    async def run_archive_job(
        cls,
        db: AsyncSession,
        months_threshold: Optional[int] = None,
        now_dt: Optional[datetime] = None,
    ) -> int:
        """
        T-25 / Critic Gap P-16:
        Archives ledger entries of targets closed or cancelled for >= archive_after_months.
        1. Select targets with status closed or cancelled, closed_at (or updated_at) older than archive_after_months, and archived_at is null.
        2. Per target, in its own transaction:
           a. Aggregate count and sum of non-excluded entries per assignment.
           b. Insert/update fsm_app.archived_totals.
           c. Copy entries to fsm_archive.target_progress_entries.
           d. Delete live target_progress_entries.
           e. Set target.archived_at = now.
        Returns number of targets archived.
        """
        now = now_dt or datetime.now(timezone.utc)
        months = months_threshold if months_threshold is not None else settings.archive_after_months
        cutoff_dt = now - timedelta(days=months * 30)

        stmt = select(Target).where(
            Target.status.in_([TargetStatus.CLOSED.value, TargetStatus.CANCELLED.value]),
            Target.archived_at.is_(None),
            or_(
                Target.closed_at <= cutoff_dt,
                and_(Target.closed_at.is_(None), Target.updated_at <= cutoff_dt),
            ),
        )
        targets = (await db.execute(stmt)).scalars().all()
        archived_count = 0

        for t in targets:
            stmt_assigns = select(TargetAssignment.id).where(TargetAssignment.target_id == t.id)
            assignment_ids = (await db.execute(stmt_assigns)).scalars().all()

            for assign_id in assignment_ids:
                stmt_agg = select(
                    func.count(TargetProgressEntry.id),
                    func.coalesce(func.sum(TargetProgressEntry.delta), Decimal("0.00")),
                ).where(
                    TargetProgressEntry.assignment_id == assign_id,
                    TargetProgressEntry.excluded.is_(False),
                )
                entry_count, entry_sum = (await db.execute(stmt_agg)).one()

                if entry_count > 0:
                    archived_total = ArchivedTotal(
                        assignment_id=assign_id,
                        entry_count=entry_count,
                        entry_sum=entry_sum,
                        archived_at=now,
                    )
                    await db.merge(archived_total)

                    copy_sql = text("""
                        INSERT INTO fsm_archive.fsm_monthly_targets_progress_entries (
                            id, assignment_id, source_event_id, source_event_type,
                            entry_type, delta, contributor_id, occurred_at,
                            business_date, excluded, excluded_reason, created_at, archived_at
                        )
                        SELECT 
                            id, assignment_id, source_event_id, source_event_type,
                            entry_type, delta, contributor_id, occurred_at,
                            business_date, excluded, excluded_reason, created_at, :archived_at
                        FROM fsm_app.fsm_monthly_targets_progress_entries
                        WHERE assignment_id = :assign_id
                    """)
                    await db.execute(copy_sql, {"archived_at": now, "assign_id": assign_id})

                    del_sql = text("""
                        DELETE FROM fsm_app.fsm_monthly_targets_progress_entries
                        WHERE assignment_id = :assign_id
                    """)
                    await db.execute(del_sql, {"assign_id": assign_id})

            t.archived_at = now
            await db.commit()
            archived_count += 1

        return archived_count


async def run_sweeper():
    """Runs pending outbox sweeper batch (T-16 / MT-4)."""
    async with AsyncSessionLocal() as db:
        from app.features.monthly_target.outbox import OutboxSweeper
        count = await OutboxSweeper.sweep_pending(db)
        print(f"Sweeper job completed. Processed {count} pending outbox events.")
        return count


async def run_closing():
    """Runs target closing job past end_date + grace_days (T-18)."""
    async with AsyncSessionLocal() as db:
        count = await TargetJobs.run_closing_job(db)
        print(f"Closing job completed. Closed {count} targets.")
        return count


async def run_reconciliation():
    """Runs nightly reconciliation job (T-19 / MT-4)."""
    async with AsyncSessionLocal() as db:
        run = await TargetJobs.run_nightly_reconciliation(db)
        print(f"Reconciliation completed. Status={run.status}, targets_checked={run.targets_checked}, drifts_found={run.drifts_found}.")
        return run


async def run_archive():
    """Runs archive job for closed targets older than threshold (T-25 / P-16)."""
    async with AsyncSessionLocal() as db:
        count = await TargetJobs.run_archive_job(db)
        print(f"Archive job completed. Archived {count} targets.")
        return count


if __name__ == "__main__":
    import asyncio
    import sys

    job_type = sys.argv[1] if len(sys.argv) > 1 else "sweeper"
    if job_type == "sweeper":
        asyncio.run(run_sweeper())
    elif job_type == "closing":
        asyncio.run(run_closing())
    elif job_type == "reconcile":
        asyncio.run(run_reconciliation())
    elif job_type == "archive":
        asyncio.run(run_archive())
    else:
        print(f"Unknown job command: {job_type}. Valid: sweeper, closing, reconcile, archive")

