import math
import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock

from app.features.daily_sales_plan.services.lead_scorer import LeadScorer


class TestLeadScorer(unittest.TestCase):
    def setUp(self):
        self.scorer = LeadScorer()
        self.now = datetime(2026, 10, 26, 9, 0, 0, tzinfo=timezone.utc)

    def test_missing_or_negative_deal_value_fallback(self):
        """Missing, negative, or NaN deal value uses conversion-aware baseline score Vi = 30.0 * Ci."""
        lead = MagicMock()
        lead.expected_value = None
        lead.priority = "MEDIUM"
        lead.stage = "QUALIFIED"  # Ci = 0.70 -> Vi = 30.0 * 0.70 = 21.0
        lead.customer_response = None
        lead.last_interaction_date = None

        # Territory max is valid, but deal value is None -> 30.0 * 0.70 = 21.0
        score, bd = self.scorer.calculate_candidate_score(
            lead=lead, territory_max_deal=500000.0, now=self.now
        )
        self.assertEqual(bd["factors"]["deal_value"], 21.0)

        # Deal value is negative -> 30.0 * 0.70 = 21.0
        lead.expected_value = -5000.0
        score, bd = self.scorer.calculate_candidate_score(
            lead=lead, territory_max_deal=500000.0, now=self.now
        )
        self.assertEqual(bd["factors"]["deal_value"], 21.0)

        # Deal value is NaN -> 30.0 * 0.70 = 21.0
        lead.expected_value = float("nan")
        score, bd = self.scorer.calculate_candidate_score(
            lead=lead, territory_max_deal=500000.0, now=self.now
        )
        self.assertEqual(bd["factors"]["deal_value"], 21.0)

    def test_missing_or_non_positive_territory_max_fallback(self):
        """If territory_max_deal is None or <= 0, applies conversion-aware baseline Vi = 30.0 * Ci."""
        lead = MagicMock()
        lead.expected_value = 100000.0
        lead.priority = "HIGH"
        lead.stage = "QUALIFIED"  # Ci = 0.70 -> Vi = 30.0 * 0.70 = 21.0
        lead.customer_response = None
        lead.last_interaction_date = None

        # None territory max
        score, bd = self.scorer.calculate_candidate_score(
            lead=lead, territory_max_deal=None, now=self.now
        )
        self.assertEqual(bd["factors"]["deal_value"], 21.0)

        # Zero territory max
        score, bd = self.scorer.calculate_candidate_score(
            lead=lead, territory_max_deal=0.0, now=self.now
        )
        self.assertEqual(bd["factors"]["deal_value"], 21.0)

        # Negative territory max
        score, bd = self.scorer.calculate_candidate_score(
            lead=lead, territory_max_deal=-100.0, now=self.now
        )
        self.assertEqual(bd["factors"]["deal_value"], 21.0)

    def test_target_pacing_heuristic_differentiates_leads(self):
        """Candidate-sensitive target pacing boosts large quota-closing deals more than small deals."""
        lead_small = MagicMock()
        lead_small.expected_value = 20000.0  # 5% of 400k deficit
        lead_small.priority = "MEDIUM"
        lead_small.last_interaction_date = None

        lead_large = MagicMock()
        lead_large.expected_value = 320000.0  # 80% of 400k deficit
        lead_large.priority = "MEDIUM"
        lead_large.last_interaction_date = None

        target_rev = 1000000.0
        achieved_rev = 600000.0  # 400k deficit

        score_s, bd_s = self.scorer.calculate_candidate_score(
            lead=lead_small,
            territory_max_deal=500000.0,
            target_revenue=target_rev,
            achieved_revenue=achieved_rev,
            now=self.now,
        )

        score_l, bd_l = self.scorer.calculate_candidate_score(
            lead=lead_large,
            territory_max_deal=500000.0,
            target_revenue=target_rev,
            achieved_revenue=achieved_rev,
            now=self.now,
        )

        # Large deal closes 80% of deficit -> must score strictly higher on target_pacing_boost
        pacing_s = bd_s["factors"]["target_pacing_boost"]
        pacing_l = bd_l["factors"]["target_pacing_boost"]
        self.assertGreater(pacing_l, pacing_s)
        self.assertGreater(score_l, score_s)

    def test_target_pacing_heuristic_zero_when_on_track(self):
        """When rep has met or exceeded target quota, target pacing boost is 0.0."""
        lead = MagicMock()
        lead.expected_value = 200000.0
        lead.priority = "MEDIUM"
        lead.last_interaction_date = None

        score, bd = self.scorer.calculate_candidate_score(
            lead=lead,
            territory_max_deal=500000.0,
            target_revenue=500000.0,
            achieved_revenue=550000.0,  # Exceeded
            now=self.now,
        )
        self.assertEqual(bd["factors"]["target_pacing_boost"], 0.0)

    def test_urgency_scoring_and_chronic_backlog_cap(self):
        """Follow-ups due today score high; chronic backlog (>7d) is capped at 40."""
        # Due today fixed visit
        fu_today = MagicMock()
        fu_today.due_at = self.now + timedelta(hours=2)
        fu_today.action_type = "Visit"
        fu_today.priority = "HIGH"

        _, bd_today = self.scorer.calculate_candidate_score(follow_up=fu_today, now=self.now)
        self.assertEqual(bd_today["factors"]["urgency"], 100.0)

        # Overdue 2 days (within 1-3d grace period)
        fu_2d = MagicMock()
        fu_2d.due_at = self.now - timedelta(days=2)
        fu_2d.action_type = "Call"
        fu_2d.priority = "MEDIUM"

        _, bd_2d = self.scorer.calculate_candidate_score(follow_up=fu_2d, now=self.now)
        self.assertEqual(bd_2d["factors"]["urgency"], 85.0)

        # Chronic backlog (14 days overdue)
        fu_14d = MagicMock()
        fu_14d.due_at = self.now - timedelta(days=14)
        fu_14d.action_type = "Call"
        fu_14d.priority = "LOW"

        _, bd_14d = self.scorer.calculate_candidate_score(follow_up=fu_14d, now=self.now)
        self.assertEqual(bd_14d["factors"]["urgency"], 40.0)
        chronic_badges = [b for b in bd_14d["badges"] if b["type"] == "CHRONIC_BACKLOG"]
        self.assertEqual(len(chronic_badges), 1)

    def test_recency_decay_and_future_date_safeguard(self):
        """Accounts unvisited for >21d get neglect badge; future dates clamped to now."""
        lead_neglected = MagicMock()
        lead_neglected.expected_value = 10000.0
        lead_neglected.priority = "MEDIUM"
        lead_neglected.last_interaction_date = self.now - timedelta(days=25)

        _, bd_neg = self.scorer.calculate_candidate_score(lead=lead_neglected, now=self.now)
        self.assertAlmostEqual(bd_neg["factors"]["recency_decay"], 83.33, places=1)
        neg_badges = [b for b in bd_neg["badges"] if b["type"] == "RECENCY"]
        self.assertEqual(len(neg_badges), 1)

        # Future date due to clock skew
        lead_future = MagicMock()
        lead_future.expected_value = 10000.0
        lead_future.priority = "MEDIUM"
        lead_future.last_interaction_date = self.now + timedelta(days=5)

        _, bd_fut = self.scorer.calculate_candidate_score(lead=lead_future, now=self.now)
        self.assertEqual(bd_fut["factors"]["recency_decay"], 0.0)

    def test_conversion_qualified_moderate_outscores_cold_large_deal(self):
        """Qualified moderate deal (₹100k, 70% conv) outscores cold large deal (₹200k, 10% conv)."""
        lead_qual = MagicMock()
        lead_qual.expected_value = 100000.0
        lead_qual.stage = "QUALIFIED"
        lead_qual.priority = "MEDIUM"
        lead_qual.customer_response = None
        lead_qual.last_interaction_date = None

        lead_cold = MagicMock()
        lead_cold.expected_value = 200000.0
        lead_cold.stage = "NEW"
        lead_cold.priority = "MEDIUM"
        lead_cold.customer_response = None
        lead_cold.last_interaction_date = None

        terr_max = 200000.0
        # Lead Qual: Vi_exp = 100000 * 0.70 = 70000 -> Vi = (70000 / 200000) * 100 = 35.0
        _, bd_qual = self.scorer.calculate_candidate_score(
            lead=lead_qual, territory_max_deal=terr_max, now=self.now
        )
        # Lead Cold: Vi_exp = 200000 * 0.10 = 20000 -> Vi = (20000 / 200000) * 100 = 10.0
        _, bd_cold = self.scorer.calculate_candidate_score(
            lead=lead_cold, territory_max_deal=terr_max, now=self.now
        )

        self.assertEqual(bd_qual["factors"]["deal_value"], 35.0)
        self.assertEqual(bd_cold["factors"]["deal_value"], 10.0)
        self.assertGreater(bd_qual["factors"]["deal_value"], bd_cold["factors"]["deal_value"])

        # Qual lead has CONVERSION badge
        conv_badges = [b for b in bd_qual["badges"] if b["type"] == "CONVERSION"]
        self.assertEqual(len(conv_badges), 1)
        self.assertIn("70%", conv_badges[0]["text"])

    def test_missing_deal_value_scored_by_stage_heuristic(self):
        """Missing deal values are strictly differentiated by stage heuristic (21.0 > 13.5 > 7.5 > 3.0)."""
        stages_expected = [
            ("QUALIFIED", 21.0),
            ("INTERESTED", 13.5),
            ("CONTACTED", 7.5),
            ("NEW", 3.0),
        ]
        for stage_name, expected_score in stages_expected:
            lead = MagicMock()
            lead.expected_value = None
            lead.stage = stage_name
            lead.priority = "MEDIUM"
            lead.customer_response = None
            lead.last_interaction_date = None

            _, bd = self.scorer.calculate_candidate_score(
                lead=lead, territory_max_deal=500000.0, now=self.now
            )
            self.assertEqual(
                bd["factors"]["deal_value"],
                expected_score,
                f"Failed for stage {stage_name}",
            )

    def test_customer_responsiveness_adjustment(self):
        """Customer response adjusts stage conversion likelihood within clamped [0.05, 0.95]."""
        # Base Qualified = 0.70
        lead_pos = MagicMock()
        lead_pos.expected_value = 100000.0
        lead_pos.stage = "QUALIFIED"
        lead_pos.customer_response = "Doctor was very positive and eager to prescribe"
        lead_pos.priority = "MEDIUM"
        lead_pos.last_interaction_date = None

        _, bd_pos = self.scorer.calculate_candidate_score(
            lead=lead_pos, territory_max_deal=100000.0, now=self.now
        )
        # 0.70 + 0.10 = 0.80 -> Vi = (80000 / 100000) * 100 = 80.0
        self.assertEqual(bd_pos["factors"]["deal_value"], 80.0)

        # Qualified with negative response -> 0.70 - 0.15 = 0.55
        lead_neg = MagicMock()
        lead_neg.expected_value = 100000.0
        lead_neg.stage = "QUALIFIED"
        lead_neg.customer_response = "Doctor is reluctant due to budget constraints"
        lead_neg.priority = "MEDIUM"
        lead_neg.last_interaction_date = None

        _, bd_neg = self.scorer.calculate_candidate_score(
            lead=lead_neg, territory_max_deal=100000.0, now=self.now
        )
        # 0.70 - 0.15 = 0.55 -> Vi = (55000 / 100000) * 100 = 55.0
        self.assertEqual(bd_neg["factors"]["deal_value"], 55.0)

    def test_target_pacing_evaluates_nominal_deal_without_double_discounting(self):
        """Target pacing evaluates nominal deal value without compound conversion discounting."""
        lead_qual = MagicMock()
        lead_qual.expected_value = 200000.0
        lead_qual.stage = "QUALIFIED"
        lead_qual.priority = "MEDIUM"
        lead_qual.customer_response = None
        lead_qual.last_interaction_date = None

        lead_new = MagicMock()
        lead_new.expected_value = 200000.0
        lead_new.stage = "NEW"
        lead_new.priority = "MEDIUM"
        lead_new.customer_response = None
        lead_new.last_interaction_date = None

        target_rev = 1000000.0
        achieved_rev = 600000.0  # 400k deficit, nominal contribution ratio = 200k / 400k = 0.50

        _, bd_qual = self.scorer.calculate_candidate_score(
            lead=lead_qual,
            territory_max_deal=500000.0,
            target_revenue=target_rev,
            achieved_revenue=achieved_rev,
            now=self.now,
        )
        _, bd_new = self.scorer.calculate_candidate_score(
            lead=lead_new,
            territory_max_deal=500000.0,
            target_revenue=target_rev,
            achieved_revenue=achieved_rev,
            now=self.now,
        )

        # Target pacing must be IDENTICAL because both represent nominal ₹200k towards deficit
        self.assertEqual(
            bd_qual["factors"]["target_pacing_boost"],
            bd_new["factors"]["target_pacing_boost"],
        )
        # But deal_value factor properly differentiates them (QUALIFIED = 28.0 vs NEW = 4.0)
        self.assertGreater(
            bd_qual["factors"]["deal_value"],
            bd_new["factors"]["deal_value"],
        )


if __name__ == "__main__":
    unittest.main()
