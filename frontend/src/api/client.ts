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
import {
  PlanResponse,
  PlanItemResponse,
  PlanGeneratePayload,
  PlanReplanPayload,
  PlanItemStartPayload,
  PlanItemCompletePayload,
  PlanItemSkipPayload,
  PlanApprovePayload,
  LeadResponse,
  LeadCreatePayload,
  FollowUpResponse,
  FollowUpCreatePayload,
  MonthlyTargetResponse,
  CustomerResponse,
  WhyBadge,
} from '../types/plan';

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

let mockMonthlyTarget: MonthlyTargetResponse = {
  id: 'mt-001',
  employee_id: '11111111-1111-1111-1111-111111111111',
  target_month: new Date().toISOString().substring(0, 7) + '-01',
  target_revenue: 500000,
  achieved_revenue: 320000,
  target_visits: 80,
  achieved_visits: 52,
  status: 'ACTIVE',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

let mockLeads: LeadResponse[] = [
  {
    id: 'lead-001',
    employee_id: '11111111-1111-1111-1111-111111111111',
    created_by_id: '11111111-1111-1111-1111-111111111111',
    customer_id: null,
    customer_name: 'Dr. Jane Smith (Cardiology)',
    customer_type: 'Doctor',
    title: 'Hospital Cardiology Formulary Contract',
    opportunity_type: 'Pharma supply',
    lead_source: 'Doctor Visit',
    stage: 'QUALIFIED',
    priority: 'HIGH',
    expected_value: 150000,
    actual_converted_value: null,
    expected_close_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    location_city: 'Brigade Road, Bangalore',
    contact_person: 'Dr. Jane Smith',
    contact_phone: '+91 98450 12345',
    latitude: 12.9716,
    longitude: 77.5946,
    notes: 'Key opinion leader in interventional cardiology. High interest in lipid-lowering line.',
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'lead-002',
    employee_id: '11111111-1111-1111-1111-111111111111',
    created_by_id: '11111111-1111-1111-1111-111111111111',
    customer_id: null,
    customer_name: 'Apollo Health City (Dr. Arvind Rao)',
    customer_type: 'Hospital',
    title: 'Quarterly Multi-Specialty Bulk Order',
    opportunity_type: 'Bulk Purchase',
    lead_source: 'Cold Visit',
    stage: 'INTERESTED',
    priority: 'HIGH',
    expected_value: 220000,
    actual_converted_value: null,
    expected_close_date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
    location_city: 'Koramangala, Bangalore',
    contact_person: 'Mr. Arvind Rao (Procurement)',
    contact_phone: '+91 98450 67890',
    latitude: 12.9352,
    longitude: 77.6245,
    notes: 'Quotation sent. Awaiting feedback from purchasing committee.',
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'lead-003',
    employee_id: '11111111-1111-1111-1111-111111111111',
    created_by_id: '11111111-1111-1111-1111-111111111111',
    customer_id: null,
    customer_name: 'CareWell Polyclinic (Dr. Rajesh Kumar)',
    customer_type: 'Clinic',
    title: 'Diabetic Care Product Line Placement',
    opportunity_type: 'Clinic supply',
    lead_source: 'Referral',
    stage: 'INTERESTED',
    priority: 'MEDIUM',
    expected_value: 95000,
    actual_converted_value: null,
    expected_close_date: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
    location_city: 'BTM Layout, Bangalore',
    contact_person: 'Dr. Rajesh Kumar',
    contact_phone: '+91 98450 54321',
    latitude: 12.9141,
    longitude: 77.6329,
    notes: 'Requested product literature and clinical trial reprints.',
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'lead-004',
    employee_id: '11111111-1111-1111-1111-111111111111',
    created_by_id: '11111111-1111-1111-1111-111111111111',
    customer_id: null,
    customer_name: 'Fortis Hospital (Dr. Ananya Roy)',
    customer_type: 'Hospital',
    title: 'Critical Care Antibiotics Formulary Listing',
    opportunity_type: 'Hospital formulary',
    lead_source: 'Doctor Visit',
    stage: 'QUALIFIED',
    priority: 'HIGH',
    expected_value: 350000,
    actual_converted_value: null,
    expected_close_date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    location_city: 'Bannerghatta Road, Bangalore',
    contact_person: 'Dr. Ananya Roy',
    contact_phone: '+91 98450 11223',
    latitude: 12.8951,
    longitude: 77.5982,
    notes: 'Head of ICU. Requested clinical presentation for committee.',
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'lead-005',
    employee_id: '11111111-1111-1111-1111-111111111111',
    created_by_id: '11111111-1111-1111-1111-111111111111',
    customer_id: null,
    customer_name: 'Columbia Asia Clinics (Dr. Vikram Singhania)',
    customer_type: 'Clinic',
    title: 'Gastroenterology Enzymes Trial Distribution',
    opportunity_type: 'Clinic supply',
    lead_source: 'Referral',
    stage: 'CONTACTED',
    priority: 'MEDIUM',
    expected_value: 120000,
    actual_converted_value: null,
    expected_close_date: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0],
    location_city: 'Indiranagar, Bangalore',
    contact_person: 'Dr. Vikram Singhania',
    contact_phone: '+91 98450 33445',
    latitude: 12.9784,
    longitude: 77.6408,
    notes: 'Follow-up regarding clinical evidence binder.',
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'lead-006',
    employee_id: '11111111-1111-1111-1111-111111111111',
    created_by_id: '11111111-1111-1111-1111-111111111111',
    customer_id: null,
    customer_name: 'MedPlus Specialty Center (Dr. S. K. Murthy)',
    customer_type: 'Doctor',
    title: 'Neurology Maintenance Therapy Contract',
    opportunity_type: 'Pharma supply',
    lead_source: 'Doctor Visit',
    stage: 'QUALIFIED',
    priority: 'HIGH',
    expected_value: 180000,
    actual_converted_value: null,
    expected_close_date: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0],
    location_city: 'Jayanagar, Bangalore',
    contact_person: 'Dr. S. K. Murthy',
    contact_phone: '+91 98450 77889',
    latitude: 12.9308,
    longitude: 77.5838,
    notes: 'Very interested in trial batch placement.',
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let mockFollowUps: FollowUpResponse[] = [
  {
    id: 'fu-001',
    employee_id: '11111111-1111-1111-1111-111111111111',
    created_by_id: '11111111-1111-1111-1111-111111111111',
    lead_id: 'lead-001',
    customer_id: null,
    customer_name: 'Dr. Jane Smith (Cardiology)',
    action_type: 'Visit',
    title: 'Formulary Contract Negotiation & Signoff',
    due_at: new Date().toISOString(),
    priority: 'HIGH',
    notes: 'Must finalize discount structure and delivery cadence.',
    status: 'PENDING',
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Starts null by default so the UI prompts the user to generate a route!
let mockPlan: PlanResponse | null = null;
const mockPlansByRep: Record<string, PlanResponse | null> = {};


function createDynamicMockPlan(
  payload: PlanGeneratePayload,
  previousFeedback?: { category: string; notes: string }
): PlanResponse {
  const planId = 'plan-' + Date.now();
  
  // Intelligent Adaptation based on Manager Rejection Feedback:
  let pool = [...mockLeads];
  if (previousFeedback?.category === 'DOCTOR_UNAVAILABLE') {
    // Manager flagged doctor unavailable: Exclude Dr. Jane Smith (lead-001)
    pool = pool.filter((l) => l.id !== 'lead-001');
  }
  
  const suggestedMax = previousFeedback?.category === 'EXCESSIVE_STOPS' ? 4 : (payload.max_stops || 5);
  const maxStops = Math.max(1, Math.min(suggestedMax, pool.length));
  const chosenLeads = pool.slice(0, maxStops);

  const items: PlanItemResponse[] = [];
  let currentSeq = 1;

  const morningTimes = [
    { arrival: '09:30:00', departure: '10:15:00', transitSec: 900, transitDist: 3500 },
    { arrival: '10:45:00', departure: '11:30:00', transitSec: 1800, transitDist: 4800 },
    { arrival: '11:50:00', departure: '12:35:00', transitSec: 1200, transitDist: 3200 },
  ];

  const afternoonTimes = [
    { arrival: '14:15:00', departure: '15:00:00', transitSec: 1800, transitDist: 5100 },
    { arrival: '15:15:00', departure: '16:00:00', transitSec: 900, transitDist: 2800 },
    { arrival: '16:20:00', departure: '17:05:00', transitSec: 1200, transitDist: 3900 },
  ];

  const morningCount = Math.min(Math.ceil(chosenLeads.length / 2), morningTimes.length);
  const morningLeads = chosenLeads.slice(0, morningCount);
  const afternoonLeads = chosenLeads.slice(morningCount);

  // 1. Morning stops
  morningLeads.forEach((lead, i) => {
    const timeSlot = morningTimes[i] || { arrival: '10:00:00', departure: '10:45:00', transitSec: 900, transitDist: 3000 };
    const badges: WhyBadge[] = [];
    if (lead.stage === 'QUALIFIED') {
      badges.push({ type: 'CONVERSION', text: 'High Conversion Probability' });
    }
    if ((lead.expected_value || 0) >= 150000) {
      badges.push({ type: 'VALUE', text: `High Value Deal (₹${((lead.expected_value || 0) / 100000).toFixed(1)}L)` });
    }
    if (lead.priority === 'HIGH') {
      badges.push({ type: 'URGENCY', text: 'Doctor Follow-up Urgent' });
    }
    badges.push({ type: 'PACING', text: 'Target Pacing Catchup' });

    const itemId = `item-${currentSeq}-${Date.now()}`;
    items.push({
      id: itemId,
      plan_id: planId,
      sequence_order: currentSeq++,
      activity_type: 'PHYSICAL_VISIT',
      stop_type: i === 0 ? 'MANAGER_MANDATORY' : 'AI_RECOMMENDED',
      status: 'PENDING',
      lead_id: lead.id,
      latitude: lead.latitude,
      longitude: lead.longitude,
      location_address: `${lead.customer_name} • ${lead.location_city}`,
      planned_arrival_time: timeSlot.arrival,
      planned_departure_time: timeSlot.departure,
      estimated_duration_minutes: 45,
      transit_distance_m: timeSlot.transitDist,
      transit_duration_s: timeSlot.transitSec,
      recommendation_score: 96 - currentSeq * 5,
      recommendation_reasons: {
        doctor_name: lead.customer_name,
        lead_title: lead.title,
        factors: {
          urgency: 0.88,
          deal_value: 0.92,
          target_pacing_boost: 0.95,
          priority: 0.85,
        },
        badges,
      },
      obligations: [
        {
          id: `obl-${currentSeq}-1`,
          plan_item_id: itemId,
          obligation_type: 'TASK',
          obligation_title: i === 0 ? 'Deliver Clinical Trial Dossier' : 'Present Product Formulary Specs',
          is_mandatory: true,
          fulfillment_status: 'PENDING',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: `obl-${currentSeq}-2`,
          plan_item_id: itemId,
          obligation_type: 'FOLLOW_UP',
          obligation_title: 'Record Prescribing Sentiment & Feedback',
          is_mandatory: false,
          fulfillment_status: 'PENDING',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  // 2. Mandatory 45-minute Lunch Break (13:00 to 13:45)
  items.push({
    id: `item-lunch-${Date.now()}`,
    plan_id: planId,
    sequence_order: currentSeq++,
    activity_type: 'LUNCH_BREAK',
    stop_type: 'LUNCH_BREAK',
    status: 'PENDING',
    planned_arrival_time: '13:00:00',
    planned_departure_time: '13:45:00',
    estimated_duration_minutes: 45,
    transit_distance_m: 0,
    transit_duration_s: 0,
    location_address: 'Midday Repast & Rest Window (45 mins)',
    recommendation_reasons: {
      note: 'Labor policy pause scheduled between 13:00 and 14:15',
    },
    obligations: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // 3. Afternoon stops
  afternoonLeads.forEach((lead, i) => {
    const timeSlot = afternoonTimes[i] || { arrival: '15:00:00', departure: '15:45:00', transitSec: 900, transitDist: 3000 };
    const badges: WhyBadge[] = [];
    if (lead.stage === 'QUALIFIED') {
      badges.push({ type: 'CONVERSION', text: 'High Conversion Probability' });
    }
    if ((lead.expected_value || 0) >= 150000) {
      badges.push({ type: 'VALUE', text: `High Value Deal (₹${((lead.expected_value || 0) / 100000).toFixed(1)}L)` });
    }
    if (lead.priority === 'HIGH') {
      badges.push({ type: 'URGENCY', text: 'Doctor Follow-up Urgent' });
    }
    badges.push({ type: 'PACING', text: 'Target Pacing Catchup' });

    const itemId = `item-${currentSeq}-${Date.now()}`;
    items.push({
      id: itemId,
      plan_id: planId,
      sequence_order: currentSeq++,
      activity_type: 'PHYSICAL_VISIT',
      stop_type: 'AI_RECOMMENDED',
      status: 'PENDING',
      lead_id: lead.id,
      latitude: lead.latitude,
      longitude: lead.longitude,
      location_address: `${lead.customer_name} • ${lead.location_city}`,
      planned_arrival_time: timeSlot.arrival,
      planned_departure_time: timeSlot.departure,
      estimated_duration_minutes: 45,
      transit_distance_m: timeSlot.transitDist,
      transit_duration_s: timeSlot.transitSec,
      recommendation_score: 84 - i * 5,
      recommendation_reasons: {
        doctor_name: lead.customer_name,
        lead_title: lead.title,
        factors: {
          urgency: 0.78,
          deal_value: 0.82,
          target_pacing_boost: 0.85,
        },
        badges,
      },
      obligations: [
        {
          id: `obl-${currentSeq}-1`,
          plan_item_id: itemId,
          obligation_type: 'TASK',
          obligation_title: 'Present Product Formulary Specs',
          is_mandatory: false,
          fulfillment_status: 'PENDING',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  const totalDistance = items.reduce((acc, it) => acc + (it.transit_distance_m || 0), 0);
  const totalDuration = items.reduce((acc, it) => acc + (it.transit_duration_s || 0) + it.estimated_duration_minutes * 60, 0);

  return {
    id: planId,
    employee_id: payload.employee_id,
    plan_date: payload.plan_date,
    version: 1,
    revision_type: 'INITIAL_ROUTING',
    status: 'PENDING_APPROVAL',
    total_planned_stops: chosenLeads.length,
    total_planned_distance_meters: totalDistance,
    total_planned_duration_seconds: totalDuration,
    routing_engine: 'OSRM_2OPT_TSPTW',
    idempotency_key: payload.idempotency_key,
    approved_by_id: '00000000-0000-0000-0000-000000000000',
    approved_at: new Date().toISOString(),
    items,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

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

  // ---------------------------------------------------------------------------
  // AI Daily Sales Plan Endpoints (Phase 3 Backend Integration)
  // ---------------------------------------------------------------------------

  resetDailySalesPlan(): void {
    mockPlan = null;
  }

  async getDailySalesPlan(date?: string, employeeId?: string): Promise<PlanResponse | null> {
    const isDemo = localStorage.getItem('access_token')?.startsWith('demo-jwt');
    const targetEmpId = employeeId || JSON.parse(localStorage.getItem('demo_user') || '{}').id || '22222222-2222-2222-2222-222222222222';
    if (isDemo) {
      return mockPlansByRep[targetEmpId] !== undefined ? mockPlansByRep[targetEmpId] : mockPlan;
    }
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (employeeId) params.append('employee_id', employeeId);
    const query = params.toString() ? `?${params.toString()}` : '';
    try {
      return await this.request<PlanResponse>(`/api/v1/plans/daily${query}`);
    } catch (err: any) {
      if (
        err.message &&
        (err.message.includes('404') ||
          err.message.toLowerCase().includes('not found') ||
          err.message.includes('Failed to fetch') ||
          err.message.includes('NetworkError') ||
          err.message === 'DEMO_MODE_ACTIVE')
      ) {
        return mockPlan;
      }
      throw err;
    }
  }

  async generateDailySalesPlan(payload: PlanGeneratePayload): Promise<PlanResponse> {
    const isDemo = localStorage.getItem('access_token')?.startsWith('demo-jwt');
    if (isDemo) {
      const prevPlan = mockPlansByRep[payload.employee_id] || mockPlan;
      const prevFeedback = (prevPlan as any)?.rejection_feedback;
      const newPlan = createDynamicMockPlan(payload, prevFeedback);
      mockPlansByRep[payload.employee_id] = newPlan;
      mockPlan = newPlan;
      return newPlan;
    }
    try {
      return await this.request<PlanResponse>('/api/v1/plans/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      if (
        err.message &&
        (err.message.includes('Failed to fetch') ||
          err.message.includes('NetworkError') ||
          err.message === 'DEMO_MODE_ACTIVE')
      ) {
        mockPlan = createDynamicMockPlan(payload);
        return mockPlan;
      }
      throw err;
    }
  }

  async replanDailySalesPlan(planId: string, payload: PlanReplanPayload): Promise<PlanResponse> {
    const isDemo = localStorage.getItem('access_token')?.startsWith('demo-jwt');
    if (isDemo) {
      if (!mockPlan) throw new Error('No active plan to replan');
      mockPlan = {
        ...mockPlan,
        version: mockPlan.version + 1,
        revision_type: 'MIDDAY_REPLAN',
      };
      return mockPlan;
    }
    return this.request<PlanResponse>(`/api/v1/plans/${planId}/replan`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async reconcileDailySalesPlan(planId: string): Promise<PlanResponse> {
    const isDemo = localStorage.getItem('access_token')?.startsWith('demo-jwt');
    if (isDemo) {
      if (!mockPlan) throw new Error('No active plan to reconcile');
      return mockPlan;
    }
    return this.request<PlanResponse>(`/api/v1/plans/${planId}/reconcile`, {
      method: 'POST',
    });
  }

  async rejectDailySalesPlan(planId: string, payload: { category: string; notes: string }): Promise<PlanResponse> {
    const isDemo = localStorage.getItem('access_token')?.startsWith('demo-jwt');
    if (isDemo) {
      let targetPlan: PlanResponse | null = mockPlan;
      for (const empId of Object.keys(mockPlansByRep)) {
        if (mockPlansByRep[empId]?.id === planId) {
          targetPlan = mockPlansByRep[empId];
          break;
        }
      }
      if (!targetPlan) throw new Error('No active plan found to reject');
      targetPlan.status = 'REJECTED';
      (targetPlan as any).rejection_feedback = {
        category: payload.category,
        notes: payload.notes,
        rejected_by_name: 'Alex Vance (General Director)',
        rejected_at: new Date().toISOString(),
      };
      return targetPlan;
    }
    return this.request<PlanResponse>(`/api/v1/plans/${planId}/reject`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async approveDailySalesPlan(planId: string, payload?: PlanApprovePayload): Promise<PlanResponse> {
    const isDemo = localStorage.getItem('access_token')?.startsWith('demo-jwt');
    if (isDemo) {
      if (!mockPlan) throw new Error('No active plan to approve');
      mockPlan = {
        ...mockPlan,
        status: 'APPROVED',
        approved_at: new Date().toISOString(),
      };
      return mockPlan;
    }
    return this.request<PlanResponse>(`/api/v1/plans/${planId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  }

  async startDailySalesPlanItem(itemId: string, payload: PlanItemStartPayload): Promise<PlanItemResponse> {
    const isDemo = localStorage.getItem('access_token')?.startsWith('demo-jwt');
    if (isDemo) {
      if (!mockPlan) throw new Error('No active plan');
      const item = mockPlan.items.find((i) => i.id === itemId);
      if (!item) throw new Error('Plan item not found');
      item.status = 'ARRIVED';
      item.recommendation_reasons = {
        ...(item.recommendation_reasons || {}),
        actual_arrival_time: new Date().toTimeString().split(' ')[0],
        arrival_latitude: payload.latitude,
        arrival_longitude: payload.longitude,
        proof_photo_uploaded: !!payload.proof_photo,
      };
      if (mockPlan.status === 'APPROVED' || mockPlan.status === 'DRAFT') {
        mockPlan.status = 'IN_PROGRESS';
      }
      return item;
    }
    return this.request<PlanItemResponse>(`/api/v1/plans/items/${itemId}/start`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async completeDailySalesPlanItem(itemId: string, payload: PlanItemCompletePayload): Promise<PlanItemResponse> {
    const isDemo = localStorage.getItem('access_token')?.startsWith('demo-jwt');
    if (isDemo) {
      if (!mockPlan) throw new Error('No active plan');
      const item = mockPlan.items.find((i) => i.id === itemId);
      if (!item) throw new Error('Plan item not found');
      item.status = 'COMPLETED';
      item.recommendation_reasons = {
        ...(item.recommendation_reasons || {}),
        actual_departure_time: new Date().toTimeString().split(' ')[0],
        completion_latitude: payload.actual_latitude,
        completion_longitude: payload.actual_longitude,
        visit_outcome: payload.visit_outcome,
        notes: payload.notes,
      };

      for (const obl of item.obligations) {
        obl.fulfillment_status = 'FULFILLED';
        obl.fulfilled_at = new Date().toISOString();
        obl.outcome_notes = payload.notes;
      }

      if (item.lead_id) {
        const lead = mockLeads.find((l) => l.id === item.lead_id);
        if (lead) {
          lead.last_interaction_date = new Date().toISOString();
          if (payload.actual_converted_value) {
            lead.actual_converted_value = payload.actual_converted_value;
          }
          if (payload.updated_lead_stage && !['CONVERTED', 'LOST'].includes(payload.updated_lead_stage)) {
            lead.stage = payload.updated_lead_stage;
          }
        }
      }

      return item;
    }
    return this.request<PlanItemResponse>(`/api/v1/plans/items/${itemId}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async skipDailySalesPlanItem(itemId: string, payload: PlanItemSkipPayload): Promise<PlanItemResponse> {
    const isDemo = localStorage.getItem('access_token')?.startsWith('demo-jwt');
    if (isDemo) {
      if (!mockPlan) throw new Error('No active plan');
      const item = mockPlan.items.find((i) => i.id === itemId);
      if (!item) throw new Error('Plan item not found');
      item.status = 'SKIPPED';
      item.recommendation_reasons = {
        ...(item.recommendation_reasons || {}),
        skip_reason: payload.skip_reason,
      };
      return item;
    }
    return this.request<PlanItemResponse>(`/api/v1/plans/items/${itemId}/skip`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ---------------------------------------------------------------------------
  // CRM Pipeline Endpoints
  // ---------------------------------------------------------------------------

  async getMonthlyTargetCurrent(): Promise<MonthlyTargetResponse | null> {
    const isDemo = localStorage.getItem('access_token')?.startsWith('demo-jwt');
    if (isDemo) {
      return mockMonthlyTarget;
    }
    try {
      return await this.request<MonthlyTargetResponse>('/api/v1/crm/monthly-targets/current');
    } catch {
      return null;
    }
  }

  async listCRMLeads(stage?: string): Promise<LeadResponse[]> {
    const isDemo = localStorage.getItem('access_token')?.startsWith('demo-jwt');
    if (isDemo) {
      if (stage) return mockLeads.filter((l) => l.stage === stage);
      return mockLeads;
    }
    const query = stage ? `?stage=${encodeURIComponent(stage)}` : '';
    return this.request<LeadResponse[]>(`/api/v1/crm/leads${query}`);
  }

  async createCRMLead(payload: LeadCreatePayload): Promise<LeadResponse> {
    const isDemo = localStorage.getItem('access_token')?.startsWith('demo-jwt');
    if (isDemo) {
      const lead: LeadResponse = {
        id: 'lead-' + Date.now(),
        employee_id: payload.employee_id,
        created_by_id: payload.employee_id,
        customer_id: payload.customer_id || null,
        customer_name: payload.customer_name || null,
        customer_type: payload.customer_type || 'Doctor',
        title: payload.title,
        opportunity_type: payload.opportunity_type || 'Hospital service',
        lead_source: payload.lead_source || 'Doctor Visit',
        stage: payload.stage || 'NEW',
        priority: payload.priority || 'MEDIUM',
        expected_value: payload.expected_value || null,
        actual_converted_value: null,
        expected_close_date: payload.expected_close_date || null,
        location_city: payload.location_city || null,
        contact_person: payload.contact_person || null,
        contact_phone: payload.contact_phone || null,
        latitude: payload.latitude || null,
        longitude: payload.longitude || null,
        notes: payload.notes || null,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockLeads.unshift(lead);
      return lead;
    }
    return this.request<LeadResponse>('/api/v1/crm/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async listCRMFollowUps(status?: string): Promise<FollowUpResponse[]> {
    const isDemo = localStorage.getItem('access_token')?.startsWith('demo-jwt');
    if (isDemo) {
      if (status) return mockFollowUps.filter((f) => f.status === status);
      return mockFollowUps;
    }
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<FollowUpResponse[]>(`/api/v1/crm/followups${query}`);
  }

  async createCRMFollowUp(payload: FollowUpCreatePayload): Promise<FollowUpResponse> {
    const isDemo = localStorage.getItem('access_token')?.startsWith('demo-jwt');
    if (isDemo) {
      const fu: FollowUpResponse = {
        id: 'fu-' + Date.now(),
        employee_id: payload.employee_id,
        created_by_id: payload.employee_id,
        lead_id: payload.lead_id || null,
        customer_id: payload.customer_id || null,
        customer_name: payload.customer_name || null,
        action_type: payload.action_type || 'Call',
        title: payload.title,
        due_at: payload.due_at,
        priority: payload.priority || 'MEDIUM',
        notes: payload.notes || null,
        status: 'PENDING',
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockFollowUps.unshift(fu);
      return fu;
    }
    return this.request<FollowUpResponse>('/api/v1/crm/followups', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async listCRMCustomers(): Promise<CustomerResponse[]> {
    const isDemo = localStorage.getItem('access_token')?.startsWith('demo-jwt');
    if (isDemo) {
      return [];
    }
    return this.request<CustomerResponse[]>('/api/v1/crm/customers');
  }
}

export const api = new ApiClient();
