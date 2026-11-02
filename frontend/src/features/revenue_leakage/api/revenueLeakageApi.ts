import {
  AlertActionPayload,
  AlertDetailDTO,
  AlertItemDTO,
  PaginatedAlertsDTO,
  RuleDTO,
  RulePatchPayload,
  ScanRunDTO,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Mock Store for demo / fallback resilience
let mockAlerts: AlertItemDTO[] = [
  {
    id: 'a1b2c3d4-0001-4000-8000-000000000001',
    rule_code: 'unvisited_client',
    rule_name: 'High-Value Client Unvisited',
    entity_type: 'customer',
    entity_id: 'c1111111-0000-0000-0000-000000000001',
    entity_label: 'Apollo Multispeciality Hospitals',
    owner_id: 'u1111111-0000-0000-0000-000000000001',
    classification: 'operational_warning',
    attention_priority: 'medium',
    priority_reason: '41 working days since last contact observed against a threshold of 30 (ratio 1.37).',
    observation: {
      working_days_overdue: 41,
      threshold_days: 30,
      average_monthly_order_value: 120000.0,
      suggested_check: 'Schedule an in-person or virtual field meeting with key contact.',
    },
    exposure_amount: 120000.0,
    exposure_basis: '3-month average purchase run-rate',
    status: 'active',
    version: 1,
    occurrence_no: 1,
    previous_alert_id: null,
    first_detected_at: '2026-10-21T02:00:00Z',
    last_observed_at: '2026-10-23T01:30:00Z',
    resolved_at: null,
    suppressed_until: null,
    clear_streak: 0,
    escalation_level: 0,
  },
  {
    id: 'a1b2c3d4-0002-4000-8000-000000000002',
    rule_code: 'abandoned_lead',
    rule_name: 'Stalled Commercial Lead',
    entity_type: 'lead',
    entity_id: 'l2222222-0000-0000-0000-000000000002',
    entity_label: 'Fortis Cardiac Institute Wing C',
    owner_id: 'u1111111-0000-0000-0000-000000000001',
    classification: 'operational_warning',
    attention_priority: 'high',
    priority_reason: '62 working days without status update observed against a threshold of 30 (ratio 2.07).',
    observation: {
      working_days_since_followup: 62,
      threshold_days: 30,
      stage: 'Proposal Shared',
      suggested_check: 'Follow up on proposal terms or schedule demonstration session.',
    },
    exposure_amount: null,
    exposure_basis: null,
    status: 'active',
    version: 2,
    occurrence_no: 2,
    previous_alert_id: 'a1b2c3d4-0000-4000-8000-000000000000',
    first_detected_at: '2026-10-15T02:00:00Z',
    last_observed_at: '2026-10-23T01:30:00Z',
    resolved_at: null,
    suppressed_until: null,
    clear_streak: 0,
    escalation_level: 1,
  },
  {
    id: 'a1b2c3d4-0003-4000-8000-000000000003',
    rule_code: 'declining_frequency',
    rule_name: 'Order Frequency Decline',
    entity_type: 'customer',
    entity_id: 'c3333333-0000-0000-0000-000000000003',
    entity_label: 'Max Super Care Pharmacy',
    owner_id: 'u2222222-0000-0000-0000-000000000002',
    classification: 'operational_warning',
    attention_priority: 'medium',
    priority_reason: '50.00 percentage drop in order frequency observed against a threshold of 30 (ratio 1.67).',
    observation: {
      latest_fall_percent: 50.0,
      baseline_order_count: 10.0,
      recent_monthly_counts: [6, 5],
      suggested_check: 'Conduct account audit to investigate recent decline in repeat orders.',
    },
    exposure_amount: null,
    exposure_basis: null,
    status: 'acknowledged',
    version: 2,
    occurrence_no: 1,
    previous_alert_id: null,
    first_detected_at: '2026-10-18T02:00:00Z',
    last_observed_at: '2026-10-23T01:30:00Z',
    resolved_at: null,
    suppressed_until: null,
    clear_streak: 0,
    escalation_level: 0,
  },
];

let mockRules: RuleDTO[] = [
  {
    id: 'r1-0001',
    rule_code: 'unvisited_client',
    rule_name: 'High-Value Client Unvisited',
    description: 'Fires when high-value accounts have not received verified field contact beyond cadence threshold.',
    threshold_days: 30,
    threshold_value: 100000.0,
    medium_priority_ratio: 1.5,
    high_priority_ratio: 2.0,
    change_ratio: 0.1,
    cooldown_days: 7,
    dismiss_days: 30,
    autoclear_scans: 2,
    escalation_days: 3,
    min_history_months: 3,
    params: {},
    required_sources: ['visits', 'orders'],
    is_active: true,
    created_at: '2026-10-20T00:00:00Z',
    updated_at: '2026-10-20T00:00:00Z',
  },
  {
    id: 'r1-0002',
    rule_code: 'abandoned_lead',
    rule_name: 'Stalled Commercial Lead',
    description: 'Fires when open pipeline prospect has no recorded activity beyond threshold.',
    threshold_days: 30,
    threshold_value: 0.0,
    medium_priority_ratio: 1.5,
    high_priority_ratio: 2.0,
    change_ratio: 0.1,
    cooldown_days: 7,
    dismiss_days: 30,
    autoclear_scans: 2,
    escalation_days: 3,
    min_history_months: 1,
    params: {},
    required_sources: ['leads'],
    is_active: true,
    created_at: '2026-10-20T00:00:00Z',
    updated_at: '2026-10-20T00:00:00Z',
  },
  {
    id: 'r1-0003',
    rule_code: 'declining_frequency',
    rule_name: 'Order Frequency Decline',
    description: 'Fires when monthly order count drops below historical baseline for consecutive months.',
    threshold_days: 30,
    threshold_value: 0.0,
    medium_priority_ratio: 1.5,
    high_priority_ratio: 2.0,
    change_ratio: 0.1,
    cooldown_days: 7,
    dismiss_days: 30,
    autoclear_scans: 2,
    escalation_days: 3,
    min_history_months: 3,
    params: { consecutive_months: 2, min_fall_percent: 30 },
    required_sources: ['orders'],
    is_active: true,
    created_at: '2026-10-20T00:00:00Z',
    updated_at: '2026-10-20T00:00:00Z',
  },
  {
    id: 'r1-0004',
    rule_code: 'inactive_opportunity',
    rule_name: 'Stalled Commercial Opportunity',
    description: 'Fires when open opportunity remains in pipeline stage beyond expected cadence without contact.',
    threshold_days: 30,
    threshold_value: 0.0,
    medium_priority_ratio: 1.5,
    high_priority_ratio: 2.0,
    change_ratio: 0.1,
    cooldown_days: 7,
    dismiss_days: 30,
    autoclear_scans: 2,
    escalation_days: 3,
    min_history_months: 1,
    params: {},
    required_sources: ['visits', 'leads'],
    is_active: true,
    created_at: '2026-10-20T00:00:00Z',
    updated_at: '2026-10-20T00:00:00Z',
  },
  {
    id: 'r1-0005',
    rule_code: 'underperforming_territory',
    rule_name: 'Territory Revenue Behind Pace',
    description: 'Fires when territory revenue achievement percentage lags working days elapsed.',
    threshold_days: 30,
    threshold_value: 15.0,
    medium_priority_ratio: 1.5,
    high_priority_ratio: 2.0,
    change_ratio: 0.1,
    cooldown_days: 7,
    dismiss_days: 30,
    autoclear_scans: 2,
    escalation_days: 3,
    min_history_months: 1,
    params: { min_elapsed_working_days: 5 },
    required_sources: ['targets', 'orders'],
    is_active: true,
    created_at: '2026-10-20T00:00:00Z',
    updated_at: '2026-10-20T00:00:00Z',
  },
];

let mockScanRuns: ScanRunDTO[] = [
  {
    id: 'run-001',
    rule_code: 'unvisited_client',
    mode: 'normal',
    started_at: '2026-10-23T01:30:00Z',
    heartbeat_at: '2026-10-23T01:31:15Z',
    finished_at: '2026-10-23T01:31:15Z',
    status: 'succeeded',
    rows_evaluated: 240,
    alerts_created: 1,
    alerts_updated: 3,
    alerts_cleared: 0,
    skipped_not_synced: 0,
    attempt: 1,
    error_message: null,
  },
  {
    id: 'run-002',
    rule_code: 'abandoned_lead',
    mode: 'normal',
    started_at: '2026-10-23T01:31:20Z',
    heartbeat_at: '2026-10-23T01:32:05Z',
    finished_at: '2026-10-23T01:32:05Z',
    status: 'succeeded',
    rows_evaluated: 180,
    alerts_created: 1,
    alerts_updated: 2,
    alerts_cleared: 1,
    skipped_not_synced: 0,
    attempt: 1,
    error_message: null,
  },
];

export const revenueLeakageApi = {
  async fetchAlerts(params?: {
    rule_code?: string;
    status?: string;
    attention_priority?: string;
    entity_type?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedAlertsDTO> {
    try {
      const q = new URLSearchParams();
      if (params?.rule_code) q.append('rule_code', params.rule_code);
      if (params?.status) q.append('status', params.status);
      if (params?.attention_priority) q.append('attention_priority', params.attention_priority);
      if (params?.entity_type) q.append('entity_type', params.entity_type);
      if (params?.page) q.append('page', String(params.page));
      if (params?.page_size) q.append('page_size', String(params.page_size));

      const res = await fetch(`${BASE_URL}/api/v1/revenue-leakage/alerts?${q.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback to mock
    }

    let filtered = [...mockAlerts];
    if (params?.rule_code) filtered = filtered.filter((a) => a.rule_code === params.rule_code);
    if (params?.status) filtered = filtered.filter((a) => a.status === params.status);
    if (params?.attention_priority) filtered = filtered.filter((a) => a.attention_priority === params.attention_priority);
    if (params?.entity_type) filtered = filtered.filter((a) => a.entity_type === params.entity_type);

    const page = params?.page || 1;
    const pageSize = params?.page_size || 25;
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    return {
      items: paged,
      total: filtered.length,
      page,
      page_size: pageSize,
    };
  },

  async fetchAlertDetail(alertId: string): Promise<AlertDetailDTO> {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/revenue-leakage/alerts/${alertId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback to mock
    }

    const alert = mockAlerts.find((a) => a.id === alertId) || mockAlerts[0];
    return {
      ...alert,
      observations: [
        {
          id: 'obs-01',
          observed_at: alert.first_detected_at,
          observation: alert.observation,
          attention_priority: alert.attention_priority,
          reason: 'created',
        },
      ],
      actions:
        alert.status === 'acknowledged'
          ? [
              {
                id: 'act-01',
                alert_id: alert.id,
                action_type: 'acknowledged',
                outcome: null,
                action_taken: 'Reviewing account engagement history with regional team.',
                evidence_reference: null,
                notes: 'Contacted branch representative.',
                action_by: alert.owner_id || 'System',
                created_at: alert.last_observed_at,
              },
            ]
          : [],
      occurrences:
        alert.occurrence_no > 1
          ? [
              {
                id: alert.previous_alert_id || 'earlier-01',
                occurrence_no: 1,
                status: 'resolved',
                first_detected_at: '2026-09-01T00:00:00Z',
                resolved_at: '2026-09-15T00:00:00Z',
                archived: false,
              },
            ]
          : [],
    };
  },

  async recordAlertAction(
    alertId: string,
    payload: AlertActionPayload,
    idempotencyKey?: string
  ): Promise<AlertItemDTO> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    try {
      const res = await fetch(`${BASE_URL}/api/v1/revenue-leakage/alerts/${alertId}/actions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
      if (res.status === 409) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Conflict: Alert was modified by another user.');
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Conflict')) {
        throw err;
      }
      // Fallback mock update
    }

    const idx = mockAlerts.findIndex((a) => a.id === alertId);
    if (idx !== -1) {
      const alert = mockAlerts[idx];
      let newStatus = alert.status;
      if (payload.action_type === 'acknowledged') newStatus = 'acknowledged';
      else if (payload.action_type === 'resolved') newStatus = 'resolved';
      else if (payload.action_type === 'dismissed') newStatus = 'dismissed';

      const updated = {
        ...alert,
        status: newStatus,
        version: alert.version + 1,
        resolved_at: ['resolved', 'dismissed'].includes(newStatus) ? new Date().toISOString() : null,
      };
      mockAlerts[idx] = updated;
      return updated;
    }

    throw new Error('Alert not found');
  },

  async fetchRules(): Promise<RuleDTO[]> {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/revenue-leakage/rules`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return mockRules;
  },

  async patchRule(ruleId: string, payload: RulePatchPayload): Promise<RuleDTO> {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/revenue-leakage/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    const idx = mockRules.findIndex((r) => r.id === ruleId);
    if (idx !== -1) {
      mockRules[idx] = {
        ...mockRules[idx],
        ...payload,
        updated_at: new Date().toISOString(),
      };
      return mockRules[idx];
    }
    throw new Error('Rule not found');
  },

  async fetchScanRuns(): Promise<ScanRunDTO[]> {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/revenue-leakage/scan-runs`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return mockScanRuns;
  },
};
