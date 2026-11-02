import uuid
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.revenue_leakage.models import LeakageRule
from app.features.revenue_leakage.ports import RuleFinding, OrdersProvider


class DecliningFrequencyRule:
    """
    Rule 3: declining_frequency
    Fires when monthly order count drops below historical baseline for consecutive months.
    Section 5.1 & RL-4, RL-5:
    - Default params: consecutive_months = 2, min_fall_percent = 30
    - Baseline: average order count of the 3 full months prior.
    - Skip: history < min_history_months, or baseline == 0
    - Language rule: States fall percentage, never states money loss.
    """
    def __init__(self, orders_provider: OrdersProvider):
        self.orders = orders_provider

    async def evaluate_client(
        self,
        db: AsyncSession,
        rule: LeakageRule,
        today: date,
        client: Dict[str, Any],
    ) -> Optional[RuleFinding]:
        client_id = client["id"]
        client_name = client.get("name", f"Client {client_id}")

        params = rule.params or {}
        consecutive_months = int(params.get("consecutive_months", 2))
        min_fall_pct = Decimal(str(params.get("min_fall_percent", 30)))

        metrics = await self.orders.get_client_order_metrics(db, client_id, as_of=today)
        history_months = metrics.get("history_months", 0)

        if history_months < rule.min_history_months:
            return None

        baseline = Decimal(str(metrics.get("baseline_order_count", "0.00")))
        if baseline <= Decimal("0"):
            return None

        recent_counts: List[int] = metrics.get("recent_monthly_counts", [])
        if len(recent_counts) < consecutive_months:
            return None

        # Check consecutive months drop
        consecutive_drops = 0
        latest_fall_pct = Decimal("0")

        for cnt in recent_counts[-consecutive_months:]:
            actual_cnt = Decimal(str(cnt))
            if actual_cnt < baseline:
                fall = ((baseline - actual_cnt) / baseline * Decimal("100")).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                if fall >= min_fall_pct:
                    consecutive_drops += 1
                    latest_fall_pct = fall
                else:
                    break
            else:
                break

        if consecutive_drops < consecutive_months:
            return None

        obs_data = {
            "baseline_orders_per_month": float(baseline),
            "recent_monthly_counts": recent_counts[-consecutive_months:],
            "latest_fall_percent": float(latest_fall_pct),
            "min_fall_percent_threshold": float(min_fall_pct),
            "consecutive_months_analyzed": consecutive_months,
            "suggested_check": "Conduct account audit to investigate recent decline in repeat orders.",
        }

        return RuleFinding(
            entity_type="customer",
            entity_id=client_id,
            entity_label=client_name,
            observed_value=latest_fall_pct,
            threshold=min_fall_pct,
            unit_description="percentage drop in order frequency",
            baseline_description=f"3-month baseline average of {baseline:.1f} orders/month",
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
