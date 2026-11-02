import uuid
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.revenue_leakage.models import LeakageRule
from app.features.revenue_leakage.ports import RuleFinding, LeadsProvider
from app.features.revenue_leakage.calendar import calculate_working_days


class AbandonedLeadRule:
    """
    Rule 2: abandoned_lead
    Fires when an open lead has had no follow-up status change for more than threshold_days.
    Skip when:
    - Lead status is Won or Lost.
    - Lead is younger than threshold_days.
    """
    def __init__(self, leads_provider: LeadsProvider):
        self.leads = leads_provider

    async def evaluate_leads(
        self,
        db: AsyncSession,
        rule: LeakageRule,
        today: date,
    ) -> List[RuleFinding]:
        open_leads = await self.leads.get_open_leads(db)
        findings: List[RuleFinding] = []

        for lead in open_leads:
            lead_id = lead["id"]
            lead_name = lead.get("title", f"Lead {lead_id}")
            status = (lead.get("status") or "").lower()

            if status in ["won", "lost", "closed"]:
                continue

            last_followup = lead.get("last_followup_date") or lead.get("created_date") or today
            working_days_since = calculate_working_days(last_followup, today)

            if working_days_since <= rule.threshold_days:
                continue

            observed_dec = Decimal(str(working_days_since))
            threshold_dec = Decimal(str(rule.threshold_days))

            obs_data = {
                "stage": lead.get("stage", "Initial Contact"),
                "last_followup_date": str(last_followup),
                "working_days_since_followup": working_days_since,
                "threshold_days": rule.threshold_days,
                "suggested_check": "Reach out to lead prospect to update status or schedule demo.",
            }

            findings.append(
                RuleFinding(
                    entity_type="lead",
                    entity_id=lead_id,
                    entity_label=lead_name,
                    observed_value=observed_dec,
                    threshold=threshold_dec,
                    unit_description="working days without follow-up",
                    baseline_description=f"Standard lead engagement cadence ({rule.threshold_days} working days)",
                    observation_data=obs_data,
                    exposure_amount=None,
                    exposure_basis=None,
                )
            )

        return findings

    evaluate = evaluate_leads
