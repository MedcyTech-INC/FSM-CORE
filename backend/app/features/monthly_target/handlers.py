import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.shared_contracts.enums import (
    MetricType,
    EntityType,
    TargetStatus,
    EntryType,
)
from app.shared_contracts.events import (
    CURRENT_EVENT_VERSION,
    VisitCompletedEvent,
    VisitApprovedEvent,
    VisitRejectedEvent,
    VisitCancelledEvent,
    LeadCreatedEvent,
    LeadConvertedEvent,
    LeadConversionRevertedEvent,
    OrderClosedEvent,
    OrderCancelledEvent,
    CollectionRecordedEvent,
    CollectionBouncedEvent,
)
from app.features.monthly_target.models import (
    Target,
    TargetAssignment,
    TargetProgress,
    TargetProgressEntry,
    EventOutbox,
    ProcessedEvent,
    FailedEvent,
)
from app.features.monthly_target.ledger import LedgerService
from app.features.monthly_target.ports import MembershipProvider, DatabaseMembershipProvider
from app.features.monthly_target.run_rate import to_business_date

settings = get_settings()


class TargetEventHandler:
    """
    T-12 / T-13 / T-14 / T-15:
    Processes transactional outbox events into immutable ledger entries and updates progress.
    """
    @classmethod
    async def process_outbox_event(
        cls,
        db: AsyncSession,
        outbox_row: EventOutbox,
        membership_provider: Optional[MembershipProvider] = None,
    ) -> bool:
        if membership_provider is None:
            membership_provider = DatabaseMembershipProvider()

        # Step 1: Validate payload version
        if outbox_row.event_version != CURRENT_EVENT_VERSION:
            failed = FailedEvent(
                event_type=outbox_row.event_type,
                event_version=outbox_row.event_version,
                payload=outbox_row.payload,
                reason=f"Unknown event version: {outbox_row.event_version}",
            )
            db.add(failed)
            outbox_row.processed_at = datetime.now(timezone.utc)
            await db.commit()
            return False

        # Step 2: Idempotency check against processed_events (Critic Gap NF-6)
        stmt_proc = select(ProcessedEvent).where(ProcessedEvent.event_id == outbox_row.id)
        if (await db.execute(stmt_proc)).scalar_one_or_none():
            outbox_row.processed_at = datetime.now(timezone.utc)
            await db.commit()
            return True

        # Step 3: Handle reversals vs contributions
        event_type = outbox_row.event_type
        payload = outbox_row.payload

        if event_type in ["visit_rejected", "visit_cancelled", "order_cancelled", "lead_conversion_reverted", "collection_bounced"]:
            return await cls._handle_reversal(db, outbox_row, payload)
        else:
            return await cls._handle_contribution(db, outbox_row, payload, membership_provider)

    @classmethod
    async def _handle_reversal(
        cls,
        db: AsyncSession,
        outbox_row: EventOutbox,
        payload: dict,
    ) -> bool:
        """
        T-13 / Critic Gap MT-3:
        Finds original contribution entries and creates reversal entries on exactly
        the targets that were originally credited (preserving past attribution).
        """
        original_event_id = uuid.UUID(payload["original_event_id"])
        now = datetime.now(timezone.utc)

        # Find all original contributions created by this event
        stmt_orig = select(TargetProgressEntry).where(
            TargetProgressEntry.source_event_id == original_event_id,
            TargetProgressEntry.entry_type == EntryType.CONTRIBUTION.value,
        )
        orig_entries = (await db.execute(stmt_orig)).scalars().all()

        if not orig_entries:
            # Reversal arrived before original event: leave in outbox for sweeper retry (Section 5.3)
            age = (now - outbox_row.created_at).total_seconds()
            if age > 86400:  # 24 hours
                failed = FailedEvent(
                    event_type=outbox_row.event_type,
                    event_version=outbox_row.event_version,
                    payload=payload,
                    reason="Reversal arrived before original contribution and expired after 24h retry",
                )
                db.add(failed)
                outbox_row.processed_at = now
                await db.commit()
            return False

        # Post negative reversal entries
        for orig in orig_entries:
            # Check target closed state: if target is closed, set adjusted_at
            stmt_t = select(Target).join(TargetAssignment, Target.id == TargetAssignment.target_id).where(
                TargetAssignment.id == orig.assignment_id
            )
            target = (await db.execute(stmt_t)).scalar_one_or_none()

            reversal_delta = -abs(orig.delta)
            b_date = to_business_date(now, settings.business_tz)

            await LedgerService.record_entry(
                db=db,
                assignment_id=orig.assignment_id,
                source_event_id=original_event_id,
                source_event_type=outbox_row.event_type,
                entry_type=EntryType.REVERSAL.value,
                delta=reversal_delta,
                contributor_id=orig.contributor_id,
                occurred_at=now,
                business_date=b_date,
            )

            if target and target.status == TargetStatus.CLOSED.value:
                target.adjusted_at = now

        # Mark processed
        proc = ProcessedEvent(event_id=outbox_row.id, event_type=outbox_row.event_type)
        db.add(proc)
        outbox_row.processed_at = now
        await db.commit()
        return True

    @classmethod
    async def _handle_contribution(
        cls,
        db: AsyncSession,
        outbox_row: EventOutbox,
        payload: dict,
        membership_provider: MembershipProvider,
    ) -> bool:
        """
        T-12: Fan-out event to rep, team, territory, and branch targets with atomic ledger insert.
        """
        event_type = outbox_row.event_type
        now = datetime.now(timezone.utc)

        # Extract delta and metric type
        if event_type == "visit_completed":
            if settings.visit_counting_mode == "approval":
                # In approval mode, submitted visit is ignored (D1)
                proc = ProcessedEvent(event_id=outbox_row.id, event_type=event_type)
                db.add(proc)
                outbox_row.processed_at = now
                await db.commit()
                return True

            if not payload.get("is_valid_geofence", True):
                # Geofence invalid: do not count
                proc = ProcessedEvent(event_id=outbox_row.id, event_type=event_type)
                db.add(proc)
                outbox_row.processed_at = now
                await db.commit()
                return True

            metric_type = MetricType.DOCTOR_VISITS.value
            delta = Decimal("1.00")
            rep_id = uuid.UUID(payload["representative_id"])
            occurred_at = datetime.fromisoformat(payload["completed_at"])

        elif event_type == "visit_approved":
            metric_type = MetricType.DOCTOR_VISITS.value
            delta = Decimal("1.00")
            rep_id = uuid.UUID(payload["representative_id"])
            occurred_at = datetime.fromisoformat(payload["approved_at"])

        elif event_type == "lead_created":
            metric_type = MetricType.NEW_LEADS.value
            delta = Decimal("1.00")
            rep_id = uuid.UUID(payload["representative_id"])
            occurred_at = datetime.fromisoformat(payload["created_at"])

        elif event_type == "lead_converted":
            metric_type = MetricType.CONVERSIONS.value
            delta = Decimal("1.00")
            rep_id = uuid.UUID(payload["representative_id"])
            occurred_at = datetime.fromisoformat(payload["converted_at"])

        elif event_type == "order_closed":
            metric_type = MetricType.REVENUE.value
            delta = Decimal(str(payload["order_value"]))
            rep_id = uuid.UUID(payload["representative_id"])
            occurred_at = datetime.fromisoformat(payload["closed_at"])

        elif event_type == "collection_recorded":
            metric_type = MetricType.COLLECTIONS.value
            delta = Decimal(str(payload["amount"]))
            rep_id = uuid.UUID(payload["representative_id"])
            occurred_at = datetime.fromisoformat(payload["recorded_at"])

        else:
            # Unknown event type
            return True

        # Convert to business date
        business_date = to_business_date(occurred_at, settings.business_tz)

        # Resolve org membership as of occurred_at timestamp (T-14 / MT-13)
        membership = await membership_provider.get_membership_at(db, rep_id, occurred_at)
        team_id = membership[0] if membership else None
        territory_id = membership[1] if membership else None
        branch_id = membership[2] if membership else None

        # Build entity matches
        entity_conditions = [
            and_(
                TargetAssignment.entity_type == EntityType.REPRESENTATIVE.value,
                TargetAssignment.entity_id == rep_id,
            )
        ]
        if team_id:
            entity_conditions.append(
                and_(
                    TargetAssignment.entity_type == EntityType.TEAM.value,
                    TargetAssignment.entity_id == team_id,
                )
            )
        if territory_id:
            entity_conditions.append(
                and_(
                    TargetAssignment.entity_type == EntityType.TERRITORY.value,
                    TargetAssignment.entity_id == territory_id,
                )
            )
        if branch_id:
            entity_conditions.append(
                and_(
                    TargetAssignment.entity_type == EntityType.BRANCH.value,
                    TargetAssignment.entity_id == branch_id,
                )
            )

        # Query matching targets
        # Late event grace window: end_date + grace_days
        grace_days = timedelta(days=settings.late_event_grace_days)

        stmt_targets = (
            select(Target, TargetAssignment)
            .join(TargetAssignment, Target.id == TargetAssignment.target_id)
            .where(
                Target.metric_type == metric_type,
                Target.status.in_([TargetStatus.ACTIVE.value, TargetStatus.CLOSED.value]),
                Target.start_date <= business_date,
                Target.end_date + grace_days >= business_date,
                or_(
                    TargetAssignment.ended_at.is_(None),
                    TargetAssignment.ended_at >= occurred_at,
                ),
                or_(*entity_conditions),
            )
        )
        res = await db.execute(stmt_targets)
        matches = res.all()

        for target, assignment in matches:
            # Insert ledger entry and update progress
            await LedgerService.record_entry(
                db=db,
                assignment_id=assignment.id,
                source_event_id=outbox_row.id,
                source_event_type=event_type,
                entry_type=EntryType.CONTRIBUTION.value,
                delta=delta,
                contributor_id=rep_id,
                occurred_at=occurred_at,
                business_date=business_date,
            )

            # If event arrived after target was already closed, mark adjusted_at
            if target.status == TargetStatus.CLOSED.value:
                target.adjusted_at = now

        # Record deduplication marker
        proc = ProcessedEvent(event_id=outbox_row.id, event_type=event_type)
        db.add(proc)
        outbox_row.processed_at = now

        await db.commit()
        return True
