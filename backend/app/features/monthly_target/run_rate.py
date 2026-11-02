from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from zoneinfo import ZoneInfo

from app.shared_contracts.enums import TargetState


@dataclass
class RunRateMetrics:
    gap: Decimal
    days_left: int
    required_daily_run_rate: Optional[Decimal]
    percent_complete: Optional[Decimal]
    state: str
    displayed_value: Decimal
    run_rate_message: Optional[str] = None


def to_business_date(dt: datetime, business_tz_str: str = "Asia/Kolkata") -> date:
    """
    T-08: Converts any event timestamp to the configured business timezone date.
    Critic Gap MT-5: Never uses local server date.
    2026-11-30 19:00 UTC maps to 2026-12-01 in Asia/Kolkata.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    tz = ZoneInfo(business_tz_str)
    return dt.astimezone(tz).date()


def compute_target_metrics(
    target_value: Decimal,
    current_value: Decimal,
    start_date: date,
    end_date: date,
    today: date,
    working_days_left: int,
) -> RunRateMetrics:
    """
    T-07: Pure logic calculating gap, run rate, percent complete, and target lifecycle state.
    Section 5.5 & 10.1 specification.
    """
    # Displayed value never drops below zero (Section 5.3)
    displayed_value = max(Decimal("0.00"), current_value)

    # Gap = max(0, target_value - max(0, current_value))
    gap = max(Decimal("0.00"), target_value - displayed_value)

    # Percent complete (uncapped; null if target_value is 0)
    percent_complete: Optional[Decimal] = None
    if target_value > Decimal("0.00"):
        raw_pct = (displayed_value / target_value) * Decimal("100")
        percent_complete = raw_pct.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        # Simplify integer percentages (e.g. 40.00 -> 40)
        if percent_complete == percent_complete.to_integral():
            percent_complete = percent_complete.quantize(Decimal("1"))

    # Determine state
    if current_value >= target_value:
        state = TargetState.ACHIEVED.value
    elif today < start_date:
        state = TargetState.UPCOMING.value
    elif working_days_left == 0 or today > end_date:
        state = TargetState.ENDED_SHORT.value
    else:
        state = TargetState.ACTIVE.value

    # Required daily run rate
    required_run_rate: Optional[Decimal] = None
    message: Optional[str] = None

    if current_value >= target_value:
        required_run_rate = Decimal("0.00")
    elif working_days_left <= 0:
        required_run_rate = None
        message = "no working days left"
    else:
        raw_rate = gap / Decimal(working_days_left)
        required_run_rate = raw_rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return RunRateMetrics(
        gap=gap,
        days_left=working_days_left,
        required_daily_run_rate=required_run_rate,
        percent_complete=percent_complete,
        state=state,
        displayed_value=displayed_value,
        run_rate_message=message,
    )
