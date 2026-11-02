import uuid
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select, and_, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.revenue_leakage.models import (
    LeakageRule,
    LeakageAlert,
    AlertAction,
    AlertObservation,
    AlertChain,
    AttentionPriority,
    AlertStatus,
    ActionType,
    Outcome,
    ObservationReason,
    SCHEMA,
    PREFIX,
)
from app.features.revenue_leakage.ports import RuleFinding
from app.features.revenue_leakage.priority import calculate_priority_and_reason
from app.core.errors import version_conflict, FSMException


class AlertClosedException(FSMException):
    def __init__(self, message: str = "Alert is already resolved or dismissed"):
        super().__init__(status_code=409, code="alert_closed", message=message)


class LifecycleService:
    @classmethod
    async def process_finding(
        cls,
        db: AsyncSession,
        rule: LeakageRule,
        finding: RuleFinding,
        now: Optional[datetime] = None,
    ) -> Tuple[Optional[LeakageAlert], bool]:
        """
        T-08 / T-09 / Section 5.3 & 5.4:
        Handles upsert, recurrence, suppression, and conditional observation logging.
        Returns: (alert, was_created_boolean)
        """
        current_time = now or datetime.now(timezone.utc)

        # 1. Check AlertChain for suppression or recurrence
        stmt_chain = select(AlertChain).where(
            AlertChain.rule_id == rule.id,
            AlertChain.entity_type == finding.entity_type,
            AlertChain.entity_id == finding.entity_id,
        )
        chain = (await db.execute(stmt_chain)).scalar_one_or_none()

        if chain and chain.suppressed_until and chain.suppressed_until > current_time:
            # Under active suppression / cool-down (RL-1 / 5.4):
            # Log suppressed_recurrence observation on previous alert and do not raise new alert.
            obs_row = AlertObservation(
                id=uuid.uuid4(),
                alert_id=chain.last_alert_id,
                observed_at=current_time,
                observation=finding.observation_data,
                attention_priority=AttentionPriority.LOW.value,
                reason=ObservationReason.SUPPRESSED_RECURRENCE.value,
            )
            db.add(obs_row)
            await db.commit()
            return None, False

        # 2. Calculate priority and reason
        priority, ratio, reason_text = calculate_priority_and_reason(
            observed_value=finding.observed_value,
            threshold=finding.threshold,
            medium_priority_ratio=rule.medium_priority_ratio,
            high_priority_ratio=rule.high_priority_ratio,
            unit_description=finding.unit_description,
        )

        obs_payload = dict(finding.observation_data)
        obs_payload["ratio"] = float(ratio)
        obs_payload["threshold_used"] = float(finding.threshold)
        obs_payload["medium_ratio_used"] = float(rule.medium_priority_ratio)
        obs_payload["high_ratio_used"] = float(rule.high_priority_ratio)

        # 3. Check for existing active/acknowledged alert
        stmt_active = select(LeakageAlert).where(
            LeakageAlert.rule_id == rule.id,
            LeakageAlert.entity_type == finding.entity_type,
            LeakageAlert.entity_id == finding.entity_id,
            LeakageAlert.status.in_([AlertStatus.ACTIVE.value, AlertStatus.ACKNOWLEDGED.value]),
        )
        existing_alert = (await db.execute(stmt_active)).scalar_one_or_none()

        if existing_alert:
            # Conflict update: update last_observed_at and clear streak
            old_priority = existing_alert.attention_priority
            old_obs = existing_alert.observation or {}
            old_val = Decimal(str(old_obs.get("working_days_overdue") or old_obs.get("latest_fall_percent") or old_obs.get("pace_shortfall_points") or 0))

            existing_alert.last_observed_at = current_time
            existing_alert.observation = obs_payload
            existing_alert.attention_priority = priority.value
            existing_alert.priority_reason = reason_text
            existing_alert.clear_streak = 0

            # Check observation writing triggers (Section 5.3)
            # Case 2: Priority changed
            if priority.value != old_priority:
                db.add(
                    AlertObservation(
                        id=uuid.uuid4(),
                        alert_id=existing_alert.id,
                        observed_at=current_time,
                        observation=obs_payload,
                        attention_priority=priority.value,
                        reason=ObservationReason.PRIORITY_CHANGED.value,
                    )
                )
            # Case 3: Value moved by >= change_ratio
            elif old_val > Decimal("0") and abs(finding.observed_value - old_val) / old_val >= rule.change_ratio:
                db.add(
                    AlertObservation(
                        id=uuid.uuid4(),
                        alert_id=existing_alert.id,
                        observed_at=current_time,
                        observation=obs_payload,
                        attention_priority=priority.value,
                        reason=ObservationReason.VALUE_CHANGED.value,
                    )
                )

            await db.commit()
            return existing_alert, False

        # 4. New Alert (First episode or Recurrence)
        occurrence_no = (chain.last_occurrence_no + 1) if chain else 1
        previous_alert_id = chain.last_alert_id if chain else None

        new_alert = LeakageAlert(
            id=uuid.uuid4(),
            rule_id=rule.id,
            entity_type=finding.entity_type,
            entity_id=finding.entity_id,
            attention_priority=priority.value,
            priority_reason=reason_text,
            observation=obs_payload,
            exposure_amount=finding.exposure_amount,
            exposure_basis=finding.exposure_basis,
            status=AlertStatus.ACTIVE.value,
            version=1,
            occurrence_no=occurrence_no,
            previous_alert_id=previous_alert_id,
            first_detected_at=current_time,
            last_observed_at=current_time,
            clear_streak=0,
        )
        db.add(new_alert)

        # Observation Case 1: Created
        db.add(
            AlertObservation(
                id=uuid.uuid4(),
                alert_id=new_alert.id,
                observed_at=current_time,
                observation=obs_payload,
                attention_priority=priority.value,
                reason=ObservationReason.CREATED.value,
            )
        )

        # Update or create AlertChain
        if chain:
            chain.last_alert_id = new_alert.id
            chain.last_occurrence_no = occurrence_no
            chain.suppressed_until = None
            chain.updated_at = current_time
        else:
            db.add(
                AlertChain(
                    rule_id=rule.id,
                    entity_type=finding.entity_type,
                    entity_id=finding.entity_id,
                    last_alert_id=new_alert.id,
                    last_occurrence_no=1,
                    suppressed_until=None,
                    updated_at=current_time,
                )
            )

        await db.commit()
        await db.refresh(new_alert)
        return new_alert, True

    @classmethod
    async def record_user_action(
        cls,
        db: AsyncSession,
        alert_id: uuid.UUID,
        actor_id: uuid.UUID,
        action_type: ActionType,
        expected_version: int,
        action_taken: str,
        outcome: Optional[Outcome] = None,
        evidence_reference: Optional[str] = None,
        notes: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> LeakageAlert:
        """
        T-11 / Section 5.5:
        Records manager action, checks version, applies outcome suppression.
        """
        stmt = select(LeakageAlert).where(LeakageAlert.id == alert_id).with_for_update()
        alert = (await db.execute(stmt)).scalar_one_or_none()

        if not alert:
            from app.core.errors import not_found
            raise not_found("Alert not found")

        # Check if already resolved / dismissed (Section 6.3)
        if alert.status in [AlertStatus.RESOLVED.value, AlertStatus.DISMISSED.value]:
            raise AlertClosedException()

        # Optimistic concurrency check (RL-11)
        if alert.version != expected_version:
            raise version_conflict(current_version=alert.version)

        # Check idempotency
        if idempotency_key:
            stmt_idemp = select(AlertAction).where(
                AlertAction.alert_id == alert_id,
                AlertAction.idempotency_key == idempotency_key,
            )
            existing_act = (await db.execute(stmt_idemp)).scalar_one_or_none()
            if existing_act:
                return alert

        now = datetime.now(timezone.utc)
        alert.version += 1

        # Read rule for cooldown/dismiss days
        stmt_rule = select(LeakageRule).where(LeakageRule.id == alert.rule_id)
        rule = (await db.execute(stmt_rule)).scalar_one()

        if action_type == ActionType.ACKNOWLEDGED:
            alert.status = AlertStatus.ACKNOWLEDGED.value
        elif action_type == ActionType.RESOLVED:
            alert.status = AlertStatus.RESOLVED.value
            alert.resolved_at = now
            if outcome == Outcome.NORMAL_VARIATION:
                alert.suppressed_until = now + timedelta(days=rule.cooldown_days)
        elif action_type == ActionType.DISMISSED:
            alert.status = AlertStatus.DISMISSED.value
            alert.resolved_at = now
            alert.suppressed_until = now + timedelta(days=rule.dismiss_days)

        # Write AlertAction
        action_row = AlertAction(
            id=uuid.uuid4(),
            alert_id=alert.id,
            action_type=action_type.value,
            outcome=outcome.value if outcome else None,
            action_taken=action_taken,
            evidence_reference=evidence_reference,
            notes=notes,
            action_by=actor_id,
            idempotency_key=idempotency_key,
            created_at=now,
        )
        db.add(action_row)

        # If closing: write observation Case 4 (resolved)
        if alert.status in [AlertStatus.RESOLVED.value, AlertStatus.DISMISSED.value]:
            db.add(
                AlertObservation(
                    id=uuid.uuid4(),
                    alert_id=alert.id,
                    observed_at=now,
                    observation=alert.observation,
                    attention_priority=alert.attention_priority,
                    reason=ObservationReason.RESOLVED.value,
                )
            )

            # Update AlertChain
            stmt_chain = select(AlertChain).where(
                AlertChain.rule_id == alert.rule_id,
                AlertChain.entity_type == alert.entity_type,
                AlertChain.entity_id == alert.entity_id,
            )
            chain = (await db.execute(stmt_chain)).scalar_one_or_none()
            if chain:
                chain.last_closed_at = now
                chain.suppressed_until = alert.suppressed_until
                chain.updated_at = now

        await db.commit()
        await db.refresh(alert)
        return alert

    @classmethod
    async def auto_clear_unseen_alerts(
        cls,
        db: AsyncSession,
        rule: LeakageRule,
        seen_entity_ids: List[uuid.UUID],
        skipped_entity_ids: Optional[List[uuid.UUID]] = None,
        now: Optional[datetime] = None,
    ) -> int:
        """
        T-10 / Section 5.4:
        Increments clear_streak for unseen alerts of this rule.
        At autoclear_scans (default 2), auto-resolves with condition_cleared.
        """
        current_time = now or datetime.now(timezone.utc)
        skip_set = set(skipped_entity_ids or [])
        seen_set = set(seen_entity_ids)

        stmt = select(LeakageAlert).where(
            LeakageAlert.rule_id == rule.id,
            LeakageAlert.status.in_([AlertStatus.ACTIVE.value, AlertStatus.ACKNOWLEDGED.value]),
        ).with_for_update()

        active_alerts = (await db.execute(stmt)).scalars().all()
        cleared_count = 0

        system_user_id = uuid.UUID("00000000-0000-0000-0000-000000000000")

        for alert in active_alerts:
            # If the entity was evaluated and present in this run, do not advance streak
            if alert.entity_id in seen_set:
                continue

            # If the entity was skipped (e.g. rep not synced), do not advance streak (RL-13)
            if alert.entity_id in skip_set:
                continue

            alert.clear_streak += 1

            if alert.clear_streak >= rule.autoclear_scans:
                alert.status = AlertStatus.RESOLVED.value
                alert.resolved_at = current_time
                alert.version += 1

                # Write Action
                db.add(
                    AlertAction(
                        id=uuid.uuid4(),
                        alert_id=alert.id,
                        action_type=ActionType.AUTO_CLEARED.value,
                        outcome=Outcome.CONDITION_CLEARED.value,
                        action_taken="Condition cleared on consecutive automated scans",
                        action_by=system_user_id,
                        created_at=current_time,
                    )
                )

                # Write Observation
                db.add(
                    AlertObservation(
                        id=uuid.uuid4(),
                        alert_id=alert.id,
                        observed_at=current_time,
                        observation=alert.observation,
                        attention_priority=alert.attention_priority,
                        reason=ObservationReason.RESOLVED.value,
                    )
                )

                # Update Chain
                stmt_chain = select(AlertChain).where(
                    AlertChain.rule_id == alert.rule_id,
                    AlertChain.entity_type == alert.entity_type,
                    AlertChain.entity_id == alert.entity_id,
                )
                chain = (await db.execute(stmt_chain)).scalar_one_or_none()
                if chain:
                    chain.last_closed_at = current_time
                    chain.updated_at = current_time

                cleared_count += 1

        await db.commit()
        return cleared_count


class AlertLifecycle(LifecycleService):
    @classmethod
    async def upsert_finding(
        cls, db: AsyncSession, rule: LeakageRule, finding: RuleFinding, now: Optional[datetime] = None
    ) -> Tuple[Optional[LeakageAlert], bool, bool]:
        alert, was_created = await cls.process_finding(db, rule, finding, now)
        return alert, was_created, False

    @classmethod
    async def record_action(
        cls,
        db: AsyncSession,
        alert: LeakageAlert,
        action_type: str,
        expected_version: int,
        outcome: Optional[str] = None,
        action_taken: str = "",
        evidence_reference: Optional[str] = None,
        notes: Optional[str] = None,
        action_by: Optional[uuid.UUID] = None,
        idempotency_key: Optional[str] = None,
    ) -> LeakageAlert:
        from app.features.revenue_leakage.models import ActionType, Outcome
        act_enum = ActionType(action_type)
        out_enum = Outcome(outcome) if outcome else None
        return await cls.record_user_action(
            db=db,
            alert_id=alert.id,
            actor_id=action_by or uuid.UUID("00000000-0000-0000-0000-000000000001"),
            action_type=act_enum,
            expected_version=expected_version,
            action_taken=action_taken,
            outcome=out_enum,
            evidence_reference=evidence_reference,
            notes=notes,
            idempotency_key=idempotency_key,
        )

    @classmethod
    async def auto_clear_absent_entities(
        cls,
        db: AsyncSession,
        rule_id: uuid.UUID,
        autoclear_scans: int,
        seen_entities: Any,
        system_user_id: uuid.UUID,
        now: Optional[datetime] = None,
    ) -> int:
        stmt_rule = select(LeakageRule).where(LeakageRule.id == rule_id)
        rule = (await db.execute(stmt_rule)).scalar_one()
        seen_ids = [e[1] if isinstance(e, tuple) else e for e in seen_entities]
        return await cls.auto_clear_unseen_alerts(db, rule, seen_ids, now=now)

