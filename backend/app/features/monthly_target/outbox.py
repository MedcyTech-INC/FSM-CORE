import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import select, and_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.monthly_target.models import EventOutbox, FailedEvent
from app.features.monthly_target.handlers import TargetEventHandler
from app.features.monthly_target.ports import MembershipProvider


class OutboxSweeper:
    """
    T-16 / Critic Gap MT-4:
    Background sweeper picking up pending outbox rows, retrying with backoff,
    and routing dead-letter rows to failed_events after 10 failed attempts.
    """
    @staticmethod
    def calculate_backoff(attempts: int) -> int:
        """Calculates exponential backoff delay in seconds, capped at 15 minutes (900s)."""
        return min(900, 2 ** (attempts + 1))

    @classmethod
    async def process_single_row(
        cls,
        db: AsyncSession,
        row_id: uuid.UUID,
        membership_provider: Optional[MembershipProvider] = None,
    ) -> bool:
        stmt = select(EventOutbox).where(EventOutbox.id == row_id).with_for_update(skip_locked=True)
        outbox_row = (await db.execute(stmt)).scalar_one_or_none()

        if not outbox_row or outbox_row.processed_at is not None:
            return False

        try:
            success = await TargetEventHandler.process_outbox_event(
                db=db,
                outbox_row=outbox_row,
                membership_provider=membership_provider,
            )
            return success
        except Exception as exc:
            await db.rollback()
            outbox_row.attempts += 1
            outbox_row.last_error = str(exc)

            if outbox_row.attempts >= 10:
                # Move to failed_events dead letter
                failed = FailedEvent(
                    event_type=outbox_row.event_type,
                    event_version=outbox_row.event_version,
                    payload=outbox_row.payload,
                    reason=f"Exhausted 10 retries: {str(exc)}",
                )
                db.add(failed)
                outbox_row.processed_at = datetime.now(timezone.utc)

            await db.commit()
            return False

    @classmethod
    async def sweep_pending(
        cls,
        db: AsyncSession,
        batch_size: int = 100,
        membership_provider: Optional[MembershipProvider] = None,
    ) -> int:
        """
        Picks pending rows created more than 30s ago in batches of up to 100,
        using FOR UPDATE SKIP LOCKED.
        """
        threshold = datetime.now(timezone.utc) - timedelta(seconds=30)
        stmt = (
            select(EventOutbox.id)
            .where(
                EventOutbox.processed_at.is_(None),
                EventOutbox.created_at <= threshold,
            )
            .order_by(EventOutbox.created_at.asc())
            .limit(batch_size)
        )
        row_ids = (await db.execute(stmt)).scalars().all()

        processed_count = 0
        for rid in row_ids:
            success = await cls.process_single_row(db, rid, membership_provider=membership_provider)
            if success:
                processed_count += 1

        return processed_count
