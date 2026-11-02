import asyncio
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from sqlalchemy import select, and_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.revenue_leakage.lifecycle import AlertLifecycle
from app.features.revenue_leakage.models import (
    LeakageRule,
    ScanRun,
    SourceAvailability,
)
from app.features.revenue_leakage.notifications import NotificationManager
from app.features.revenue_leakage.ports import (
    FakeLeadsProvider,
    FakeLeaveProvider,
    FakeNotifier,
    FakeOrdersProvider,
    FakeOrgProvider,
    FakeSyncStateProvider,
    FakeTargetsProvider,
    FakeVisitsProvider,
    LeadsProvider,
    LeaveProvider,
    Notifier,
    OrdersProvider,
    OrgProvider,
    RuleFinding,
    SyncStateProvider,
    TargetsProvider,
    VisitsProvider,
)
from app.features.revenue_leakage.recipients import RecipientResolver
from app.features.revenue_leakage.rules.abandoned_lead import AbandonedLeadRule
from app.features.revenue_leakage.rules.declining_frequency import DecliningFrequencyRule
from app.features.revenue_leakage.rules.inactive_opportunity import InactiveOpportunityRule
from app.features.revenue_leakage.rules.underperforming_territory import UnderperformingTerritoryRule
from app.features.revenue_leakage.rules.unvisited_client import UnvisitedClientRule

logger = logging.getLogger(__name__)


class LeakageScanner:
    def __init__(
        self,
        visits_provider: Optional[VisitsProvider] = None,
        orders_provider: Optional[OrdersProvider] = None,
        leads_provider: Optional[LeadsProvider] = None,
        leave_provider: Optional[LeaveProvider] = None,
        org_provider: Optional[OrgProvider] = None,
        targets_provider: Optional[TargetsProvider] = None,
        sync_provider: Optional[SyncStateProvider] = None,
        notifier: Optional[Notifier] = None,
    ):
        self.visits_provider = visits_provider or FakeVisitsProvider()
        self.orders_provider = orders_provider or FakeOrdersProvider()
        self.leads_provider = leads_provider or FakeLeadsProvider()
        self.leave_provider = leave_provider or FakeLeaveProvider()
        self.org_provider = org_provider or FakeOrgProvider()
        self.targets_provider = targets_provider or FakeTargetsProvider()
        self.sync_provider = sync_provider or FakeSyncStateProvider()
        self.notifier = notifier or FakeNotifier()
        self.recipient_resolver = RecipientResolver(self.org_provider)
        self.notification_manager = NotificationManager(self.notifier, self.recipient_resolver)

        # Build rule evaluators
        self.rule_evaluators = {
            "unvisited_client": UnvisitedClientRule(
                self.visits_provider, self.orders_provider, self.leave_provider
            ),
            "abandoned_lead": AbandonedLeadRule(
                self.leads_provider
            ),
            "declining_frequency": DecliningFrequencyRule(
                self.orders_provider
            ),
            "inactive_opportunity": InactiveOpportunityRule(
                self.leads_provider
            ),
            "underperforming_territory": UnderperformingTerritoryRule(
                self.targets_provider
            ),
        }

    async def _check_sources_available(self, db: AsyncSession, required_sources: List[str]) -> Tuple[bool, Optional[str]]:
        if not required_sources:
            return True, None
        stmt = select(SourceAvailability).where(SourceAvailability.source_key.in_(required_sources))
        res = await db.execute(stmt)
        sources = {s.source_key: s.is_available for s in res.scalars().all()}
        for req in required_sources:
            if not sources.get(req, False):
                return False, f"Required source '{req}' is marked unavailable"
        return True, None

    async def _is_baseline_run(self, db: AsyncSession, rule_code: str) -> bool:
        stmt = select(ScanRun).where(
            and_(
                ScanRun.rule_code == rule_code,
                ScanRun.status == "succeeded",
            )
        ).limit(1)
        res = await db.execute(stmt)
        return res.scalar_one_or_none() is None

    async def scan_rule(
        self,
        db: AsyncSession,
        rule_code: str,
        system_user_id: Optional[uuid.UUID] = None,
    ) -> ScanRun:
        sys_user = system_user_id or uuid.UUID("00000000-0000-0000-0000-000000000001")
        now = datetime.now(timezone.utc)

        # Fetch rule config
        stmt = select(LeakageRule).where(LeakageRule.rule_code == rule_code)
        res = await db.execute(stmt)
        rule = res.scalar_one_or_none()
        if not rule or not rule.is_active:
            logger.info("Rule %s is inactive or not found. Skipping.", rule_code)
            scan_run = ScanRun(
                id=uuid.uuid4(),
                rule_code=rule_code,
                mode="normal",
                started_at=now,
                heartbeat_at=now,
                finished_at=now,
                status="skipped_source_missing",
                error_message="Rule is inactive or not found",
            )
            db.add(scan_run)
            await db.commit()
            return scan_run

        # Clean up stale running scans older than 15 minutes
        stale_threshold = datetime.fromtimestamp(now.timestamp() - 900, tz=timezone.utc)
        stale_stmt = select(ScanRun).where(
            and_(
                ScanRun.rule_code == rule_code,
                ScanRun.status == "running",
                ScanRun.heartbeat_at < stale_threshold,
            )
        )
        stale_res = await db.execute(stale_stmt)
        for stale in stale_res.scalars().all():
            stale.status = "failed"
            stale.finished_at = now
            stale.error_message = "Stale running scan terminated"

        # Check required sources
        sources_ok, missing_reason = await self._check_sources_available(db, rule.required_sources)
        if not sources_ok:
            scan_run = ScanRun(
                id=uuid.uuid4(),
                rule_code=rule_code,
                mode="normal",
                started_at=now,
                heartbeat_at=now,
                finished_at=now,
                status="skipped_source_missing",
                error_message=missing_reason,
            )
            db.add(scan_run)
            await db.commit()
            return scan_run

        is_baseline = await self._is_baseline_run(db, rule_code)
        scan_mode = "baseline" if is_baseline else "normal"

        scan_run = ScanRun(
            id=uuid.uuid4(),
            rule_code=rule_code,
            mode=scan_mode,
            started_at=now,
            heartbeat_at=now,
            status="running",
            attempt=1,
        )
        db.add(scan_run)
        await db.commit()

        evaluator = self.rule_evaluators.get(rule_code)
        if not evaluator:
            scan_run.status = "failed"
            scan_run.finished_at = datetime.now(timezone.utc)
            scan_run.error_message = f"No evaluator registered for rule {rule_code}"
            await db.commit()
            return scan_run

        try:
            # Evaluate rule logic
            findings = await evaluator.evaluate(db, rule, now.date())

            alerts_created = 0
            alerts_updated = 0
            seen_entity_ids = set()

            for finding in findings:
                seen_entity_ids.add((finding.entity_type, finding.entity_id))
                alert, inserted, priority_changed = await AlertLifecycle.upsert_finding(
                    db=db,
                    rule=rule,
                    finding=finding,
                    now=now,
                )
                if alert:
                    if inserted:
                        alerts_created += 1
                        await self.notification_manager.notify_alert(
                            db, alert, kind="created", is_baseline=is_baseline
                        )
                    else:
                        alerts_updated += 1
                        if priority_changed:
                            await self.notification_manager.notify_alert(
                                db, alert, kind="priority_raised", is_baseline=is_baseline
                            )

            # Auto-clear absent entities
            cleared_count = await AlertLifecycle.auto_clear_absent_entities(
                db=db,
                rule_id=rule.id,
                autoclear_scans=rule.autoclear_scans,
                seen_entities=seen_entity_ids,
                system_user_id=sys_user,
                now=now,
            )

            scan_run.status = "succeeded"
            scan_run.finished_at = datetime.now(timezone.utc)
            scan_run.heartbeat_at = scan_run.finished_at
            scan_run.rows_evaluated = len(findings)
            scan_run.alerts_created = alerts_created
            scan_run.alerts_updated = alerts_updated
            scan_run.alerts_cleared = cleared_count
            await db.commit()
            return scan_run

        except Exception as exc:
            logger.exception("Error executing scan for rule %s: %s", rule_code, str(exc))
            await db.rollback()
            scan_run.status = "failed"
            scan_run.finished_at = datetime.now(timezone.utc)
            scan_run.error_message = str(exc)[:1000]
            db.add(scan_run)
            await db.commit()
            return scan_run

    async def scan_all_rules(self, db: AsyncSession) -> List[ScanRun]:
        rule_codes = [
            "unvisited_client",
            "abandoned_lead",
            "declining_frequency",
            "inactive_opportunity",
            "underperforming_territory",
        ]
        results = []
        for code in rule_codes:
            run = await self.scan_rule(db, code)
            results.append(run)
        return results
