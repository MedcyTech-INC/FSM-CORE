import uuid
from datetime import date, datetime, timezone
from typing import Dict, List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.revenue_leakage.models import AlertNotification, LeakageAlert
from app.features.revenue_leakage.ports import Notifier
from app.features.revenue_leakage.recipients import RecipientResolver


class NotificationManager:
    def __init__(self, notifier: Notifier, recipient_resolver: RecipientResolver):
        self.notifier = notifier
        self.recipient_resolver = recipient_resolver

    async def notify_alert(
        self,
        db: AsyncSession,
        alert: LeakageAlert,
        kind: str,  # 'created', 'priority_raised', 'escalated'
        is_baseline: bool = False,
    ) -> None:
        """
        Processes notifications for an alert:
        - If baseline mode: suppresses immediate notification (baseline sends summary message once per manager).
        - If high priority or escalated: sends immediate notification right away.
        - If low or medium: records pending notification for the daily digest.
        """
        recipients = await self.recipient_resolver.get_recipients(
            db, alert.entity_type, alert.entity_id, escalation_level=alert.escalation_level
        )

        now = datetime.now(timezone.utc)
        for recipient_id in recipients:
            # Check deduplication: (alert_id, recipient_id, kind, attention_priority)
            existing = await db.execute(
                select(AlertNotification).where(
                    and_(
                        AlertNotification.alert_id == alert.id,
                        AlertNotification.recipient_id == recipient_id,
                        AlertNotification.kind == kind,
                        AlertNotification.attention_priority == alert.attention_priority,
                    )
                )
            )
            if existing.scalar_one_or_none():
                continue

            # In baseline mode, we do not send immediate per-alert notifications
            if is_baseline:
                continue

            notif = AlertNotification(
                id=uuid.uuid4(),
                alert_id=alert.id,
                recipient_id=recipient_id,
                kind=kind,
                attention_priority=alert.attention_priority,
                status="pending",
                digest_date=None if alert.attention_priority == "high" or kind == "escalated" else now.date(),
                created_at=now,
            )
            db.add(notif)
            alert.last_notified_at = now

            if alert.attention_priority == "high" or kind == "escalated":
                # Send immediate
                title = f"High Attention Required: {alert.entity_type.capitalize()} Alert"
                if kind == "escalated":
                    title = f"Escalated Alert (Level {alert.escalation_level}): {alert.entity_type.capitalize()}"

                msg = f"{alert.priority_reason}"
                sent = await self.notifier.send_immediate(db, alert.id, recipient_id, title, msg)
                if sent:
                    notif.status = "sent"
                    notif.sent_at = now

        await db.commit()

    async def send_daily_digests(self, db: AsyncSession, digest_date: date) -> int:
        """
        Collects pending digest notifications for the day and sends one digest per manager.
        """
        stmt = select(AlertNotification).where(
            and_(
                AlertNotification.status == "pending",
                AlertNotification.digest_date == digest_date,
            )
        )
        res = await db.execute(stmt)
        pending_notifs = res.scalars().all()

        by_recipient: Dict[uuid.UUID, List[AlertNotification]] = {}
        for notif in pending_notifs:
            by_recipient.setdefault(notif.recipient_id, []).append(notif)

        sent_count = 0
        now = datetime.now(timezone.utc)
        for recipient_id, notifs in by_recipient.items():
            alert_ids = [n.alert_id for n in notifs]
            success = await self.notifier.send_digest(db, recipient_id, digest_date, alert_ids)
            if success:
                for n in notifs:
                    n.status = "sent"
                    n.sent_at = now
                sent_count += 1

        await db.commit()
        return sent_count
