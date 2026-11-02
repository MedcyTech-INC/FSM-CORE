import asyncio
import sys
import uuid
from datetime import datetime, timezone
from sqlalchemy import select, and_
from app.database.session import AsyncSessionLocal
from app.features.revenue_leakage.calendar import WorkingCalendar
from app.features.revenue_leakage.models import AlertAction, LeakageAlert, LeakageRule
from app.features.revenue_leakage.notifications import NotificationManager
from app.features.revenue_leakage.ports import FakeNotifier, FakeOrgProvider
from app.features.revenue_leakage.recipients import RecipientResolver
from app.features.revenue_leakage.scanner import LeakageScanner


async def run_nightly_scan():
    """Runs the nightly scan across all 5 operational warning rules."""
    async with AsyncSessionLocal() as db:
        scanner = LeakageScanner()
        runs = await scanner.scan_all_rules(db)
        print(f"Nightly scan completed with {len(runs)} rule runs.")
        for r in runs:
            print(f"Rule {r.rule_code}: status={r.status}, created={r.alerts_created}, cleared={r.alerts_cleared}")


async def run_daily_digest():
    """Dispatches daily notification digests to managers."""
    async with AsyncSessionLocal() as db:
        org_provider = FakeOrgProvider()
        notifier = FakeNotifier()
        mgr = NotificationManager(notifier, RecipientResolver(org_provider))
        today = datetime.now(timezone.utc).date()
        sent = await mgr.send_daily_digests(db, today)
        print(f"Daily digest completed. Dispatched {sent} manager digests.")


async def run_escalation():
    """
    Checks active alerts that exceed escalation_days working days without acknowledgment.
    Escalates to next level, updates escalation_level and escalated_at, logs alert_action.
    """
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        today = now.date()
        system_user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
        org_provider = FakeOrgProvider()
        notifier = FakeNotifier()
        mgr = NotificationManager(notifier, RecipientResolver(org_provider))

        # Fetch active alerts
        stmt = select(LeakageAlert).join(LeakageRule).where(LeakageAlert.status == "active")
        res = await db.execute(stmt)
        active_alerts = res.scalars().all()

        escalated_count = 0
        for alert in active_alerts:
            rule = alert.rule
            if not rule:
                continue
            working_days = await WorkingCalendar.count_working_days(
                db, alert.first_detected_at.date(), today
            )
            if working_days >= rule.escalation_days and alert.escalation_level == 0:
                alert.escalation_level = 1
                alert.escalated_at = now
                alert.version += 1

                action = AlertAction(
                    id=uuid.uuid4(),
                    alert_id=alert.id,
                    action_type="escalated",
                    outcome=None,
                    action_taken=f"Auto-escalated to Level 1 after {working_days} working days unacknowledged",
                    evidence_reference=None,
                    notes=None,
                    action_by=system_user_id,
                    created_at=now,
                )
                db.add(action)
                await mgr.notify_alert(db, alert, kind="escalated")
                escalated_count += 1

        await db.commit()
        print(f"Escalation job completed. Escalated {escalated_count} unacknowledged alerts.")


if __name__ == "__main__":
    job_type = sys.argv[1] if len(sys.argv) > 1 else "scan"
    if job_type == "scan":
        asyncio.run(run_nightly_scan())
    elif job_type == "digest":
        asyncio.run(run_daily_digest())
    elif job_type == "escalate":
        asyncio.run(run_escalation())
    else:
        print(f"Unknown job command: {job_type}. Valid: scan, digest, escalate")
