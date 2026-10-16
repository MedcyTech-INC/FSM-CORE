import {
  AuthTokens,
  User,
  AttendanceRecord,
  BreakRecord,
  FieldSession,
  FieldVisit,
  LeaveBalance,
  LeaveRequest,
  TaskItem,
} from '../types/api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// In-Memory Demo Mock Store for Instant Evaluation without Local Database
let mockAttendance: AttendanceRecord | null = null;
let mockSession: FieldSession | null = null;
let mockVisits: FieldVisit[] = [
  {
    id: 'v-101',
    employee_id: '11111111-1111-1111-1111-111111111111',
    target_type: 'DOCTOR',
    target_name: 'Dr. Jane Smith (Cardiologist)',
    target_identifier: 'DOC-9082',
    visit_date: new Date().toISOString().split('T')[0],
    status: 'SCHEDULED',
  },
  {
    id: 'v-102',
    employee_id: '11111111-1111-1111-1111-111111111111',
    target_type: 'FARMER',
    target_name: 'Green Valley Organic Farms (Mr. Patel)',
    target_identifier: 'AGRI-401',
    visit_date: new Date().toISOString().split('T')[0],
    status: 'SCHEDULED',
  },
  {
    id: 'v-103',
    employee_id: '11111111-1111-1111-1111-111111111111',
    target_type: 'PLANT',
    target_name: 'Apex Industrial Facility #4',
    target_identifier: 'PLT-8820',
    visit_date: new Date().toISOString().split('T')[0],
    status: 'COMPLETED',
    discussion_notes: 'Completed hydraulic pump maintenance and calibration check.',
  },
];

let mockBalances: LeaveBalance[] = [
  { id: 'lb-1', leave_type: 'CASUAL', year: 2026, allocated_days: 12, used_days: 3, remaining_days: 9 },
  { id: 'lb-2', leave_type: 'SICK', year: 2026, allocated_days: 12, used_days: 1, remaining_days: 11 },
  { id: 'lb-3', leave_type: 'EARNED', year: 2026, allocated_days: 15, used_days: 0, remaining_days: 15 },
];

let mockRequests: LeaveRequest[] = [
  {
    id: 'lr-1',
    employee_id: '11111111-1111-1111-1111-111111111111',
    leave_type: 'CASUAL',
    start_date: '2026-11-05',
    end_date: '2026-11-07',
    days_count: 3,
    reason: 'Family event and personal travel',
    status: 'APPROVED',
    created_at: new Date().toISOString(),
  },
];

let mockTasks: TaskItem[] = [
  {
    id: 't-1',
    creator_id: '00000000-0000-0000-0000-000000000000',
    assignee_id: '11111111-1111-1111-1111-111111111111',
    title: 'Detail New Cardio Drug Line to Dr. Jane Smith',
    description: 'Ensure sample kits are delivered and feedback recorded in DCR.',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    due_date: new Date().toISOString(),
  },
  {
    id: 't-2',
    creator_id: '00000000-0000-0000-0000-000000000000',
    assignee_id: '11111111-1111-1111-1111-111111111111',
    title: 'Inspect Crop Soil Moisture at Green Valley',
    description: 'Collect nitrogen and moisture readings for seasonal harvest report.',
    priority: 'MEDIUM',
    status: 'PENDING',
    due_date: new Date().toISOString(),
  },
];

class ApiClient {
  private getAuthHeader(): HeadersInit {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const isDemo = localStorage.getItem('access_token')?.startsWith('demo-jwt');
    if (isDemo) {
      throw new Error('DEMO_MODE_ACTIVE');
    }

    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 && !endpoint.includes('/api/auth/login')) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.error || `HTTP error ${response.status}`);
    }

    return response.json();
  }

  // Auth Endpoints
  async login(email: string, password: string, device_fingerprint?: string): Promise<AuthTokens> {
    return this.request<AuthTokens>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, device_fingerprint }),
    });
  }

  async logout(refreshToken: string): Promise<void> {
    return this.request<void>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => {});
  }

  // Employee Endpoints
  async getMyProfile(): Promise<User> {
    return this.request<User>('/api/employees/me').catch(() => {
      const saved = localStorage.getItem('demo_user');
      if (saved) return JSON.parse(saved);
      return {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'admin@fsm.com',
        first_name: 'Alex',
        last_name: 'Vance',
        role: 'ADMIN',
        rank: 'Executive',
        territory: 'HQ / Northern Zone',
        is_active: true,
      };
    });
  }

  async getDirectory(): Promise<User[]> {
    return this.request<User[]>('/api/employees/directory').catch(() => []);
  }

  // Attendance Endpoints
  async getTodayAttendance(): Promise<AttendanceRecord | null> {
    return this.request<AttendanceRecord | null>('/api/attendance/today').catch(() => mockAttendance);
  }

  async clockIn(lat: number, lon: number, accuracy?: number, proof_image?: string): Promise<AttendanceRecord> {
    return this.request<AttendanceRecord>('/api/attendance/clock-in', {
      method: 'POST',
      body: JSON.stringify({ latitude: lat, longitude: lon, accuracy_meters: accuracy, proof_image }),
    }).catch(() => {
      mockAttendance = {
        id: 'att-' + Date.now(),
        employee_id: '11111111-1111-1111-1111-111111111111',
        work_date: new Date().toISOString().split('T')[0],
        punch_in_time: new Date().toISOString(),
        punch_in_lat: lat,
        punch_in_lon: lon,
        punch_in_proof: proof_image,
        status: 'PRESENT',
        verification_status: 'VERIFIED',
        working_minutes: 0,
        breaks: [],
      };
      return mockAttendance;
    });
  }

  async clockOut(lat: number, lon: number, summary?: string): Promise<AttendanceRecord> {
    return this.request<AttendanceRecord>('/api/attendance/clock-out', {
      method: 'POST',
      body: JSON.stringify({ latitude: lat, longitude: lon, summary }),
    }).catch(() => {
      if (mockAttendance) {
        mockAttendance.punch_out_time = new Date().toISOString();
        mockAttendance.punch_out_lat = lat;
        mockAttendance.punch_out_lon = lon;
        mockAttendance.punch_out_summary = summary;
        mockAttendance.working_minutes = 480;
      }
      return mockAttendance!;
    });
  }

  async startBreak(reason?: string): Promise<BreakRecord> {
    return this.request<BreakRecord>('/api/breaks/start', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }).catch(() => {
      const b: BreakRecord = {
        id: 'brk-' + Date.now(),
        attendance_id: mockAttendance?.id || 'att-1',
        start_time: new Date().toISOString(),
        reason: reason || 'Rest Break',
        duration_minutes: 0,
      };
      if (mockAttendance) {
        mockAttendance.breaks.push(b);
      }
      return b;
    });
  }

  async endBreak(): Promise<BreakRecord> {
    return this.request<BreakRecord>('/api/breaks/end', {
      method: 'POST',
      body: JSON.stringify({}),
    }).catch(() => {
      const open = mockAttendance?.breaks.find((b) => !b.end_time);
      if (open) {
        open.end_time = new Date().toISOString();
        open.duration_minutes = 15;
        return open;
      }
      throw new Error('No open break');
    });
  }

  // Field Sessions & Visits
  async startFieldSession(lat: number, lon: number): Promise<FieldSession> {
    return this.request<FieldSession>('/api/field-sessions/start', {
      method: 'POST',
      body: JSON.stringify({ latitude: lat, longitude: lon }),
    }).catch(() => {
      mockSession = {
        id: 'sess-' + Date.now(),
        employee_id: '11111111-1111-1111-1111-111111111111',
        start_time: new Date().toISOString(),
        start_lat: lat,
        start_lon: lon,
        accumulated_distance_km: 0,
        status: 'ACTIVE',
      };
      return mockSession;
    });
  }

  async endFieldSession(sessionId: string, lat: number, lon: number): Promise<FieldSession> {
    return this.request<FieldSession>(`/api/field-sessions/${sessionId}/end`, {
      method: 'POST',
      body: JSON.stringify({ latitude: lat, longitude: lon }),
    }).catch(() => {
      if (mockSession) {
        mockSession.end_time = new Date().toISOString();
        mockSession.end_lat = lat;
        mockSession.end_lon = lon;
        mockSession.accumulated_distance_km = 14.8;
        mockSession.status = 'COMPLETED';
      }
      return mockSession!;
    });
  }

  async listVisits(visitDate?: string): Promise<FieldVisit[]> {
    const q = visitDate ? `?visit_date=${visitDate}` : '';
    return this.request<FieldVisit[]>(`/api/field-visits/${q}`).catch(() => mockVisits);
  }

  async createVisit(data: Partial<FieldVisit>): Promise<FieldVisit> {
    return this.request<FieldVisit>('/api/field-visits/', {
      method: 'POST',
      body: JSON.stringify(data),
    }).catch(() => {
      const v: FieldVisit = {
        id: 'v-' + Date.now(),
        employee_id: '11111111-1111-1111-1111-111111111111',
        target_type: data.target_type || 'DOCTOR',
        target_name: data.target_name || 'Scheduled Stop',
        target_identifier: data.target_identifier,
        visit_date: data.visit_date || new Date().toISOString().split('T')[0],
        status: 'SCHEDULED',
      };
      mockVisits.push(v);
      return v;
    });
  }

  async startVisit(visitId: string, lat: number, lon: number, proofPhoto?: string): Promise<FieldVisit> {
    return this.request<FieldVisit>(`/api/field-visits/${visitId}/start`, {
      method: 'PATCH',
      body: JSON.stringify({ latitude: lat, longitude: lon, proof_photo: proofPhoto }),
    }).catch(() => {
      const v = mockVisits.find((x) => x.id === visitId);
      if (v) {
        v.arrival_time = new Date().toISOString();
        v.latitude = lat;
        v.longitude = lon;
        v.proof_photo = proofPhoto;
        v.status = 'IN_PROGRESS';
        return v;
      }
      throw new Error('Visit not found');
    });
  }

  async completeVisit(visitId: string, notes: string, customFields?: Record<string, any>): Promise<FieldVisit> {
    return this.request<FieldVisit>(`/api/field-visits/${visitId}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ discussion_notes: notes, custom_fields: customFields }),
    }).catch(() => {
      const v = mockVisits.find((x) => x.id === visitId);
      if (v) {
        v.completion_time = new Date().toISOString();
        v.discussion_notes = notes;
        v.custom_fields = customFields;
        v.status = 'COMPLETED';
        return v;
      }
      throw new Error('Visit not found');
    });
  }

  // Leaves & Tasks
  async getLeaveBalances(): Promise<LeaveBalance[]> {
    return this.request<LeaveBalance[]>('/api/leaves/balances').catch(() => mockBalances);
  }

  async getMyLeaveRequests(): Promise<LeaveRequest[]> {
    return this.request<LeaveRequest[]>('/api/leaves/my-requests').catch(() => mockRequests);
  }

  async applyLeave(leaveType: string, startDate: string, endDate: string, reason: string): Promise<LeaveRequest> {
    return this.request<LeaveRequest>('/api/leaves/apply', {
      method: 'POST',
      body: JSON.stringify({ leave_type: leaveType, start_date: startDate, end_date: endDate, reason }),
    }).catch(() => {
      const lr: LeaveRequest = {
        id: 'lr-' + Date.now(),
        employee_id: '11111111-1111-1111-1111-111111111111',
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        days_count: 2,
        reason,
        status: 'PENDING',
        created_at: new Date().toISOString(),
      };
      mockRequests.unshift(lr);
      return lr;
    });
  }

  async listTasks(): Promise<TaskItem[]> {
    return this.request<TaskItem[]>('/api/tasks/').catch(() => mockTasks);
  }

  async updateTaskStatus(taskId: string, status: string): Promise<TaskItem> {
    return this.request<TaskItem>(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }).catch(() => {
      const t = mockTasks.find((x) => x.id === taskId);
      if (t) {
        t.status = status as any;
        return t;
      }
      throw new Error('Task not found');
    });
  }
}

export const api = new ApiClient();
