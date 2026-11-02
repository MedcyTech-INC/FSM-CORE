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
  ExpenseClaim,
  ExpenseUploadReceiptResult,
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

let mockExpenses: ExpenseClaim[] = [
  {
    id: 'exp-1',
    employee_id: '11111111-1111-1111-1111-111111111111',
    category: 'fuel',
    amount: 850.0,
    claim_date: new Date().toISOString().split('T')[0],
    description: 'Field visit round trip to South Mumbai clinics',
    is_split_bill: false,
    validation_status: 'passed',
    validation_flags: [],
    status: 'submitted',
    employee_name: 'Alex Vance',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exp-2',
    employee_id: '22222222-2222-2222-2222-222222222222',
    category: 'food_allowance',
    amount: 450.0,
    claim_date: new Date().toISOString().split('T')[0],
    description: 'Lunch meeting with Dr. Jane Smith (Cardiology)',
    is_split_bill: true,
    split_with_employee_id: '11111111-1111-1111-1111-111111111111',
    receipt_invoice_number: 'INV-88902',
    total_receipt_amount: 900.0,
    validation_status: 'passed',
    validation_flags: [
      { code: 'SHARED_BILL_LEGITIMATE', severity: 'info', message: 'split bill verified with colleague' }
    ],
    status: 'manager_approved',
    employee_name: 'Rahul Sharma',
    split_with_employee_name: 'Alex Vance',
    manager_review_note: 'Approved for client meeting',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exp-3',
    employee_id: '33333333-3333-3333-3333-333333333333',
    category: 'accommodation',
    amount: 6800.0,
    claim_date: new Date().toISOString().split('T')[0],
    description: '3-day zonal conference hotel stay (Exceeds ₹5,000 threshold)',
    is_split_bill: false,
    validation_status: 'passed',
    validation_flags: [],
    status: 'pending_zsm_approval',
    employee_name: 'Amit Patel',
    manager_review_note: 'Verified attendance at conference. Forwarded to ZSM for high-value clearance.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exp-4',
    employee_id: '11111111-1111-1111-1111-111111111111',
    category: 'travel_ticket',
    amount: 1250.0,
    claim_date: new Date().toISOString().split('T')[0],
    description: 'Intercity train ticket to Pune distribution center',
    is_split_bill: false,
    validation_status: 'flagged',
    validation_flags: [
      { code: 'BLURRED_RECEIPT', severity: 'warning', message: 'Invoice number not legible in camera capture' }
    ],
    status: 'sent_back',
    employee_name: 'Alex Vance',
    review_note: 'Receipt photo is slightly blurred. Please re-upload clear GST invoice with legible date.',
    manager_review_note: 'Receipt photo is slightly blurred. Please re-upload clear GST invoice with legible date.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

class ApiClient {
  private getAuthHeader(): HeadersInit {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private isDevDemo(): boolean {
    return !!(import.meta.env.DEV && localStorage.getItem('access_token')?.startsWith('demo-jwt'));
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
    if (this.isDevDemo()) {
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
    }
    return this.request<User>('/api/employees/me');
  }

  async getDirectory(): Promise<User[]> {
    if (this.isDevDemo()) return [];
    return this.request<User[]>('/api/employees/directory');
  }

  // Attendance Endpoints
  async getTodayAttendance(): Promise<AttendanceRecord | null> {
    if (this.isDevDemo()) return mockAttendance;
    return this.request<AttendanceRecord | null>('/api/attendance/today');
  }

  async clockIn(lat: number, lon: number, accuracy?: number, proof_image?: string): Promise<AttendanceRecord> {
    if (this.isDevDemo()) {
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
    }
    return this.request<AttendanceRecord>('/api/attendance/clock-in', {
      method: 'POST',
      body: JSON.stringify({ latitude: lat, longitude: lon, accuracy_meters: accuracy, proof_image }),
    });
  }

  async clockOut(lat: number, lon: number, summary?: string): Promise<AttendanceRecord> {
    if (this.isDevDemo()) {
      if (mockAttendance) {
        mockAttendance.punch_out_time = new Date().toISOString();
        mockAttendance.punch_out_lat = lat;
        mockAttendance.punch_out_lon = lon;
        mockAttendance.punch_out_summary = summary;
        mockAttendance.working_minutes = 480;
      }
      return mockAttendance!;
    }
    return this.request<AttendanceRecord>('/api/attendance/clock-out', {
      method: 'POST',
      body: JSON.stringify({ latitude: lat, longitude: lon, summary }),
    });
  }

  async startBreak(reason?: string): Promise<BreakRecord> {
    if (this.isDevDemo()) {
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
    }
    return this.request<BreakRecord>('/api/breaks/start', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async endBreak(): Promise<BreakRecord> {
    if (this.isDevDemo()) {
      const open = mockAttendance?.breaks.find((b) => !b.end_time);
      if (open) {
        open.end_time = new Date().toISOString();
        open.duration_minutes = 15;
        return open;
      }
      throw new Error('No open break');
    }
    return this.request<BreakRecord>('/api/breaks/end', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Field Sessions & Visits
  async startFieldSession(lat: number, lon: number): Promise<FieldSession> {
    if (this.isDevDemo()) {
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
    }
    return this.request<FieldSession>('/api/field-sessions/start', {
      method: 'POST',
      body: JSON.stringify({ latitude: lat, longitude: lon }),
    });
  }

  async endFieldSession(sessionId: string, lat: number, lon: number): Promise<FieldSession> {
    if (this.isDevDemo()) {
      if (mockSession) {
        mockSession.end_time = new Date().toISOString();
        mockSession.end_lat = lat;
        mockSession.end_lon = lon;
        mockSession.accumulated_distance_km = 14.8;
        mockSession.status = 'COMPLETED';
      }
      return mockSession!;
    }
    return this.request<FieldSession>(`/api/field-sessions/${sessionId}/end`, {
      method: 'POST',
      body: JSON.stringify({ latitude: lat, longitude: lon }),
    });
  }

  async listVisits(visitDate?: string): Promise<FieldVisit[]> {
    if (this.isDevDemo()) return mockVisits;
    const q = visitDate ? `?visit_date=${visitDate}` : '';
    return this.request<FieldVisit[]>(`/api/field-visits/${q}`);
  }

  async createVisit(data: Partial<FieldVisit>): Promise<FieldVisit> {
    if (this.isDevDemo()) {
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
    }
    return this.request<FieldVisit>('/api/field-visits/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async startVisit(visitId: string, lat: number, lon: number, proofPhoto?: string): Promise<FieldVisit> {
    if (this.isDevDemo()) {
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
    }
    return this.request<FieldVisit>(`/api/field-visits/${visitId}/start`, {
      method: 'PATCH',
      body: JSON.stringify({ latitude: lat, longitude: lon, proof_photo: proofPhoto }),
    });
  }

  async completeVisit(visitId: string, notes: string, customFields?: Record<string, any>): Promise<FieldVisit> {
    if (this.isDevDemo()) {
      const v = mockVisits.find((x) => x.id === visitId);
      if (v) {
        v.completion_time = new Date().toISOString();
        v.discussion_notes = notes;
        v.custom_fields = customFields;
        v.status = 'COMPLETED';
        return v;
      }
      throw new Error('Visit not found');
    }
    return this.request<FieldVisit>(`/api/field-visits/${visitId}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ discussion_notes: notes, custom_fields: customFields }),
    });
  }

  // Leaves & Tasks
  async getLeaveBalances(): Promise<LeaveBalance[]> {
    if (this.isDevDemo()) return mockBalances;
    return this.request<LeaveBalance[]>('/api/leaves/balances');
  }

  async getMyLeaveRequests(): Promise<LeaveRequest[]> {
    if (this.isDevDemo()) return mockRequests;
    return this.request<LeaveRequest[]>('/api/leaves/my-requests');
  }

  async applyLeave(leaveType: string, startDate: string, endDate: string, reason: string): Promise<LeaveRequest> {
    if (this.isDevDemo()) {
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
    }
    return this.request<LeaveRequest>('/api/leaves/apply', {
      method: 'POST',
      body: JSON.stringify({ leave_type: leaveType, start_date: startDate, end_date: endDate, reason }),
    });
  }

  async listTasks(): Promise<TaskItem[]> {
    if (this.isDevDemo()) return mockTasks;
    return this.request<TaskItem[]>('/api/tasks/');
  }

  async updateTaskStatus(taskId: string, status: string): Promise<TaskItem> {
    if (this.isDevDemo()) {
      const t = mockTasks.find((x) => x.id === taskId);
      if (t) {
        t.status = status as any;
        return t;
      }
      throw new Error('Task not found');
    }
    return this.request<TaskItem>(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // Expense Management Endpoints
  async uploadExpenseReceipt(
    file: Blob,
    clientTimestamp?: string,
    latitude?: number,
    longitude?: number
  ): Promise<ExpenseUploadReceiptResult> {
    if (this.isDevDemo()) {
      return {
        receipt_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23f1f5f9"><rect width="100%" height="100%" fill="%23f8fafc"/><text x="20" y="40" fill="%23475569" font-family="sans-serif">Live Photo Receipt Proof</text></svg>',
        image_sha256: 'mock-sha256-' + Date.now(),
        timestamp_delta_seconds: 1.2,
        extracted_amount: 850.0,
        extracted_invoice_number: 'INV-44102',
      };
    }

    const formData = new FormData();
    formData.append('file', file, 'receipt.jpg');
    if (clientTimestamp) formData.append('client_timestamp', clientTimestamp);
    if (latitude !== undefined) formData.append('latitude', latitude.toString());
    if (longitude !== undefined) formData.append('longitude', longitude.toString());

    const token = localStorage.getItem('access_token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await fetch(`${BASE_URL}/api/expenses/upload-receipt`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to upload receipt');
    }
    return res.json();
  }

  async submitExpenseClaim(claim: Partial<ExpenseClaim>): Promise<ExpenseClaim> {
    if (this.isDevDemo()) {
      const newExp: ExpenseClaim = {
        id: 'exp-' + Date.now(),
        employee_id: '11111111-1111-1111-1111-111111111111',
        category: (claim.category as any) || 'miscellaneous',
        amount: claim.amount || 0,
        claim_date: claim.claim_date || new Date().toISOString().split('T')[0],
        description: claim.description,
        is_split_bill: claim.is_split_bill || false,
        split_with_employee_id: claim.split_with_employee_id,
        receipt_invoice_number: claim.receipt_invoice_number,
        total_receipt_amount: claim.total_receipt_amount,
        receipt_url: claim.receipt_url,
        image_sha256: claim.image_sha256,
        validation_status: 'passed',
        validation_flags: [],
        status: 'submitted',
        employee_name: 'Alex Vance',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockExpenses.unshift(newExp);
      return newExp;
    }
    return this.request<ExpenseClaim>('/api/expenses/submit', {
      method: 'POST',
      body: JSON.stringify(claim),
    });
  }

  async getMyExpenseClaims(): Promise<ExpenseClaim[]> {
    if (this.isDevDemo()) return mockExpenses;
    return this.request<ExpenseClaim[]>('/api/expenses/my-claims');
  }

  async getTeamExpenseClaims(): Promise<ExpenseClaim[]> {
    if (this.isDevDemo()) return mockExpenses;
    return this.request<ExpenseClaim[]>('/api/expenses/team-claims');
  }

  async reviewExpenseClaim(expenseId: string, action: string, note?: string): Promise<ExpenseClaim> {
    if (this.isDevDemo()) {
      const exp = mockExpenses.find((e) => e.id === expenseId);
      if (exp) {
        if (action === 'APPROVE') {
          exp.status = exp.amount > 5000 ? 'pending_zsm_approval' : 'manager_approved';
        } else if (action === 'SEND_BACK') {
          exp.status = 'sent_back';
        } else {
          exp.status = 'rejected';
        }
        exp.review_note = note;
        exp.manager_review_note = note;
        exp.reviewed_at = new Date().toISOString();
        return exp;
      }
      throw new Error('Expense claim not found');
    }
    return this.request<ExpenseClaim>(`/api/expenses/${expenseId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, review_note: note }),
    });
  }

  async resubmitExpenseClaim(expenseId: string, payload: Partial<ExpenseClaim>): Promise<ExpenseClaim> {
    if (this.isDevDemo()) {
      const exp = mockExpenses.find((e) => e.id === expenseId);
      if (exp) {
        if (payload.amount !== undefined) exp.amount = payload.amount;
        if (payload.description !== undefined) exp.description = payload.description;
        if (payload.receipt_url !== undefined) exp.receipt_url = payload.receipt_url;
        if (payload.image_sha256 !== undefined) exp.image_sha256 = payload.image_sha256;
        exp.status = 'submitted';
        exp.updated_at = new Date().toISOString();
        return exp;
      }
      throw new Error('Expense claim not found');
    }
    return this.request<ExpenseClaim>(`/api/expenses/${expenseId}/resubmit`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getFinanceExpenseClaims(): Promise<ExpenseClaim[]> {
    if (this.isDevDemo()) {
      return mockExpenses.filter((e) =>
        ['manager_approved', 'zsm_approved', 'finance_verified', 'approved', 'reimbursed'].includes(e.status)
      );
    }
    return this.request<ExpenseClaim[]>('/api/expenses/finance-queue');
  }

  async disburseExpenseClaim(expenseId: string, paymentReference: string, note?: string): Promise<ExpenseClaim> {
    if (this.isDevDemo()) {
      const exp = mockExpenses.find((e) => e.id === expenseId);
      if (exp) {
        exp.status = 'reimbursed';
        exp.payment_reference = paymentReference;
        exp.finance_review_note = note;
        exp.reimbursed_at = new Date().toISOString();
        return exp;
      }
      throw new Error('Expense claim not found');
    }
    return this.request<ExpenseClaim>(`/api/expenses/${expenseId}/disburse`, {
      method: 'POST',
      body: JSON.stringify({ payment_reference: paymentReference, note }),
    });
  }

  async reimburseExpenseClaim(expenseId: string): Promise<ExpenseClaim> {
    return this.disburseExpenseClaim(expenseId, 'BANK-UTR-' + Math.floor(100000 + Math.random() * 900000));
  }
}

export const api = new ApiClient();
