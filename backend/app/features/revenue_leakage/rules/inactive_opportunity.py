import uuid
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.revenue_leakage.models import LeakageRule
from app.features.revenue_leakage.ports import RuleFinding, LeadsProvider
from app.features.revenue_leakage.calendar import calculate_working_days


class InactiveOpportunityRule:
    """
    Rule 4: inactive_opportunity
    Fires when an open opportunity has stayed in one pipeline stage more than threshold_days
    with no visit or call logged in that time.
    Skip when:
    - Stage is closed/won/lost.
    """
    def __init__(self, leads_provider: LeadsProvider):
        self.leads = leads_provider

    async def evaluate_opportunities(
        self,
        db: AsyncSession,
        rule: LeakageRule,
        today: date,
    ) -> List[RuleFinding]:
        open_opps = await self.leads.get_open_opportunities(db)
        findings: List[RuleFinding] = []

        for opp in open_opps:
            opp_id = opp["id"]
            title = opp.get("title", f"Opportunity {opp_id}")
            stage = (opp.get("stage") or "").lower()

            if stage in ["won", "lost", "closed", "cancelled"]:
                continue

            last_activity = opp.get("last_activity_date") or opp.get("stage_entered_date") or today
            working_days_in_stage = calculate_working_days(last_activity, today)

            if working_days_in_stage <= rule.threshold_days:
                continue

            observed_dec = Decimal(str(working_days_in_stage))
            threshold_dec = Decimal(str(rule.threshold_days))

            obs_data = {
                "stage": opp.get("stage", "Proposal"),
                "days_in_stage": working_days_in_stage,
                "last_activity_date": str(last_activity),
                "threshold_days": rule.threshold_days,
                "suggested_check": "Review pipeline roadblock and re-engage commercial decision makers.",
            }

            findings.append(
                RuleFinding(
                    entity_type="lead",
                    entity_id=opp_id,
                    entity_label=title,
                    observed_value=observed_dec,
                    threshold=threshold_dec,
                    unit_description="working days in pipeline stage without contact",
                    baseline_description=f"Standard pipeline stage cadence ({rule.threshold_days} working days)",
                    observation_data=obs_data,
                    exposure_amount=None,
                    exposure_basis=None,
                )
            )

        return findings

    evaluate = evaluate_opportunities
