from decimal import Decimal, ROUND_HALF_UP
from typing import Tuple
from app.features.revenue_leakage.models import AttentionPriority


def calculate_priority_and_reason(
    observed_value: Decimal,
    threshold: Decimal,
    medium_priority_ratio: Decimal,
    high_priority_ratio: Decimal,
    unit_description: str = "working days",
) -> Tuple[AttentionPriority, Decimal, str]:
    """
    T-07 / Section 5.2 Attention Priority:
    ratio = observed_value / threshold
    high when ratio >= high_priority_ratio
    medium when ratio >= medium_priority_ratio
    otherwise low

    Returns: (AttentionPriority, ratio, plain_words_reason)
    """
    if threshold <= Decimal("0"):
        ratio = Decimal("1.00")
    else:
        ratio = (observed_value / threshold).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    if ratio >= high_priority_ratio:
        priority = AttentionPriority.HIGH
    elif ratio >= medium_priority_ratio:
        priority = AttentionPriority.MEDIUM
    else:
        priority = AttentionPriority.LOW

    # Format human-friendly plain words explanation
    # e.g. "41 working days since the last verified visit against a threshold of 30 (ratio 1.37)."
    obs_str = f"{observed_value.normalize():f}" if observed_value % 1 == 0 else f"{observed_value:.2f}"
    thresh_str = f"{threshold.normalize():f}" if threshold % 1 == 0 else f"{threshold:.2f}"

    reason = (
        f"{obs_str} {unit_description} observed against a threshold of {thresh_str} "
        f"(ratio {ratio:.2f})."
    )

    return priority, ratio, reason


class PriorityCalculator:
    def __init__(self, medium_ratio: Decimal, high_ratio: Decimal):
        self.medium_ratio = medium_ratio
        self.high_ratio = high_ratio

    def calculate_priority(
        self, observed_value: Decimal, threshold: Decimal, unit_description: str = "working days"
    ) -> Tuple[str, Decimal, str]:
        prio, ratio, reason = calculate_priority_and_reason(
            observed_value, threshold, self.medium_ratio, self.high_ratio, unit_description
        )
        return prio.value if hasattr(prio, "value") else str(prio), ratio, reason
