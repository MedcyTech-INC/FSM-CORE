import uuid
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.revenue_leakage.models import LeakageRule
from app.features.revenue_leakage.ports import (
    RuleFinding,
    VisitsProvider,
    OrdersProvider,
    LeaveProvider,
)
from app.features.revenue_leakage.calendar import calculate_working_days


class UnvisitedClientRule:
    """
    Rule 1: unvisited_client
    Fires when:
    - Average monthly order value over last 3 full months >= threshold_value
    - Working days since reference date > threshold_days
    - Reference date (RL-3): Last verified visit date. If none, later of became_high_value_date and assigned_date.
    - Skip: account younger than min_history_months
    """
    def __init__(
        self,
        visits_provider: VisitsProvider,
        orders_provider: OrdersProvider,
        leave_provider: Optional[LeaveProvider] = None,
    ):
        self.visits = visits_provider
        self.orders = orders_provider
        self.leave = leave_provider

    async def evaluate_client(
        self,
        db: AsyncSession,
        rule: LeakageRule,
        today: date,
        client: Dict[str, Any],
    ) -> Optional[RuleFinding]:
        client_id = client["id"]
        client_name = client.get("name", f"Client {client_id}")

        metrics = await self.orders.get_client_order_metrics(db, client_id, as_of=today)
        history_months = metrics.get("history_months", 0)
        avg_value = Decimal(str(metrics.get("average_monthly_value", "0.00")))

        # Skip young accounts (RL-4)
        if history_months < rule.min_history_months:
            return None

        # Check high-value qualification
        if avg_value < rule.threshold_value:
            return None

        # Determine reference date (RL-3)
        last_visit = await self.visits.get_last_visit_date(db, "customer", client_id)
        if last_visit:
            ref_date = last_visit
            ref_source = "last_verified_visit"
        else:
            became_hv = metrics.get("became_high_value_date") or today
            assigned = metrics.get("assigned_date") or today
            ref_date = max(became_hv, assigned)
            ref_source = "assignment_or_high_value_date"

        # Calculate working days elapsed
        working_days_elapsed = calculate_working_days(ref_date, today)

        # Fires only when observed > threshold_days
        if working_days_elapsed <= rule.threshold_days:
            return None

        observed_dec = Decimal(str(working_days_elapsed))
        threshold_dec = Decimal(str(rule.threshold_days))

        obs_data = {
            "last_verified_visit": str(last_visit) if last_visit else None,
            "reference_date": str(ref_date),
            "reference_source": ref_source,
            "working_days_overdue": working_days_elapsed,
            "threshold_days": rule.threshold_days,
            "average_monthly_order_value": float(avg_value),
            "threshold_value": float(rule.threshold_value),
            "history_months": history_months,
            "suggested_check": "Schedule an in-person or virtual field meeting with customer key contact.",
        }

        return RuleFinding(
            entity_type="customer",
            entity_id=client_id,
            entity_label=client_name,
            observed_value=observed_dec,
            threshold=threshold_dec,
            unit_description="working days since last contact",
            baseline_description=f"Monthly average orders INR {avg_value:,.2f} over past {history_months} months",
            observation_data=obs_data,
            exposure_amount=None,
            exposure_basis=None,
        )

    async def evaluate(
        self, db: AsyncSession, rule: LeakageRule, today: date
    ) -> List[RuleFinding]:
        clients = getattr(self.orders, "get_all_clients", None)
        client_list = await clients(db) if callable(clients) else []
        findings = []
        for c in client_list:
            f = await self.evaluate_client(db, rule, today, c)
            if f:
                findings.append(f)
        return findings
