export interface KpiSummary {
  total_workforce: number;
  strike_rate: number;
  pipeline_value: number;
  expense_burn: number;
}

export interface ZonalMetric {
  zone: string;
  completed_calls: number;
  target_calls: number;
  expense_burn: number;
  achievement_percentage: number;
}

export interface FunnelStage {
  stage_key: string;
  stage_label: string;
  count: number;
  value: number;
  conversion_percentage: number;
}

export interface ZonalLeaderboardEntry {
  rank: number;
  zone: string;
  achievement_percentage: number;
  completed_calls: number;
  status: 'EXCEEDING' | 'ON_TRACK' | 'NEEDS_ATTENTION';
}

export interface ExecutiveOverviewData {
  kpis: KpiSummary;
  zonal_chart: ZonalMetric[];
  funnel: FunnelStage[];
  leaderboard: ZonalLeaderboardEntry[];
  as_of_date: string;
  is_live_refreshed: boolean;
}
