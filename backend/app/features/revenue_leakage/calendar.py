from datetime import date, timedelta
from typing import Optional, Set


def calculate_working_days(
    start_date: date,
    end_date: date,
    holidays: Optional[Set[date]] = None,
    approved_leaves: Optional[Set[date]] = None,
) -> int:
    """
    Computes working days between start_date and end_date (inclusive).
    Locked Decision D4 / RL-8:
    - Working days are Monday through Saturday (Sunday is excluded).
    - Recognized public holidays (holidays table) are excluded.
    - Approved employee leave days are excluded.
    - If end_date < start_date, returns 0.
    """
    if end_date < start_date:
        return 0

    holiday_set = holidays or set()
    leave_set = approved_leaves or set()

    working_days = 0
    curr = start_date

    while curr <= end_date:
        # 0 = Monday, ..., 5 = Saturday, 6 = Sunday
        if curr.weekday() != 6:  # Exclude Sundays
            if curr not in holiday_set and curr not in leave_set:
                working_days += 1
        curr += timedelta(days=1)

    return working_days
