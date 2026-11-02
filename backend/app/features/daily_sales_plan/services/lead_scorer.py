"""
Multi-Criteria Decision Analysis (MCDA) Lead Scorer
===================================================
Pure, deterministic candidate prioritization engine.
Evaluates Urgency, Commercial Value, Target Pacing Deficit, Priority, and Recency Decay.
Generates human-readable 'Why Badges' explaining each recommendation.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any, List, TYPE_CHECKING

from app.config import get_settings, Settings

if TYPE_CHECKING:
    from app.features.daily_sales_plan.models.crm import Lead, FollowUp
    from app.models.task import Task


class LeadScorer:
    """
    Evaluates candidate stops using configurable MCDA scoring rules.
    Operates strictly as an in-memory pure calculation service.
    """

    def __init__(self, settings: Optional[Settings] = None):
        cfg = settings or get_settings()
        self.w_urgency = cfg.plan_weight_urgency
        self.w_value = cfg.plan_weight_deal_value
        self.w_pacing = cfg.plan_weight_target_pacing
        self.w_priority = cfg.plan_weight_lead_priority
        self.w_recency = cfg.plan_weight_recency_decay
        self.chronic_backlog_days = cfg.plan_chronic_backlog_days
        self.chronic_backlog_cap = cfg.plan_chronic_backlog_urgency_cap

    def calculate_candidate_score(
        self,
        lead: Optional[Lead] = None,
        follow_up: Optional[FollowUp] = None,
        task: Optional[Task] = None,
        territory_max_deal: Optional[float] = None,
        target_revenue: float = 0.0,
        achieved_revenue: float = 0.0,
        now: Optional[datetime] = None,
        stage: Optional[str] = None,
        customer_response: Optional[str] = None,
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Calculates priority score Si in [0.0, 100.0] and returns structured explanation badges.

        Formula:
            Si = min(100.0, w_u*Ui + w_v*Vi + w_t*Ti + w_p*Pi + w_d*Di)
        """
        current_time = now or datetime.now(timezone.utc)
        badges: List[Dict[str, str]] = []

        # ---------------------------------------------------------------------
        # 1. Urgency Factor (Ui)
        # ---------------------------------------------------------------------
        u_score, u_badge = self._compute_urgency(follow_up, task, current_time)
        if u_badge:
            badges.append(u_badge)

        # ---------------------------------------------------------------------
        # 2. Commercial Deal Value (Vi) with Conversion-Aware Expected Outcome
        # ---------------------------------------------------------------------
        v_score, v_badge, c_badge, deal_val, conversion_rate = self._compute_deal_value(
            lead, territory_max_deal, stage=stage, customer_response=customer_response
        )
        if v_badge:
            badges.append(v_badge)
        if c_badge:
            badges.append(c_badge)

        # ---------------------------------------------------------------------
        # 3. Target Pacing Boost Heuristic (Ti)
        # NOTE: Evaluated strictly on nominal deal_val so quota pacing is NOT
        # double-discounted by conversion likelihood.
        # ---------------------------------------------------------------------
        t_score, t_badge = self._compute_target_pacing_heuristic(
            deal_val, target_revenue, achieved_revenue
        )
        if t_badge:
            badges.append(t_badge)

        # ---------------------------------------------------------------------
        # 4. Lead & Task Priority (Pi)
        # ---------------------------------------------------------------------
        p_score, p_badge = self._compute_priority(lead, follow_up, task)
        if p_badge:
            badges.append(p_badge)

        # ---------------------------------------------------------------------
        # 5. Account Recency Decay (Di)
        # ---------------------------------------------------------------------
        d_score, d_badge = self._compute_recency_decay(lead, current_time)
        if d_badge:
            badges.append(d_badge)

        # ---------------------------------------------------------------------
        # Weighted Composite Score
        # ---------------------------------------------------------------------
        raw_score = (
            (self.w_urgency * u_score)
            + (self.w_value * v_score)
            + (self.w_pacing * t_score)
            + (self.w_priority * p_score)
            + (self.w_recency * d_score)
        )
        final_score = round(min(100.0, max(0.0, raw_score)), 2)

        breakdown = {
            "score": final_score,
            "factors": {
                "urgency": round(u_score, 2),
                "deal_value": round(v_score, 2),
                "target_pacing_boost": round(t_score, 2),
                "priority": round(p_score, 2),
                "recency_decay": round(d_score, 2),
            },
            "conversion_likelihood": conversion_rate,
            "badges": badges,
        }

        return final_score, breakdown

    def score_candidates(
        self,
        candidates: List[Dict[str, Any]],
        territory_max_deal: Optional[float] = None,
        target_revenue: Optional[float] = 0.0,
        achieved_revenue: Optional[float] = 0.0,
        now: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """
        Scores and ranks a collection of candidate stops.
        Sorts candidates by:
        1. Mandatory flag (True first)
        2. Score descending
        """
        t_rev = float(target_revenue or 0.0)
        a_rev = float(achieved_revenue or 0.0)
        scored = []
        for cand in candidates:
            lead_mock = None
            if cand.get("lead_id") is not None or cand.get("expected_value") is not None or cand.get("stage") is not None:
                class _LeadWrapper:
                    def __init__(self, exp_val, prio, last_dt, stage, cust_resp):
                        self.expected_value = exp_val
                        self.priority = prio
                        self.last_interaction_date = last_dt
                        self.stage = stage
                        self.customer_response = cust_resp
                lead_mock = _LeadWrapper(
                    cand.get("expected_value"),
                    cand.get("priority") or "MEDIUM",
                    cand.get("last_interaction_date"),
                    cand.get("stage"),
                    cand.get("customer_response"),
                )

            fu_mock = None
            linked_fus = cand.get("linked_followups") or []
            if linked_fus:
                fu_mock = linked_fus[0]
            elif cand.get("due_at") is not None:
                class _FuWrapper:
                    def __init__(self, due, act_type, prio):
                        self.due_at = due
                        self.action_type = act_type
                        self.priority = prio
                fu_mock = _FuWrapper(
                    cand.get("due_at"),
                    "Visit" if cand.get("activity_type") == "PHYSICAL_VISIT" else "Call",
                    "URGENT" if cand.get("is_mandatory") else cand.get("priority", "MEDIUM"),
                )

            score, breakdown = self.calculate_candidate_score(
                lead=lead_mock,
                follow_up=fu_mock,
                territory_max_deal=territory_max_deal,
                target_revenue=t_rev,
                achieved_revenue=a_rev,
                now=now,
                stage=cand.get("stage"),
                customer_response=cand.get("customer_response"),
            )

            cand_copy = dict(cand)
            cand_copy["total_score"] = score
            cand_copy["score_breakdown"] = breakdown
            cand_copy["conversion_likelihood"] = breakdown.get("conversion_likelihood", 0.25)
            cand_copy["reasons"] = {
                "factors": breakdown["factors"],
                "badges": breakdown["badges"],
            }
            scored.append(cand_copy)

        scored.sort(
            key=lambda c: (1 if c.get("is_mandatory") else 0, c.get("total_score", 0.0)),
            reverse=True,
        )
        return scored

    # Alias for compatibility
    score_leads = score_candidates

    def _compute_urgency(
        self,
        follow_up: Optional[FollowUp],
        task: Optional[Task],
        now: datetime,
    ) -> Tuple[float, Optional[Dict[str, str]]]:
        """Calculates urgency factor Ui considering overdue status and chronic backlog caps."""
        target_dt = None
        is_fixed_appointment = False

        if follow_up and follow_up.due_at:
            target_dt = follow_up.due_at
            if follow_up.action_type in ("Visit", "Meeting", "Demo"):
                is_fixed_appointment = True
        elif task and task.due_date:
            target_dt = task.due_date

        if not target_dt:
            return 10.0, None

        # Ensure tz-aware comparison
        if target_dt.tzinfo is None:
            target_dt = target_dt.replace(tzinfo=timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        delta_seconds = (target_dt - now).total_seconds()
        delta_days = delta_seconds / 86400.0

        # Due today (within next 14 hours or same calendar day)
        if abs(delta_days) < 0.6:
            if is_fixed_appointment:
                return 100.0, {
                    "type": "URGENCY",
                    "text": "Fixed Appointment Due Today",
                }
            return 70.0, {"type": "URGENCY", "text": "Follow-up Due Today"}

        # Overdue
        if delta_seconds < 0:
            overdue_days = abs(delta_days)
            if overdue_days <= 3.0:
                return 85.0, {
                    "type": "URGENCY",
                    "text": f"Overdue ({int(overdue_days)}d)",
                }
            if overdue_days > float(self.chronic_backlog_days):
                # Chronic backlog cap: Prevent old backlog from monopolizing daily route
                return float(self.chronic_backlog_cap), {
                    "type": "CHRONIC_BACKLOG",
                    "text": f"Chronic Backlog ({int(overdue_days)}d overdue - Alert)",
                }
            return 50.0, {
                "type": "URGENCY",
                "text": f"Overdue ({int(overdue_days)}d)",
            }

        # Upcoming within 48h
        if delta_days <= 2.0:
            return 40.0, {"type": "URGENCY", "text": "Due Within 48 Hours"}

        return 20.0, None

    @staticmethod
    def _compute_conversion_likelihood(
        stage: Optional[str] = None,
        customer_response: Optional[str] = None,
    ) -> float:
        """
        Calculates composite conversion likelihood Ci in [0.05, 0.95].
        Provisional stage heuristics H(Si):
          - QUALIFIED: 0.70
          - INTERESTED: 0.45
          - CONTACTED: 0.25
          - NEW: 0.10
          - Default / Neutral / Missing: 0.25
        Responsiveness adjustment delta_resp from customer_response in [-0.15, +0.10]:
          - Positive keywords: +0.10
          - Receptive keywords: +0.05
          - Hesitant keywords: -0.05
          - Negative keywords: -0.15
        """
        stage_str = (stage or "").strip().upper()
        if stage_str == "QUALIFIED":
            h_stage = 0.70
        elif stage_str == "INTERESTED":
            h_stage = 0.45
        elif stage_str == "CONTACTED":
            h_stage = 0.25
        elif stage_str == "NEW":
            h_stage = 0.10
        elif stage_str == "CONVERTED":
            h_stage = 0.95
        elif stage_str == "LOST":
            h_stage = 0.05
        else:
            h_stage = 0.25

        delta_resp = 0.0
        if customer_response and isinstance(customer_response, str):
            resp_lower = customer_response.strip().lower()
            if any(k in resp_lower for k in ["positive", "ready", "high", "enthusiastic", "urgent"]):
                delta_resp = 0.10
            elif any(k in resp_lower for k in ["receptive", "open", "interested", "favorable"]):
                delta_resp = 0.05
            elif any(k in resp_lower for k in ["reluctant", "hesitant", "skeptical", "budget constraints", "poor"]):
                delta_resp = -0.15
            elif any(k in resp_lower for k in ["busy", "neutral", "follow up later", "callback"]):
                delta_resp = -0.05

        composite = h_stage + delta_resp
        return round(max(0.05, min(0.95, composite)), 4)

    def _compute_deal_value(
        self,
        lead: Optional[Lead],
        territory_max_deal: Optional[float],
        stage: Optional[str] = None,
        customer_response: Optional[str] = None,
    ) -> Tuple[float, Optional[Dict[str, str]], Optional[Dict[str, str]], float, float]:
        """
        Calculates commercial value factor Vi and Conversion likelihood Ci.
        Expected Commercial Value: Vi_exp = V_raw * Ci (or 30.0 * Ci if missing).
        Normalized score Vi: min(100.0, (Vi_exp / V_max) * 100.0) (or 30.0 * Ci if V_max missing).
        """
        deal_value = 0.0
        if lead and getattr(lead, "expected_value", None) is not None:
            val = lead.expected_value
            if isinstance(val, (int, float)) and not (math.isnan(val) or math.isinf(val)) and val > 0:
                deal_value = float(val)

        eff_stage = None
        raw_stage = getattr(lead, "stage", None) if lead else None
        if isinstance(raw_stage, str):
            eff_stage = raw_stage
        elif isinstance(stage, str):
            eff_stage = stage

        eff_resp = None
        raw_resp = getattr(lead, "customer_response", None) if lead else None
        if isinstance(raw_resp, str):
            eff_resp = raw_resp
        elif isinstance(customer_response, str):
            eff_resp = customer_response

        c_i = self._compute_conversion_likelihood(eff_stage, eff_resp)

        v_badge = None
        c_badge = None

        if c_i >= 0.60:
            stage_display = eff_stage.capitalize() if eff_stage else "High"
            c_badge = {
                "type": "CONVERSION",
                "text": f"High Conversion: {int(c_i * 100)}% ({stage_display} Stage)",
            }

        # Territory benchmark missing or <= 0
        if territory_max_deal is None or territory_max_deal <= 0.0:
            if deal_value > 0:
                v_exp = deal_value * c_i
                v_score = round(30.0 * c_i, 2)
                v_badge = {
                    "type": "VALUE",
                    "text": f"Deal: ₹{deal_value:,.0f} (Territory Baseline)",
                }
            else:
                v_score = round(30.0 * c_i, 2)
            return v_score, v_badge, c_badge, deal_value, c_i

        # Territory benchmark is present
        if deal_value <= 0:
            v_score = round(30.0 * c_i, 2)
            return v_score, None, c_badge, 0.0, c_i

        v_exp = deal_value * c_i
        normalized = min(100.0, (v_exp / territory_max_deal) * 100.0)
        v_badge = {
            "type": "VALUE",
            "text": f"Expected: ₹{v_exp:,.0f} ({int(c_i * 100)}% Conv)",
        }
        return round(normalized, 2), v_badge, c_badge, deal_value, c_i

    def _compute_target_pacing_heuristic(
        self,
        deal_val: float,
        target_revenue: float,
        achieved_revenue: float,
    ) -> Tuple[float, Optional[Dict[str, str]]]:
        """
        Calculates candidate-sensitive target pacing boost.
        Prioritizes deals that can significantly close the quota deficit.
        """
        if target_revenue <= 0.0 or achieved_revenue >= target_revenue:
            return 0.0, None

        deficit = max(0.0, target_revenue - achieved_revenue)
        deficit_ratio = min(1.0, deficit / target_revenue)

        if deal_val <= 0:
            # Employee is behind quota, but this lead has no known value
            return round(deficit_ratio * 30.0, 2), None

        contribution_ratio = min(1.0, deal_val / deficit)
        # Scales pacing score between 50% and 100% of the deficit ratio
        pacing_boost = min(
            100.0,
            deficit_ratio * (0.5 + 0.5 * contribution_ratio) * 100.0,
        )

        badge = {
            "type": "PACING",
            "text": f"Quota Closer ({int(contribution_ratio * 100)}% of Deficit)",
        }
        return pacing_boost, badge

    def _compute_priority(
        self,
        lead: Optional[Lead],
        follow_up: Optional[FollowUp],
        task: Optional[Task],
    ) -> Tuple[float, Optional[Dict[str, str]]]:
        """Calculates operational priority factor Pi."""
        priorities: List[str] = []
        if task and task.priority:
            priorities.append(task.priority.upper())
        if follow_up and follow_up.priority:
            priorities.append(follow_up.priority.upper())
        if lead and lead.priority:
            priorities.append(lead.priority.upper())

        if "URGENT" in priorities:
            return 100.0, {"type": "PRIORITY", "text": "Urgent Directive"}
        if "HIGH" in priorities:
            return 80.0, {"type": "PRIORITY", "text": "High Priority"}
        if "MEDIUM" in priorities:
            return 50.0, None
        if "LOW" in priorities:
            return 20.0, None

        return 40.0, None

    def _compute_recency_decay(
        self,
        lead: Optional[Lead],
        now: datetime,
    ) -> Tuple[float, Optional[Dict[str, str]]]:
        """Calculates recency decay factor Di to prevent client relationship neglect."""
        if not lead or not lead.last_interaction_date:
            return 50.0, {"type": "RECENCY", "text": "New / Uncontacted Account"}

        last_dt = lead.last_interaction_date
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        # Safeguard: If date is in the future due to clock skew, clamp to now
        if last_dt > now:
            last_dt = now

        days_since = (now - last_dt).total_seconds() / 86400.0
        decay_score = min(100.0, max(0.0, (days_since / 30.0) * 100.0))

        badge = None
        if days_since >= 21.0:
            badge = {
                "type": "RECENCY",
                "text": f"Account Neglect ({int(days_since)}d since visit)",
            }

        return decay_score, badge
