import pytest
from datetime import date, datetime, timezone
from decimal import Decimal

from app.features.monthly_target.calendar import calculate_working_days
from app.features.monthly_target.run_rate import compute_target_metrics, to_business_date


def test_t06_calendar_working_days():
    """T-06: Test working days calculation (Mon-Sat, excluding Sundays, holidays, approved leave)."""
    # 2026-11-02 (Monday) to 2026-11-08 (Sunday) = 7 calendar days, 6 working days (Mon-Sat)
    mon = date(2026, 11, 2)
    sun = date(2026, 11, 8)
    assert calculate_working_days(mon, sun) == 6

    # Adding a public holiday on Wednesday 2026-11-04
    holidays = {date(2026, 11, 4)}
    assert calculate_working_days(mon, sun, holidays=holidays) == 5

    # Adding approved leave on Friday 2026-11-06
    leaves = {date(2026, 11, 6)}
    assert calculate_working_days(mon, sun, holidays=holidays, approved_leaves=leaves) == 4

    # Holiday on a Sunday should not double-subtract
    sunday_holiday = {date(2026, 11, 8)}
    assert calculate_working_days(mon, sun, holidays=sunday_holiday) == 6

    # Same day range: Monday -> 1 working day
    assert calculate_working_days(mon, mon) == 1
    # Same day range on Sunday -> 0 working days
    assert calculate_working_days(sun, sun) == 0

    # End date before start date -> 0 working days
    assert calculate_working_days(sun, mon) == 0


def test_t07_numeric_cases_table():
    """
    T-07: Tests every row of the Section 10.1 numeric specification table.
    """
    start = date(2026, 11, 1)
    end = date(2026, 11, 30)
    today = date(2026, 11, 10)

    # 1. Normal: target=100, current=40, days_left=10 -> gap=60, run rate=6.00, percent=40, state='active'
    m1 = compute_target_metrics(
        target_value=Decimal("100"),
        current_value=Decimal("40"),
        start_date=start,
        end_date=end,
        today=today,
        working_days_left=10,
    )
    assert m1.gap == Decimal("60.00")
    assert m1.required_daily_run_rate == Decimal("6.00")
    assert m1.percent_complete == Decimal("40")
    assert m1.state == "active"

    # 2. Rounding: target=100, current=0, days_left=3 -> gap=100, run rate=33.33, percent=0, state='active'
    m2 = compute_target_metrics(
        target_value=Decimal("100"),
        current_value=Decimal("0"),
        start_date=start,
        end_date=end,
        today=today,
        working_days_left=3,
    )
    assert m2.gap == Decimal("100.00")
    assert m2.required_daily_run_rate == Decimal("33.33")
    assert m2.percent_complete == Decimal("0")
    assert m2.state == "active"

    # 3. Achieved exactly: target=100, current=100, days_left=5 -> gap=0, run rate=0.00, percent=100, state='achieved'
    m3 = compute_target_metrics(
        target_value=Decimal("100"),
        current_value=Decimal("100"),
        start_date=start,
        end_date=end,
        today=today,
        working_days_left=5,
    )
    assert m3.gap == Decimal("0.00")
    assert m3.required_daily_run_rate == Decimal("0.00")
    assert m3.percent_complete == Decimal("100")
    assert m3.state == "achieved"

    # 4. Over-achieved: target=100, current=120, days_left=5 -> gap=0, run rate=0.00, percent=120, state='achieved'
    m4 = compute_target_metrics(
        target_value=Decimal("100"),
        current_value=Decimal("120"),
        start_date=start,
        end_date=end,
        today=today,
        working_days_left=5,
    )
    assert m4.gap == Decimal("0.00")
    assert m4.required_daily_run_rate == Decimal("0.00")
    assert m4.percent_complete == Decimal("120")
    assert m4.state == "achieved"

    # 5. No days left, gap open: target=100, current=40, days_left=0 -> gap=60, run rate=null ('no working days left'), percent=40, state='ended_short'
    m5 = compute_target_metrics(
        target_value=Decimal("100"),
        current_value=Decimal("40"),
        start_date=start,
        end_date=end,
        today=today,
        working_days_left=0,
    )
    assert m5.gap == Decimal("60.00")
    assert m5.required_daily_run_rate is None
    assert m5.run_rate_message == "no working days left"
    assert m5.percent_complete == Decimal("40")
    assert m5.state == "ended_short"

    # 6. Zero target: target=0, current=0, days_left=5 -> gap=0, run rate=0.00, percent=null, state='achieved'
    m6 = compute_target_metrics(
        target_value=Decimal("0"),
        current_value=Decimal("0"),
        start_date=start,
        end_date=end,
        today=today,
        working_days_left=5,
    )
    assert m6.gap == Decimal("0.00")
    assert m6.required_daily_run_rate == Decimal("0.00")
    assert m6.percent_complete is None
    assert m6.state == "achieved"

    # 7. Not started: target=100, current=0, days_left=12, today before start -> gap=100, run rate=8.33, percent=0, state='upcoming'
    m7 = compute_target_metrics(
        target_value=Decimal("100"),
        current_value=Decimal("0"),
        start_date=date(2026, 12, 1),
        end_date=date(2026, 12, 31),
        today=date(2026, 11, 20),
        working_days_left=12,
    )
    assert m7.gap == Decimal("100.00")
    assert m7.required_daily_run_rate == Decimal("8.33")
    assert m7.percent_complete == Decimal("0")
    assert m7.state == "upcoming"

    # 8. Stored value dipped below zero: target=100, current=-5, days_left=10 -> gap=100, run rate=10.00, percent=0, state='active' (displayed value 0)
    m8 = compute_target_metrics(
        target_value=Decimal("100"),
        current_value=Decimal("-5"),
        start_date=start,
        end_date=end,
        today=today,
        working_days_left=10,
    )
    assert m8.displayed_value == Decimal("0.00")
    assert m8.gap == Decimal("100.00")
    assert m8.required_daily_run_rate == Decimal("10.00")
    assert m8.percent_complete == Decimal("0")
    assert m8.state == "active"


def test_t08_timezone_conversion():
    """T-08: 2026-11-30 19:00 UTC maps to 2026-12-01 in Asia/Kolkata (+5:30)."""
    dt_utc = datetime(2026, 11, 30, 19, 0, 0, tzinfo=timezone.utc)
    b_date = to_business_date(dt_utc, business_tz_str="Asia/Kolkata")
    assert b_date == date(2026, 12, 1)

    # 2026-11-30 18:29 UTC is 23:59 IST (still 2026-11-30)
    dt_before = datetime(2026, 11, 30, 18, 29, 0, tzinfo=timezone.utc)
    assert to_business_date(dt_before, business_tz_str="Asia/Kolkata") == date(2026, 11, 30)
