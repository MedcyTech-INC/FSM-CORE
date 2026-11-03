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


async def run_nightly_scan(tenant_slug: Optional[str] = None):
    """Runs the nightly scan across all 5 operational warning rules across active tenants."""
    from app.core.workers import MultiTenantWorkerDaemon
    summaries = await MultiTenantWorkerDaemon.run_revenue_leakage_scanner(tenant_slug=tenant_slug)
    total = sum(s.items_processed for s in summaries if s.success)
    print(f"Multi-Tenant Nightly scan completed. Executed across {len(summaries)} tenant(s) with {total} rule evaluations.")
    return summaries


async def run_daily_digest(tenant_slug: Optional[str] = None):
    """Dispatches daily notification digests to managers across active tenants."""
    from app.core.workers import MultiTenantWorkerDaemon
    summaries = await MultiTenantWorkerDaemon.run_daily_digest(tenant_slug=tenant_slug)
    total = sum(s.items_processed for s in summaries if s.success)
    print(f"Multi-Tenant Daily digest completed. Dispatched {total} digests across {len(summaries)} tenant(s).")
    return summaries


async def run_escalation(tenant_slug: Optional[str] = None):
    """
    Checks active alerts that exceed escalation_days working days without acknowledgment across active tenants.
    """
    from app.core.workers import MultiTenantWorkerDaemon
    summaries = await MultiTenantWorkerDaemon.run_alert_escalation(tenant_slug=tenant_slug)
    total = sum(s.items_processed for s in summaries if s.success)
    print(f"Multi-Tenant Escalation job completed. Escalated {total} alerts across {len(summaries)} tenant(s).")
    return summaries


if __name__ == "__main__":
    job_type = sys.argv[1] if len(sys.argv) > 1 else "scan"
    tenant_filter = sys.argv[2] if len(sys.argv) > 2 else None

    if job_type == "scan":
        asyncio.run(run_nightly_scan(tenant_slug=tenant_filter))
    elif job_type == "digest":
        asyncio.run(run_daily_digest(tenant_slug=tenant_filter))
    elif job_type == "escalate":
        asyncio.run(run_escalation(tenant_slug=tenant_filter))
    else:
        print(f"Unknown job command: {job_type}. Valid: scan, digest, escalate")
