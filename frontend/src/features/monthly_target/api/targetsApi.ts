import {
  MyProgressItemDTO,
  TargetDetailDTO,
  TargetCreatePayload,
  TargetPatchPayload,
  TargetCancelPayload,
  FSMErrorResponse,
  HolidayDTO,
  HolidayCreatePayload,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Mock Store for instant evaluation in Demo Mode
let mockTargets: TargetDetailDTO[] = [
  {
    id: 'tgt-001',
    title: 'Monthly Doctor Coverage (Nov 2026)',
    metric_type: 'doctor_visits',
    target_value: 120,
    start_date: '2026-11-01',
    end_date: '2026-11-30',
    status: 'active',
    version: 1,
    final_value: null,
    closed_at: null,
    adjusted_at: null,
    cancel_reason: null,
    idempotency_key: 'seed-idemp-1',
    created_by: '11111111-1111-1111-1111-111111111111',
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
    archived_at: null,
    assignments: [
      {
        id: 'asg-001',
        target_id: 'tgt-001',
        entity_type: 'representative',
        entity_id: '22222222-2222-2222-2222-222222222222',
        assigned_at: '2026-10-20T10:00:00Z',
        ended_at: null,
        progress: {
          current_value: 48,
          last_updated_at: '2026-10-22T14:30:00Z',
        },
      },
    ],
    changes: [],
  },
  {
    id: 'tgt-002',
    title: 'South Mumbai Zone Revenue Goal',
    metric_type: 'revenue',
    target_value: 1500000,
    start_date: '2026-11-01',
    end_date: '2026-11-30',
    status: 'active',
    version: 2,
    final_value: null,
    closed_at: null,
    adjusted_at: null,
    cancel_reason: null,
    idempotency_key: 'seed-idemp-2',
    created_by: '11111111-1111-1111-1111-111111111111',
    created_at: '2026-10-18T09:00:00Z',
    updated_at: '2026-10-21T11:00:00Z',
    archived_at: null,
    assignments: [
      {
        id: 'asg-002',
        target_id: 'tgt-002',
        entity_type: 'territory',
        entity_id: '33333333-3333-3333-3333-333333333333',
        assigned_at: '2026-10-18T09:00:00Z',
        ended_at: null,
        progress: {
          current_value: 620000,
          last_updated_at: '2026-10-22T18:00:00Z',
        },
      },
    ],
    changes: [
      {
        id: 'chg-001',
        target_id: 'tgt-002',
        version: 2,
        field: 'target_value',
        old_value: '1200000',
        new_value: '1500000',
        reason: 'Adjusted for mid-quarter territory expansion',
        changed_by: '11111111-1111-1111-1111-111111111111',
        changed_at: '2026-10-21T11:00:00Z',
      },
    ],
  },
  {
    id: 'tgt-003',
    title: 'Cardio Division Collections Drive',
    metric_type: 'collections',
    target_value: 800000,
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    status: 'active',
    version: 1,
    final_value: null,
    closed_at: null,
    adjusted_at: null,
    cancel_reason: null,
    idempotency_key: 'seed-idemp-3',
    created_by: '11111111-1111-1111-1111-111111111111',
    created_at: '2026-09-28T09:00:00Z',
    updated_at: '2026-09-28T09:00:00Z',
    archived_at: null,
    assignments: [
      {
        id: 'asg-003',
        target_id: 'tgt-003',
        entity_type: 'team',
        entity_id: '44444444-4444-4444-4444-444444444444',
        assigned_at: '2026-09-28T09:00:00Z',
        ended_at: null,
        progress: {
          current_value: 850000,
          last_updated_at: '2026-10-22T16:00:00Z',
        },
      },
    ],
    changes: [],
  },
];

let mockMyProgress: MyProgressItemDTO[] = [
  {
    payload_version: 1,
    target_id: 'tgt-001',
    title: 'Monthly Doctor Coverage (Nov 2026)',
    scope: 'representative',
    entity_id: '22222222-2222-2222-2222-222222222222',
    metric_type: 'doctor_visits',
    target_value: 120,
    current_value: 48,
    own_contribution: 48,
    gap_remaining: 72,
    days_left: 14,
    required_daily_run_rate: 5.14,
    percent_complete: 40.0,
    state: 'active',
    adjusted: false,
    start_date: '2026-11-01',
    end_date: '2026-11-30',
  },
  {
    payload_version: 1,
    target_id: 'tgt-002',
    title: 'South Mumbai Zone Revenue Goal',
    scope: 'territory',
    entity_id: '33333333-3333-3333-3333-333333333333',
    metric_type: 'revenue',
    target_value: 1500000,
    current_value: 620000,
    own_contribution: 195000,
    gap_remaining: 880000,
    days_left: 14,
    required_daily_run_rate: 62857.14,
    percent_complete: 41.33,
    state: 'active',
    adjusted: false,
    start_date: '2026-11-01',
    end_date: '2026-11-30',
  },
  {
    payload_version: 1,
    target_id: 'tgt-003',
    title: 'Cardio Division Collections Drive',
    scope: 'team',
    entity_id: '44444444-4444-4444-4444-444444444444',
    metric_type: 'collections',
    target_value: 800000,
    current_value: 850000,
    own_contribution: 240000,
    gap_remaining: 0,
    days_left: 6,
    required_daily_run_rate: 0.0,
    percent_complete: 106.25,
    state: 'achieved',
    adjusted: false,
    start_date: '2026-10-01',
    end_date: '2026-10-31',
  },
];

let mockHolidays: HolidayDTO[] = [
  { holiday_date: '2026-01-26', name: 'Republic Day', region: 'National' },
  { holiday_date: '2026-03-03', name: 'Holi', region: 'National' },
  { holiday_date: '2026-03-21', name: 'Id-ul-Fitr (Eid)', region: 'National' },
  { holiday_date: '2026-04-03', name: 'Good Friday', region: 'National' },
  { holiday_date: '2026-04-14', name: 'Dr. Ambedkar Jayanti', region: 'National' },
  { holiday_date: '2026-05-01', name: 'May Day / Labor Day', region: 'National' },
  { holiday_date: '2026-05-27', name: 'Bakrid / Eid al-Adha', region: 'National' },
  { holiday_date: '2026-08-15', name: 'Independence Day', region: 'National' },
  { holiday_date: '2026-09-04', name: 'Janmashtami', region: 'National' },
  { holiday_date: '2026-10-02', name: 'Mahatma Gandhi Jayanti', region: 'National' },
  { holiday_date: '2026-10-20', name: 'Dussehra / Vijaya Dashami', region: 'National' },
  { holiday_date: '2026-11-08', name: 'Diwali / Deepavali', region: 'National' },
  { holiday_date: '2026-12-25', name: 'Christmas Day', region: 'National' },
];

export class TargetsApiError extends Error {
  code: string;
  details?: Record<string, any> | null;
  status: number;

  constructor(status: number, code: string, message: string, details?: Record<string, any> | null) {
    super(message);
    this.name = 'TargetsApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class TargetsApiClient {
  private getAuthHeader(): HeadersInit {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private isDemo(): boolean {
    return localStorage.getItem('access_token')?.startsWith('demo-jwt') ?? false;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (this.isDemo()) {
      throw new Error('DEMO_MODE_ACTIVE');
    }

    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    if (!response.ok) {
      let errPayload: FSMErrorResponse | null = null;
      try {
        errPayload = await response.json();
      } catch {
        // Fallback
      }

      if (errPayload && errPayload.error) {
        throw new TargetsApiError(
          response.status,
          errPayload.error.code,
          errPayload.error.message,
          errPayload.error.details
        );
      }

      throw new TargetsApiError(response.status, 'http_error', `HTTP error ${response.status}`);
    }

    return response.json();
  }

  // 1. Rep Progress: GET /api/v1/targets/my-progress
  async getMyProgress(): Promise<MyProgressItemDTO[]> {
    return this.request<MyProgressItemDTO[]>('/api/v1/targets/my-progress').catch(() => {
      return [...mockMyProgress];
    });
  }

  // 2. Targets List: GET /api/v1/targets
  async listTargets(params?: {
    status?: string;
    metric_type?: string;
    period_start?: string;
    period_end?: string;
    limit?: number;
    offset?: number;
  }): Promise<TargetDetailDTO[]> {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.metric_type) q.append('metric_type', params.metric_type);
    if (params?.period_start) q.append('period_start', params.period_start);
    if (params?.period_end) q.append('period_end', params.period_end);
    if (params?.limit) q.append('limit', String(params.limit));
    if (params?.offset) q.append('offset', String(params.offset));

    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request<TargetDetailDTO[]>(`/api/v1/targets${qs}`).catch(() => {
      let filtered = [...mockTargets];
      if (params?.status) filtered = filtered.filter((t) => t.status === params.status);
      if (params?.metric_type) filtered = filtered.filter((t) => t.metric_type === params.metric_type);
      return filtered;
    });
  }

  // 3. Target Detail: GET /api/v1/targets/{target_id}
  async getTargetDetail(targetId: string): Promise<TargetDetailDTO> {
    return this.request<TargetDetailDTO>(`/api/v1/targets/${targetId}`).catch(() => {
      const found = mockTargets.find((t) => t.id === targetId);
      if (found) return found;
      throw new TargetsApiError(404, 'not_found', 'Target not found');
    });
  }

  // 4. Create Target: POST /api/v1/targets
  async createTarget(data: TargetCreatePayload, idempotencyKey?: string): Promise<TargetDetailDTO> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return this.request<TargetDetailDTO>('/api/v1/targets', {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    }).catch((err) => {
      if (err instanceof TargetsApiError) throw err;

      // Mock creation in demo mode
      const newTarget: TargetDetailDTO = {
        id: 'tgt-' + Date.now(),
        title: data.title,
        metric_type: data.metric_type,
        target_value: data.target_value,
        start_date: data.start_date,
        end_date: data.end_date,
        status: 'active',
        version: 1,
        final_value: null,
        closed_at: null,
        adjusted_at: null,
        cancel_reason: null,
        idempotency_key: idempotencyKey || null,
        created_by: '11111111-1111-1111-1111-111111111111',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
        assignments: data.assignments.map((a, idx) => ({
          id: `asg-${Date.now()}-${idx}`,
          target_id: 'tgt-' + Date.now(),
          entity_type: a.entity_type,
          entity_id: a.entity_id,
          assigned_at: new Date().toISOString(),
          ended_at: null,
          progress: {
            current_value: 0,
            last_updated_at: new Date().toISOString(),
          },
        })),
        changes: [],
      };
      mockTargets.unshift(newTarget);
      return newTarget;
    });
  }

  // 5. Change Target: PATCH /api/v1/targets/{target_id}
  async updateTarget(targetId: string, data: TargetPatchPayload): Promise<TargetDetailDTO> {
    return this.request<TargetDetailDTO>(`/api/v1/targets/${targetId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).catch((err) => {
      if (err instanceof TargetsApiError) throw err;

      const target = mockTargets.find((t) => t.id === targetId);
      if (!target) throw new TargetsApiError(404, 'not_found', 'Target not found');

      if (target.version !== data.version) {
        throw new TargetsApiError(409, 'version_conflict', 'Target was modified by someone else', {
          current_version: target.version,
        });
      }

      if (target.archived_at) {
        throw new TargetsApiError(409, 'target_archived', 'Target is archived and cannot be modified');
      }

      target.version += 1;
      if (data.target_value !== undefined) target.target_value = data.target_value;
      if (data.start_date !== undefined) target.start_date = data.start_date;
      if (data.end_date !== undefined) target.end_date = data.end_date;
      target.updated_at = new Date().toISOString();

      if (!target.changes) target.changes = [];
      target.changes.unshift({
        id: 'chg-' + Date.now(),
        target_id: target.id,
        version: target.version,
        field: 'update',
        old_value: null,
        new_value: null,
        reason: data.reason,
        changed_by: '11111111-1111-1111-1111-111111111111',
        changed_at: new Date().toISOString(),
      });

      return target;
    });
  }

  // 6. Cancel Target: POST /api/v1/targets/{target_id}/cancel
  async cancelTarget(targetId: string, data: TargetCancelPayload): Promise<TargetDetailDTO> {
    return this.request<TargetDetailDTO>(`/api/v1/targets/${targetId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).catch((err) => {
      if (err instanceof TargetsApiError) throw err;

      const target = mockTargets.find((t) => t.id === targetId);
      if (!target) throw new TargetsApiError(404, 'not_found', 'Target not found');

      if (target.version !== data.version) {
        throw new TargetsApiError(409, 'version_conflict', 'Target was modified by someone else', {
          current_version: target.version,
        });
      }

      target.status = 'cancelled';
      target.cancel_reason = data.reason;
      target.version += 1;
      target.updated_at = new Date().toISOString();
      return target;
    });
  }

  // 7. Holidays: GET /api/v1/holidays
  async getHolidays(year?: number, region?: string): Promise<HolidayDTO[]> {
    const q = new URLSearchParams();
    if (year) q.append('year', String(year));
    if (region) q.append('region', region);
    const qs = q.toString() ? `?${q.toString()}` : '';

    return this.request<HolidayDTO[]>(`/api/v1/holidays${qs}`).catch(() => {
      let filtered = [...mockHolidays];
      if (year) {
        filtered = filtered.filter((h) => h.holiday_date.startsWith(String(year)));
      }
      if (region) {
        filtered = filtered.filter((h) => h.region === region);
      }
      return filtered.sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
    });
  }

  // 8. Add/Update Holiday: POST /api/v1/holidays
  async addHoliday(data: HolidayCreatePayload): Promise<HolidayDTO> {
    return this.request<HolidayDTO>('/api/v1/holidays', {
      method: 'POST',
      body: JSON.stringify(data),
    }).catch((err) => {
      if (err instanceof TargetsApiError) throw err;

      const idx = mockHolidays.findIndex((h) => h.holiday_date === data.holiday_date);
      const newHol: HolidayDTO = {
        holiday_date: data.holiday_date,
        name: data.name,
        region: data.region || 'National',
        created_at: new Date().toISOString(),
      };

      if (idx >= 0) {
        mockHolidays[idx] = newHol;
      } else {
        mockHolidays.push(newHol);
      }
      mockHolidays.sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
      return newHol;
    });
  }

  // 9. Delete Holiday: DELETE /api/v1/holidays/{holiday_date}
  async deleteHoliday(holidayDate: string): Promise<void> {
    return this.request<void>(`/api/v1/holidays/${holidayDate}`, {
      method: 'DELETE',
    }).catch((err) => {
      if (err instanceof TargetsApiError) throw err;
      mockHolidays = mockHolidays.filter((h) => h.holiday_date !== holidayDate);
    });
  }
}

export const targetsApi = new TargetsApiClient();
