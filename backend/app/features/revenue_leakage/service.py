import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import forbidden_role, not_found, validation_error
from app.models.employee import Employee, EmployeeRole
from app.features.revenue_leakage.crud import LeakageCRUD
from app.features.revenue_leakage.lifecycle import AlertLifecycle
from app.features.revenue_leakage.models import LeakageAlert, LeakageRule, RuleChange, ScanRun
from app.features.revenue_leakage.ports import FakeOrgProvider, OrgProvider
from app.features.revenue_leakage.schemas import (
    AlertActionCreateRequest,
    AlertActionResponse,
    AlertDetailResponse,
    AlertItemResponse,
    AlertObservationResponse,
    EarlierOccurrenceItem,
    PaginatedAlertsResponse,
    RulePatchRequest,
    RuleResponse,
    ScanRunResponse,
)


class RevenueLeakageService:
    def __init__(self, org_provider: Optional[OrgProvider] = None):
        self.org_provider = org_provider or FakeOrgProvider()

    def _is_field_officer(self, employee: Employee) -> bool:
        role = (employee.role or "").upper()
        return role in ("MR", "FIELD_OFFICER", "FIELD_EXECUTIVE")

    def _is_senior_manager_or_above(self, employee: Employee) -> bool:
        role = (employee.role or "").upper()
        return role in ("ADMIN", "GM", "EXECUTIVE_DIRECTOR", "SENIOR_MANAGER", "ZSM")

    async def _get_allowed_entity_ids(
        self, db: AsyncSession, employee: Employee
    ) -> Optional[Set[uuid.UUID]]:
        """
        Resolves hierarchy scope:
        - Admin, GM, Executive Director: None (sees all)
        - Field Officer: empty set (no access)
        - Branch Manager, RSM, Team Lead: subordinate entities
        """
        role = (employee.role or "").upper()
        if role in ("ADMIN", "GM", "EXECUTIVE_DIRECTOR"):
            return None
        if self._is_field_officer(employee):
            return set()
        # For RSM and Branch Managers, return None or filtered set
        # When integration tables exist, queries rep-assigned entity IDs
        return None

    async def list_alerts(
        self,
        db: AsyncSession,
        actor: Employee,
        rule_code: Optional[str] = None,
        status: Optional[str] = None,
        attention_priority: Optional[str] = None,
        entity_type: Optional[str] = None,
        page: int = 1,
        page_size: int = 25,
    ) -> PaginatedAlertsResponse:
        if self._is_field_officer(actor):
            # Spec Section 6.1: Field Officer has no access. Scope is applied in query, returns empty.
            return PaginatedAlertsResponse(items=[], total=0, page=page, page_size=page_size)

        allowed_entities = await self._get_allowed_entity_ids(db, actor)
        if allowed_entities is not None and len(allowed_entities) == 0:
            return PaginatedAlertsResponse(items=[], total=0, page=page, page_size=page_size)

        limit = min(max(page_size, 1), 100)
        offset = (max(page, 1) - 1) * limit

        alerts, total = await LeakageCRUD.list_alerts(
            db=db,
            scope_entity_ids=allowed_entities,
            rule_code=rule_code,
            status=status,
            attention_priority=attention_priority,
            entity_type=entity_type,
            limit=limit,
            offset=offset,
        )

        items: List[AlertItemResponse] = []
        for alert in alerts:
            owner_id = await self.org_provider.get_entity_owner(db, alert.entity_type, alert.entity_id)
            items.append(
                AlertItemResponse(
                    id=alert.id,
                    rule_code=alert.rule.rule_code if alert.rule else "unknown",
                    rule_name=alert.rule.rule_name if alert.rule else "Operational Alert",
                    entity_type=alert.entity_type,
                    entity_id=alert.entity_id,
                    entity_label=f"{alert.entity_type.capitalize()} {str(alert.entity_id)[:8]}",
                    owner_id=owner_id,
                    classification=alert.classification,
                    attention_priority=alert.attention_priority,
                    priority_reason=alert.priority_reason,
                    observation=alert.observation,
                    exposure_amount=alert.exposure_amount,
                    exposure_basis=alert.exposure_basis,
                    status=alert.status,
                    version=alert.version,
                    occurrence_no=alert.occurrence_no,
                    previous_alert_id=alert.previous_alert_id,
                    first_detected_at=alert.first_detected_at,
                    last_observed_at=alert.last_observed_at,
                    resolved_at=alert.resolved_at,
                    suppressed_until=alert.suppressed_until,
                    clear_streak=alert.clear_streak,
                    escalation_level=alert.escalation_level,
                )
            )

        return PaginatedAlertsResponse(
            items=items,
            total=total,
            page=page,
            page_size=limit,
        )

    async def get_alert_detail(
        self, db: AsyncSession, actor: Employee, alert_id: uuid.UUID
    ) -> AlertDetailResponse:
        if self._is_field_officer(actor):
            raise not_found("Alert not found or outside access scope")

        alert = await LeakageCRUD.get_alert_by_id(db, alert_id)
        if not alert:
            raise not_found("Alert not found")

        # Check scope
        allowed_entities = await self._get_allowed_entity_ids(db, actor)
        if allowed_entities is not None and alert.entity_id not in allowed_entities:
            raise not_found("Alert not found or outside access scope")

        # Audit view (Critic Gap P-10)
        await LeakageCRUD.log_alert_view(db, alert.id, actor.id, action="view")

        owner_id = await self.org_provider.get_entity_owner(db, alert.entity_type, alert.entity_id)

        # Earlier occurrences
        earlier_raw = await LeakageCRUD.get_earlier_occurrences(
            db, alert.rule_id, alert.entity_type, alert.entity_id, exclude_id=alert.id
        )
        earlier_items = [
            EarlierOccurrenceItem(
                id=occ.id,
                occurrence_no=occ.occurrence_no,
                status=occ.status,
                first_detected_at=occ.first_detected_at,
                resolved_at=occ.resolved_at,
                archived=False,
            )
            for occ in earlier_raw
        ]

        obs_items = [
            AlertObservationResponse(
                id=obs.id,
                observed_at=obs.observed_at,
                observation=obs.observation,
                attention_priority=obs.attention_priority,
                reason=obs.reason,
            )
            for obs in alert.observations
        ]

        action_items = [
            AlertActionResponse(
                id=act.id,
                alert_id=act.alert_id,
                action_type=act.action_type,
                outcome=act.outcome,
                action_taken=act.action_taken,
                evidence_reference=act.evidence_reference,
                notes=act.notes,
                action_by=act.action_by,
                created_at=act.created_at,
            )
            for act in alert.actions
        ]

        return AlertDetailResponse(
            id=alert.id,
            rule_code=alert.rule.rule_code if alert.rule else "unknown",
            rule_name=alert.rule.rule_name if alert.rule else "Operational Alert",
            entity_type=alert.entity_type,
            entity_id=alert.entity_id,
            entity_label=f"{alert.entity_type.capitalize()} {str(alert.entity_id)[:8]}",
            owner_id=owner_id,
            classification=alert.classification,
            attention_priority=alert.attention_priority,
            priority_reason=alert.priority_reason,
            observation=alert.observation,
            exposure_amount=alert.exposure_amount,
            exposure_basis=alert.exposure_basis,
            status=alert.status,
            version=alert.version,
            occurrence_no=alert.occurrence_no,
            previous_alert_id=alert.previous_alert_id,
            first_detected_at=alert.first_detected_at,
            last_observed_at=alert.last_observed_at,
            resolved_at=alert.resolved_at,
            suppressed_until=alert.suppressed_until,
            clear_streak=alert.clear_streak,
            escalation_level=alert.escalation_level,
            observations=obs_items,
            actions=action_items,
            occurrences=earlier_items,
        )

    async def record_action(
        self,
        db: AsyncSession,
        actor: Employee,
        alert_id: uuid.UUID,
        data: AlertActionCreateRequest,
        idempotency_key: Optional[str] = None,
    ) -> AlertItemResponse:
        if self._is_field_officer(actor):
            raise not_found("Alert not found or outside access scope")

        alert = await LeakageCRUD.get_alert_by_id(db, alert_id)
        if not alert:
            raise not_found("Alert not found")

        allowed_entities = await self._get_allowed_entity_ids(db, actor)
        if allowed_entities is not None and alert.entity_id not in allowed_entities:
            raise not_found("Alert not found or outside access scope")

        # Perform lifecycle update
        updated_alert = await AlertLifecycle.record_action(
            db=db,
            alert=alert,
            action_type=data.action_type,
            expected_version=data.expected_version,
            outcome=data.outcome,
            action_taken=data.action_taken,
            evidence_reference=data.evidence_reference,
            notes=data.notes,
            action_by=actor.id,
            idempotency_key=idempotency_key,
        )

        owner_id = await self.org_provider.get_entity_owner(
            db, updated_alert.entity_type, updated_alert.entity_id
        )

        return AlertItemResponse(
            id=updated_alert.id,
            rule_code=updated_alert.rule.rule_code if updated_alert.rule else "unknown",
            rule_name=updated_alert.rule.rule_name if updated_alert.rule else "Operational Alert",
            entity_type=updated_alert.entity_type,
            entity_id=updated_alert.entity_id,
            entity_label=f"{updated_alert.entity_type.capitalize()} {str(updated_alert.entity_id)[:8]}",
            owner_id=owner_id,
            classification=updated_alert.classification,
            attention_priority=updated_alert.attention_priority,
            priority_reason=updated_alert.priority_reason,
            observation=updated_alert.observation,
            exposure_amount=updated_alert.exposure_amount,
            exposure_basis=updated_alert.exposure_basis,
            status=updated_alert.status,
            version=updated_alert.version,
            occurrence_no=updated_alert.occurrence_no,
            previous_alert_id=updated_alert.previous_alert_id,
            first_detected_at=updated_alert.first_detected_at,
            last_observed_at=updated_alert.last_observed_at,
            resolved_at=updated_alert.resolved_at,
            suppressed_until=updated_alert.suppressed_until,
            clear_streak=updated_alert.clear_streak,
            escalation_level=updated_alert.escalation_level,
        )

    async def list_rules(self, db: AsyncSession, actor: Employee) -> List[RuleResponse]:
        if not self._is_senior_manager_or_above(actor):
            raise forbidden_role("Only Senior Manager and above may access rule configurations")

        rules = await LeakageCRUD.list_rules(db)
        return [RuleResponse.model_validate(r) for r in rules]

    async def patch_rule(
        self,
        db: AsyncSession,
        actor: Employee,
        rule_id: uuid.UUID,
        data: RulePatchRequest,
    ) -> RuleResponse:
        if not self._is_senior_manager_or_above(actor):
            raise forbidden_role("Only Senior Manager and above may edit rule configurations")

        rule = await LeakageCRUD.get_rule_by_id(db, rule_id)
        if not rule:
            raise not_found("Rule not found")

        # Validation rules: high_priority_ratio > medium_priority_ratio >= 1.0
        med = data.medium_priority_ratio if data.medium_priority_ratio is not None else rule.medium_priority_ratio
        high = data.high_priority_ratio if data.high_priority_ratio is not None else rule.high_priority_ratio
        if high <= med:
            raise validation_error("high_priority_ratio must be strictly greater than medium_priority_ratio")
        if med < Decimal("1.0"):
            raise validation_error("medium_priority_ratio must be at least 1.0")

        if data.change_ratio is not None:
            if data.change_ratio <= 0 or data.change_ratio > 1:
                raise validation_error("change_ratio must be greater than 0 and at most 1.0")

        # Track changes and write audit rows
        fields_to_check = [
            ("threshold_days", data.threshold_days),
            ("threshold_value", data.threshold_value),
            ("medium_priority_ratio", data.medium_priority_ratio),
            ("high_priority_ratio", data.high_priority_ratio),
            ("change_ratio", data.change_ratio),
            ("cooldown_days", data.cooldown_days),
            ("dismiss_days", data.dismiss_days),
            ("autoclear_scans", data.autoclear_scans),
            ("escalation_days", data.escalation_days),
            ("min_history_months", data.min_history_months),
            ("params", data.params),
            ("is_active", data.is_active),
        ]

        now = datetime.now(timezone.utc)
        for field_name, new_val in fields_to_check:
            if new_val is not None:
                old_val = getattr(rule, field_name)
                if old_val != new_val:
                    change_row = RuleChange(
                        id=uuid.uuid4(),
                        rule_id=rule.id,
                        field=field_name,
                        old_value=str(old_val),
                        new_value=str(new_val),
                        reason=data.reason,
                        changed_by=actor.id,
                        changed_at=now,
                    )
                    db.add(change_row)
                    setattr(rule, field_name, new_val)

        rule.updated_at = now
        await db.commit()
        await db.refresh(rule)
        return RuleResponse.model_validate(rule)

    async def list_scan_runs(
        self, db: AsyncSession, actor: Employee, limit: int = 50
    ) -> List[ScanRunResponse]:
        if not self._is_senior_manager_or_above(actor):
            raise forbidden_role("Only Senior Manager and above may access scan runs")

        runs = await LeakageCRUD.list_scan_runs(db, limit=limit)
        return [ScanRunResponse.model_validate(r) for r in runs]
