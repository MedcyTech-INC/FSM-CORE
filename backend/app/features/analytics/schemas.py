from typing import List, Optional
from pydantic import BaseModel


class KpiSummaryCard(BaseModel):
    total_workforce: int
    strike_rate: float
    pipeline_value: float
    expense_burn: float


class ZonalMetricItem(BaseModel):
    zone: str
    completed_calls: int
    target_calls: int
    expense_burn: float
    achievement_percentage: float


class FunnelStageItem(BaseModel):
    stage_key: str
    stage_label: str
    count: int
    value: float
    conversion_percentage: float


class ZonalLeaderboardItem(BaseModel):
    rank: int
    zone: str
    achievement_percentage: float
    completed_calls: int
    status: str  # EXCEEDING, ON_TRACK, NEEDS_ATTENTION


class ExecutiveOverviewResponse(BaseModel):
    kpis: KpiSummaryCard
    zonal_chart: List[ZonalMetricItem]
    funnel: List[FunnelStageItem]
    leaderboard: List[ZonalLeaderboardItem]
    as_of_date: str
    is_live_refreshed: bool = True
