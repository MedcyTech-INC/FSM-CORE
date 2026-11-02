import uuid
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.revenue_leakage.models import LeakageRule
from app.features.revenue_leakage.ports import RuleFinding, TargetsProvider


class UnderperformingTerritoryRule:
    """
    Rule 5: underperforming_territory
    Fires when achievement percentage against the territory's active revenue target
    is behind the share of working days elapsed by more than threshold_value percentage points.
    Section 5.1 & worked example 10.1:
    - Target 1,000,000; achieved 400,000 (40%); 70% of working days elapsed; threshold 15 points.
    - Expected 70%, achieved 40% -> shortfall 30 points -> ratio 30 / 15 = 2.0 (high).
    - Skip when:
      - Territory has no active revenue target.
      - Fewer than min_elapsed_working_days (default 5) elapsed.
    - Language rule: gap in achievement percentage, never a money loss.
    """
    def __init__(self, targets_provider: TargetsProvider):
        self.targets = targets_provider

    async def evaluate_territory(
        self,
        db: AsyncSession,
        rule: LeakageRule,
        today: date,
        territory_id: uuid.UUID,
        territory_name: str,
    ) -> Optional[RuleFinding]:
        target_info = await self.targets.get_territory_active_target_achievement(
            db, territory_id, today
        )
        if not target_info:
            return None  # Skipped: no active target

        min_elapsed_days = int(rule.params.get("min_elapsed_working_days", 5))
        elapsed_working_days = target_info.get("elapsed_working_days", 0)

        if elapsed_working_days < min_elapsed_days:
            return None  # Too early in period

        expected_pct = Decimal(str(target_info.get("expected_percent", "0.00")))
        achieved_pct = Decimal(str(target_info.get("achieved_percent", "0.00")))

        shortfall = expected_pct - achieved_pct
        if shortfall <= rule.threshold_value:
            return None  # Pace is healthy

        shortfall_quantized = shortfall.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        threshold_quantized = rule.threshold_value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        obs_data = {
            "target_id": str(target_info.get("target_id")),
            "target_title": target_info.get("target_title", "Monthly Revenue Target"),
            "expected_achievement_percent": float(expected_pct),
            "actual_achievement_percent": float(achieved_pct),
            "pace_shortfall_points": float(shortfall_quantized),
            "threshold_shortfall_points": float(threshold_quantized),
            "elapsed_working_days": elapsed_working_days,
            "total_working_days": target_info.get("total_working_days", 0),
            "suggested_check": "Conduct territory run-rate review with assigned Field Executives.",
        }

        return RuleFinding(
            entity_type="territory",
            entity_id=territory_id,
            entity_label=territory_name,
            observed_value=shortfall_quantized,
            threshold=threshold_quantized,
            unit_description="percentage points shortfall behind expected run-rate pace",
            baseline_description=f"Expected pace {expected_pct:.1f}% based on elapsed working days",
            observation_data=obs_data,
            exposure_amount=None,
            exposure_basis=None,
        )

    async def evaluate(
        self, db: AsyncSession, rule: LeakageRule, today: date
    ) -> List[RuleFinding]:
        territories = getattr(self.targets, "get_all_territories", None)
        territory_list = await territories(db) if callable(territories) else []
        findings = []
        for t in territory_list:
            t_id = t["id"]
            t_name = t.get("name", f"Territory {t_id}")
            f = await self.evaluate_territory(db, rule, today, t_id, t_name)
            if f:
                findings.append(f)
        return findings
