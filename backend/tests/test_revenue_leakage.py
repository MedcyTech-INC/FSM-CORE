import uuid
import pytest
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.features.revenue_leakage.priority import PriorityCalculator
from app.features.revenue_leakage.models import LeakageRule
from app.features.revenue_leakage.ports import (
    FakeVisitsProvider,
    FakeOrdersProvider,
    FakeLeadsProvider,
    FakeLeaveProvider,
    FakeTargetsProvider,
    FakeSyncStateProvider,
    RuleFinding,
)
from app.features.revenue_leakage.rules.unvisited_client import UnvisitedClientRule
from app.features.revenue_leakage.rules.abandoned_lead import AbandonedLeadRule
from app.features.revenue_leakage.rules.declining_frequency import DecliningFrequencyRule
from app.features.revenue_leakage.rules.inactive_opportunity import InactiveOpportunityRule
from app.features.revenue_leakage.rules.underperforming_territory import UnderperformingTerritoryRule
from app.features.revenue_leakage.lifecycle import AlertLifecycle
from app.core.errors import FSMException


def test_priority_calculator_and_reason_words():
    calc = PriorityCalculator(
        medium_ratio=Decimal("1.50"),
        high_ratio=Decimal("2.00"),
    )
    # Ratio 1.37 -> low
    prio, ratio, reason = calc.calculate_priority(
        observed_value=Decimal("41"),
        threshold=Decimal("30"),
        unit_description="working days since last verified visit",
    )
    assert prio == "low"
    assert ratio == Decimal("1.37")
    assert "41" in reason and "30" in reason and "1.37" in reason

    # Ratio 1.50 -> medium
    prio, ratio, _ = calc.calculate_priority(
        observed_value=Decimal("45"),
        threshold=Decimal("30"),
        unit_description="working days",
    )
    assert prio == "medium"
    assert ratio == Decimal("1.50")

    # Ratio 2.03 -> high
    prio, ratio, _ = calc.calculate_priority(
        observed_value=Decimal("61"),
        threshold=Decimal("30"),
        unit_description="working days",
    )
    assert prio == "high"
    assert ratio == Decimal("2.03")

    # STRICT Language rule verification:
    forbidden = ["loss", "lost revenue", "leakage amount"]
    for phrase in forbidden:
        assert phrase not in reason.lower(), f"Forbidden phrase '{phrase}' found in reason text"


@pytest.mark.asyncio
async def test_unvisited_client_worked_examples():
    rule = LeakageRule(
        id=uuid.uuid4(),
        rule_code="unvisited_client",
        threshold_days=30,
        threshold_value=Decimal("100000.00"),
        medium_priority_ratio=Decimal("1.50"),
        high_priority_ratio=Decimal("2.00"),
        min_history_months=3,
        params={},
    )
    client_id = uuid.uuid4()
    today = date(2026, 10, 26)  # A Monday

    # 1. 41 working days ago visit, avg order 120,000 -> Fires, ratio 1.37, low
    visit_date = today - timedelta(days=58)  # ~41 working days roughly
    visits = FakeVisitsProvider({client_id: visit_date})
    orders = FakeOrdersProvider({
        client_id: {
            "average_monthly_value": Decimal("120000.00"),
            "history_months": 4,
            "became_high_value_date": today - timedelta(days=100),
            "assigned_date": today - timedelta(days=90),
        }
    })
    evaluator = UnvisitedClientRule(visits, orders, FakeLeaveProvider())
    finding = await evaluator.evaluate_client(None, rule, today, {"id": client_id, "name": "Apollo Hospitals"})
    assert finding is not None
    assert finding.entity_id == client_id
    calc = PriorityCalculator(rule.medium_priority_ratio, rule.high_priority_ratio)
    prio, ratio, reason = calc.calculate_priority(finding.observed_value, finding.threshold, finding.unit_description)
    assert prio in ("low", "medium", "high")
    assert "loss" not in reason.lower()

    # 2. Account younger than min_history_months -> skipped
    orders_young = FakeOrdersProvider({
        client_id: {
            "average_monthly_value": Decimal("120000.00"),
            "history_months": 2,  # under 3
            "became_high_value_date": today - timedelta(days=40),
            "assigned_date": today - timedelta(days=30),
        }
    })
    evaluator_young = UnvisitedClientRule(visits, orders_young, FakeLeaveProvider())
    finding_young = await evaluator_young.evaluate_client(None, rule, today, {"id": client_id, "name": "Apollo Hospitals"})
    assert finding_young is None

    # 3. Client never visited, became high value 50 days ago, assigned 20 days ago -> uses assigned date (20 days)
    visits_empty = FakeVisitsProvider({})
    orders_assigned_20 = FakeOrdersProvider({
        client_id: {
            "average_monthly_value": Decimal("150000.00"),
            "history_months": 6,
            "became_high_value_date": today - timedelta(days=70),
            "assigned_date": today - timedelta(days=23),  # ~20 working days
        }
    })
    evaluator_never = UnvisitedClientRule(visits_empty, orders_assigned_20, FakeLeaveProvider())
    finding_never = await evaluator_never.evaluate_client(None, rule, today, {"id": client_id, "name": "Apollo Hospitals"})
    # Since working days < threshold_days (30), does not fire
    assert finding_never is None


@pytest.mark.asyncio
async def test_abandoned_lead_worked_example():
    rule = LeakageRule(
        id=uuid.uuid4(),
        rule_code="abandoned_lead",
        threshold_days=30,
        threshold_value=Decimal("0.00"),
        medium_priority_ratio=Decimal("1.50"),
        high_priority_ratio=Decimal("2.00"),
        min_history_months=1,
        params={},
    )
    today = date(2026, 10, 26)
    lead_id = uuid.uuid4()
    leads = FakeLeadsProvider(
        leads=[
            {
                "id": lead_id,
                "title": "Hospital Expansion Phase 2",
                "stage": "Discovery",
                "status": "in_progress",
                "last_followup_date": today - timedelta(days=60),  # ~45 working days
                "created_date": today - timedelta(days=90),
            },
            {
                "id": uuid.uuid4(),
                "title": "Closed Lead",
                "stage": "Won",
                "status": "won",
                "last_followup_date": today - timedelta(days=60),
                "created_date": today - timedelta(days=90),
            }
        ]
    )
    evaluator = AbandonedLeadRule(leads)
    findings = await evaluator.evaluate_leads(None, rule, today)
    assert len(findings) == 1
    assert findings[0].entity_id == lead_id


@pytest.mark.asyncio
async def test_declining_frequency_worked_example():
    rule = LeakageRule(
        id=uuid.uuid4(),
        rule_code="declining_frequency",
        threshold_days=30,
        threshold_value=Decimal("0.00"),
        medium_priority_ratio=Decimal("1.50"),
        high_priority_ratio=Decimal("2.00"),
        min_history_months=3,
        params={"consecutive_months": 2, "min_fall_percent": 30},
    )
    today = date(2026, 10, 26)
    client_id = uuid.uuid4()

    # Baseline 10 orders a month, last two months 6 and 5 -> fall 50%
    orders = FakeOrdersProvider({
        client_id: {
            "average_monthly_value": Decimal("50000.00"),
            "history_months": 6,
            "baseline_order_count": Decimal("10.0"),
            "recent_monthly_counts": [6, 5],
            "baseline_type": "3-month rolling average",
        }
    })
    evaluator = DecliningFrequencyRule(orders)
    finding = await evaluator.evaluate_client(None, rule, today, {"id": client_id, "name": "Fortis Care"})
    assert finding is not None
    assert finding.observed_value == Decimal("50.0")  # 50% fall
    assert finding.threshold == Decimal("30")
    # Verify language: no money loss is stated
    assert "loss" not in finding.baseline_description.lower()
    assert finding.exposure_amount is None


@pytest.mark.asyncio
async def test_underperforming_territory_worked_example():
    rule = LeakageRule(
        id=uuid.uuid4(),
        rule_code="underperforming_territory",
        threshold_days=30,
        threshold_value=Decimal("15.00"),  # 15 percentage points
        medium_priority_ratio=Decimal("1.50"),
        high_priority_ratio=Decimal("2.00"),
        min_history_months=1,
        params={"min_elapsed_working_days": 5},
    )
    today = date(2026, 10, 26)
    terr_id = uuid.uuid4()
    # Expected 70%, achieved 40% -> shortfall 30 points. Ratio 30 / 15 = 2.0 (high)
    targets = FakeTargetsProvider({
        terr_id: {
            "territory_name": "Bangalore Central",
            "target_amount": Decimal("1000000.00"),
            "achieved_amount": Decimal("400000.00"),
            "achieved_percent": Decimal("40.0"),
            "expected_percent": Decimal("70.0"),
            "elapsed_working_days": 18,
            "total_working_days": 26,
            "target_id": uuid.uuid4(),
        }
    })
    evaluator = UnderperformingTerritoryRule(targets)
    finding = await evaluator.evaluate_territory(None, rule, today, terr_id, "Bangalore Central")
    assert finding is not None
    assert finding.observed_value == Decimal("30.0")
    assert finding.threshold == Decimal("15.00")
    calc = PriorityCalculator(rule.medium_priority_ratio, rule.high_priority_ratio)
    prio, ratio, reason = calc.calculate_priority(finding.observed_value, finding.threshold, finding.unit_description)
    assert prio == "high"
    assert ratio == Decimal("2.00")
