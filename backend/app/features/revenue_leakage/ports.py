import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Protocol, Set, Tuple
from sqlalchemy.ext.asyncio import AsyncSession


class Finding(Protocol):
    entity_type: str
    entity_id: uuid.UUID
    entity_label: str
    observed_value: Decimal
    threshold: Decimal
    unit_description: str
    baseline_description: str
    observation_data: Dict[str, Any]
    exposure_amount: Optional[Decimal]
    exposure_basis: Optional[str]


class RuleFinding:
    def __init__(
        self,
        entity_type: str,
        entity_id: uuid.UUID,
        entity_label: str,
        observed_value: Decimal,
        threshold: Decimal,
        unit_description: str,
        baseline_description: str,
        observation_data: Dict[str, Any],
        exposure_amount: Optional[Decimal] = None,
        exposure_basis: Optional[str] = None,
    ):
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.entity_label = entity_label
        self.observed_value = observed_value
        self.threshold = threshold
        self.unit_description = unit_description
        self.baseline_description = baseline_description
        self.observation_data = observation_data
        self.exposure_amount = exposure_amount
        self.exposure_basis = exposure_basis


class VisitsProvider(Protocol):
    async def get_last_visit_date(
        self, db: AsyncSession, entity_type: str, entity_id: uuid.UUID
    ) -> Optional[date]: ...


class OrdersProvider(Protocol):
    async def get_client_order_metrics(
        self, db: AsyncSession, client_id: uuid.UUID, as_of: date
    ) -> Dict[str, Any]:
        """Returns avg monthly order value, order counts per month, history months."""
        ...


class LeadsProvider(Protocol):
    async def get_open_leads(self, db: AsyncSession) -> List[Dict[str, Any]]: ...
    async def get_open_opportunities(self, db: AsyncSession) -> List[Dict[str, Any]]: ...


class LeaveProvider(Protocol):
    async def get_approved_leaves(
        self, db: AsyncSession, employee_id: uuid.UUID, start_date: date, end_date: date
    ) -> Set[date]: ...


class OrgProvider(Protocol):
    async def get_entity_owner(
        self, db: AsyncSession, entity_type: str, entity_id: uuid.UUID
    ) -> Optional[uuid.UUID]: ...

    async def get_recipients_for_alert(
        self, db: AsyncSession, entity_type: str, entity_id: uuid.UUID, escalation_level: int = 0
    ) -> List[uuid.UUID]: ...


class TargetsProvider(Protocol):
    async def get_territory_active_target_achievement(
        self, db: AsyncSession, territory_id: uuid.UUID, today: date
    ) -> Optional[Dict[str, Any]]: ...


class SyncStateProvider(Protocol):
    async def get_last_synced_at(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> Optional[datetime]: ...


class TaskCreator(Protocol):
    async def create_task_for_alert(
        self, db: AsyncSession, alert_id: uuid.UUID, assignee_id: uuid.UUID, title: str, description: str
    ) -> Optional[uuid.UUID]: ...


class Notifier(Protocol):
    async def send_immediate(
        self, db: AsyncSession, alert_id: uuid.UUID, recipient_id: uuid.UUID, title: str, message: str
    ) -> bool: ...

    async def send_digest(
        self, db: AsyncSession, recipient_id: uuid.UUID, digest_date: date, alert_ids: List[uuid.UUID]
    ) -> bool: ...


# ==============================================================================
# Fake / Mock Implementations for Tests & Offline Demo
# ==============================================================================

class FakeVisitsProvider:
    def __init__(self, visits_map: Optional[Dict[uuid.UUID, date]] = None):
        self.visits_map = visits_map or {}

    async def get_last_visit_date(
        self, db: AsyncSession, entity_type: str, entity_id: uuid.UUID
    ) -> Optional[date]:
        return self.visits_map.get(entity_id)


class FakeOrdersProvider:
    def __init__(self, metrics_map: Optional[Dict[uuid.UUID, Dict[str, Any]]] = None):
        self.metrics_map = metrics_map or {}

    async def get_client_order_metrics(
        self, db: AsyncSession, client_id: uuid.UUID, as_of: date
    ) -> Dict[str, Any]:
        return self.metrics_map.get(
            client_id,
            {
                "average_monthly_value": Decimal("0.00"),
                "history_months": 0,
                "recent_monthly_counts": [],
                "baseline_order_count": Decimal("0.00"),
                "became_high_value_date": None,
                "assigned_date": None,
            },
        )


class FakeLeadsProvider:
    def __init__(
        self,
        leads: Optional[List[Dict[str, Any]]] = None,
        opportunities: Optional[List[Dict[str, Any]]] = None,
    ):
        self.leads = leads or []
        self.opportunities = opportunities or []

    async def get_open_leads(self, db: AsyncSession) -> List[Dict[str, Any]]:
        return self.leads

    async def get_open_opportunities(self, db: AsyncSession) -> List[Dict[str, Any]]:
        return self.opportunities


class FakeLeaveProvider:
    def __init__(self, leaves: Optional[Set[date]] = None):
        self.leaves = leaves or set()

    async def get_approved_leaves(
        self, db: AsyncSession, employee_id: uuid.UUID, start_date: date, end_date: date
    ) -> Set[date]:
        return self.leaves


class FakeOrgProvider:
    def __init__(
        self,
        owners: Optional[Dict[uuid.UUID, uuid.UUID]] = None,
        recipients: Optional[Dict[uuid.UUID, List[uuid.UUID]]] = None,
    ):
        self.owners = owners or {}
        self.recipients = recipients or {}

    async def get_entity_owner(
        self, db: AsyncSession, entity_type: str, entity_id: uuid.UUID
    ) -> Optional[uuid.UUID]:
        return self.owners.get(entity_id, uuid.UUID("11111111-1111-1111-1111-111111111111"))

    async def get_recipients_for_alert(
        self, db: AsyncSession, entity_type: str, entity_id: uuid.UUID, escalation_level: int = 0
    ) -> List[uuid.UUID]:
        return self.recipients.get(
            entity_id, [uuid.UUID("11111111-1111-1111-1111-111111111111")]
        )


class FakeTargetsProvider:
    def __init__(self, targets_map: Optional[Dict[uuid.UUID, Dict[str, Any]]] = None):
        self.targets_map = targets_map or {}

    async def get_territory_active_target_achievement(
        self, db: AsyncSession, territory_id: uuid.UUID, today: date
    ) -> Optional[Dict[str, Any]]:
        return self.targets_map.get(territory_id)


class FakeSyncStateProvider:
    def __init__(self, sync_map: Optional[Dict[uuid.UUID, datetime]] = None):
        self.sync_map = sync_map or {}

    async def get_last_synced_at(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> Optional[datetime]:
        return self.sync_map.get(user_id, datetime.now(timezone.utc))


class FakeTaskCreator:
    async def create_task_for_alert(
        self, db: AsyncSession, alert_id: uuid.UUID, assignee_id: uuid.UUID, title: str, description: str
    ) -> Optional[uuid.UUID]:
        return uuid.uuid4()


class FakeNotifier:
    def __init__(self):
        self.sent_messages: List[Dict[str, Any]] = []

    async def send_immediate(
        self, db: AsyncSession, alert_id: uuid.UUID, recipient_id: uuid.UUID, title: str, message: str
    ) -> bool:
        self.sent_messages.append({"alert_id": alert_id, "recipient_id": recipient_id, "kind": "immediate", "title": title})
        return True

    async def send_digest(
        self, db: AsyncSession, recipient_id: uuid.UUID, digest_date: date, alert_ids: List[uuid.UUID]
    ) -> bool:
        self.sent_messages.append({"recipient_id": recipient_id, "kind": "digest", "date": digest_date, "count": len(alert_ids)})
        return True
