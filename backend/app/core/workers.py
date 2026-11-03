import asyncio
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, List, Optional, Any, Awaitable
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import AsyncSessionLocal
from app.models.tenant import Tenant

logger = logging.getLogger("fsm_core.workers")


@dataclass
class TenantWorkerSummary:
    tenant_id: uuid.UUID
    tenant_slug: str
    job_name: str
    success: bool
    items_processed: int
    error: Optional[str] = None


class MultiTenantWorkerDaemon:
    """
    Enterprise Multi-Tenant Background Worker Protocol Engine.
    Executes scheduled maintenance, sweepers, and reconciliation runs across all
    active tenant organizations while enforcing:
    1. Tenant Iteration Loop: Discovers active tenant scopes from fsm_system.tenants.
    2. Atomic Session Binding: Runs SET LOCAL app.current_tenant_id = :tenant_id per transaction.
    3. Fault Containment: Wraps each tenant execution in an isolated transaction to prevent
       cascading failures across corporate tenants.
    """

    @classmethod
    async def get_active_tenants(
        cls,
        session: AsyncSession,
        tenant_slug: Optional[str] = None
    ) -> List[Tenant]:
        """Fetches all active corporate tenants from the control plane schema."""
        stmt = select(Tenant).where(Tenant.is_active.is_(True))
        if tenant_slug:
            stmt = stmt.where(Tenant.slug == tenant_slug.strip().lower())
        stmt = stmt.order_by(Tenant.created_at.asc())
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def run_tenant_scoped_job(
        cls,
        job_name: str,
        worker_fn: Callable[[AsyncSession, Tenant], Awaitable[int]],
        tenant_slug: Optional[str] = None,
    ) -> List[TenantWorkerSummary]:
        """
        Executes a background batch routine across active tenants with strict isolation.
        """
        summaries: List[TenantWorkerSummary] = []

        # 1. Discover tenants
        async with AsyncSessionLocal() as discovery_session:
            tenants = await cls.get_active_tenants(discovery_session, tenant_slug=tenant_slug)

        if not tenants:
            logger.info(f"[{job_name}] No active tenants found for execution.")
            return summaries

        logger.info(f"[{job_name}] Starting batch run across {len(tenants)} active tenant(s).")

        # 2. Iterate each tenant with dedicated session, RLS binding, and fault boundary
        for t in tenants:
            async with AsyncSessionLocal() as session:
                try:
                    # Atomic Session Binding for RLS
                    await session.execute(
                        text("SET LOCAL app.current_tenant_id = :tenant_id"),
                        {"tenant_id": str(t.id)}
                    )

                    # Execute tenant worker payload
                    processed = await worker_fn(session, t)
                    await session.commit()

                    summary = TenantWorkerSummary(
                        tenant_id=t.id,
                        tenant_slug=t.slug,
                        job_name=job_name,
                        success=True,
                        items_processed=processed or 0,
                    )
                    summaries.append(summary)
                    logger.info(f"[{job_name}] Tenant '{t.slug}' succeeded. Items processed: {summary.items_processed}")

                except Exception as exc:
                    await session.rollback()
                    err_msg = str(exc)
                    logger.error(f"[{job_name}] Fault contained for tenant '{t.slug}' ({t.id}): {err_msg}", exc_info=True)
                    summary = TenantWorkerSummary(
                        tenant_id=t.id,
                        tenant_slug=t.slug,
                        job_name=job_name,
                        success=False,
                        items_processed=0,
                        error=err_msg,
                    )
                    summaries.append(summary)

        return summaries

    # ------------------------------------------------------------------
    # Standard Background Jobs Implementation
    # ------------------------------------------------------------------

    @classmethod
    async def run_outbox_sweeper(cls, tenant_slug: Optional[str] = None) -> List[TenantWorkerSummary]:
        """T-16 / MT-4: Sweeps pending outbox events per tenant."""
        from app.features.monthly_target.outbox import OutboxSweeper

        async def _worker(session: AsyncSession, tenant: Tenant) -> int:
            return await OutboxSweeper.sweep_pending(session)

        return await cls.run_tenant_scoped_job("outbox_sweeper", _worker, tenant_slug=tenant_slug)

    @classmethod
    async def run_nightly_reconciliation(cls, tenant_slug: Optional[str] = None) -> List[TenantWorkerSummary]:
        """T-19: Nightly target drift reconciliation per tenant."""
        from app.features.monthly_target.jobs import TargetJobs

        async def _worker(session: AsyncSession, tenant: Tenant) -> int:
            run = await TargetJobs.run_nightly_reconciliation(session)
            return run.targets_checked

        return await cls.run_tenant_scoped_job("nightly_reconciliation", _worker, tenant_slug=tenant_slug)

    @classmethod
    async def run_target_closing(cls, tenant_slug: Optional[str] = None) -> List[TenantWorkerSummary]:
        """T-18: Freezes and closes targets past (end_date + grace_days) per tenant."""
        from app.features.monthly_target.jobs import TargetJobs

        async def _worker(session: AsyncSession, tenant: Tenant) -> int:
            return await TargetJobs.run_closing_job(session)

        return await cls.run_tenant_scoped_job("target_closing", _worker, tenant_slug=tenant_slug)

    @classmethod
    async def run_data_archiving(cls, tenant_slug: Optional[str] = None) -> List[TenantWorkerSummary]:
        """T-25 / P-16: Moves aged closed records to fsm_archive per tenant."""
        from app.features.monthly_target.jobs import TargetJobs

        async def _worker(session: AsyncSession, tenant: Tenant) -> int:
            return await TargetJobs.run_archive_job(session)

        return await cls.run_tenant_scoped_job("data_archiving", _worker, tenant_slug=tenant_slug)

    @classmethod
    async def run_revenue_leakage_scanner(cls, tenant_slug: Optional[str] = None) -> List[TenantWorkerSummary]:
        """Runs nightly revenue leakage detection scan per tenant."""
        from app.features.revenue_leakage.scanner import LeakageScanner

        async def _worker(session: AsyncSession, tenant: Tenant) -> int:
            scanner = LeakageScanner()
            runs = await scanner.scan_all_rules(session)
            return len(runs)

        return await cls.run_tenant_scoped_job("revenue_leakage_scanner", _worker, tenant_slug=tenant_slug)

    @classmethod
    async def run_daily_digest(cls, tenant_slug: Optional[str] = None) -> List[TenantWorkerSummary]:
        """Dispatches daily notification digests to managers per tenant."""
        from app.features.revenue_leakage.notifications import NotificationManager
        from app.features.revenue_leakage.ports import FakeNotifier, FakeOrgProvider
        from app.features.revenue_leakage.recipients import RecipientResolver

        async def _worker(session: AsyncSession, tenant: Tenant) -> int:
            mgr = NotificationManager(FakeNotifier(), RecipientResolver(FakeOrgProvider()))
            today = datetime.now(timezone.utc).date()
            return await mgr.send_daily_digests(session, today)

        return await cls.run_tenant_scoped_job("daily_digest", _worker, tenant_slug=tenant_slug)

    @classmethod
    async def run_alert_escalation(cls, tenant_slug: Optional[str] = None) -> List[TenantWorkerSummary]:
        """Escalates unacknowledged alerts exceeding escalation_days per tenant."""
        from app.features.revenue_leakage.jobs import run_escalation

        async def _worker(session: AsyncSession, tenant: Tenant) -> int:
            # Reuses single tenant session
            from app.features.revenue_leakage.calendar import WorkingCalendar
            from app.features.revenue_leakage.models import AlertAction, LeakageAlert, LeakageRule
            from app.features.revenue_leakage.notifications import NotificationManager
            from app.features.revenue_leakage.ports import FakeNotifier, FakeOrgProvider
            from app.features.revenue_leakage.recipients import RecipientResolver

            now = datetime.now(timezone.utc)
            today = now.date()
            system_user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
            mgr = NotificationManager(FakeNotifier(), RecipientResolver(FakeOrgProvider()))

            stmt = select(LeakageAlert).join(LeakageRule).where(LeakageAlert.status == "active")
            res = await session.execute(stmt)
            active_alerts = res.scalars().all()

            escalated_count = 0
            for alert in active_alerts:
                rule = alert.rule
                if not rule:
                    continue
                working_days = await WorkingCalendar.count_working_days(
                    session, alert.first_detected_at.date(), today
                )
                if working_days >= rule.escalation_days and alert.escalation_level == 0:
                    alert.escalation_level = 1
                    alert.escalated_at = now
                    alert.version += 1

                    action = AlertAction(
                        id=uuid.uuid4(),
                        alert_id=alert.id,
                        action_type="escalated",
                        action_taken=f"Auto-escalated to Level 1 after {working_days} working days unacknowledged",
                        action_by=system_user_id,
                        created_at=now,
                    )
                    session.add(action)
                    await mgr.notify_alert(session, alert, kind="escalated")
                    escalated_count += 1

            return escalated_count

        return await cls.run_tenant_scoped_job("alert_escalation", _worker, tenant_slug=tenant_slug)

    @classmethod
    async def run_all_jobs(cls, tenant_slug: Optional[str] = None) -> List[TenantWorkerSummary]:
        """Executes all background maintenance and batch daemons sequentially."""
        results: List[TenantWorkerSummary] = []
        results.extend(await cls.run_outbox_sweeper(tenant_slug))
        results.extend(await cls.run_target_closing(tenant_slug))
        results.extend(await cls.run_nightly_reconciliation(tenant_slug))
        results.extend(await cls.run_data_archiving(tenant_slug))
        results.extend(await cls.run_revenue_leakage_scanner(tenant_slug))
        results.extend(await cls.run_alert_escalation(tenant_slug))
        results.extend(await cls.run_daily_digest(tenant_slug))
        return results
