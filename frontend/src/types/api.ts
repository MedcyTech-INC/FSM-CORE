/**
 * Pure API Data Transfer Objects (DTOs)
 * Strictly decoupled from database internals (zero table names).
 */

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'ADMIN' | 'GM' | 'ZSM' | 'RSM' | 'MR';
  rank?: string;
  territory?: string;
  is_active: boolean;
  reporting_to_id?: string;
  metadata_json?: Record<string, any>;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface BreakRecord {
  id: string;
  attendance_id: string;
  start_time: string;
  end_time?: string;
  reason?: string;
  duration_minutes: number;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  work_date: string;
  punch_in_time?: string;
  punch_out_time?: string;
  punch_in_lat?: number;
  punch_in_lon?: number;
  punch_out_lat?: number;
  punch_out_lon?: number;
  punch_in_proof?: string;
  punch_out_summary?: string;
  status: 'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'ON_LEAVE';
  verification_status: 'VERIFIED' | 'GEOFENCE_FLAGGED' | 'ACCURACY_DEGRADED' | 'MANUAL_OVERRIDE';
  working_minutes: number;
  breaks: BreakRecord[];
}

export interface FieldSession {
  id: string;
  employee_id: string;
  start_time: string;
  end_time?: string;
  start_lat: number;
  start_lon: number;
  end_lat?: number;
  end_lon?: number;
  accumulated_distance_km: number;
  status: 'ACTIVE' | 'COMPLETED';
}

export interface FieldVisit {
  id: string;
  session_id?: string;
  employee_id: string;
  target_type: string; // Doctor, Chemist, Farmer, Facility, Dealer
  target_name: string;
  target_identifier?: string;
  visit_date: string;
  arrival_time?: string;
  completion_time?: string;
  latitude?: number;
  longitude?: number;
  proof_photo?: string; // Base64
  discussion_notes?: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSED' | 'CANCELLED';
  custom_fields?: Record<string, any>;
}

export interface LeaveBalance {
  id: string;
  leave_type: string;
  year: number;
  allocated_days: number;
  used_days: number;
  remaining_days: number;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approved_by_id?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface TaskItem {
  id: string;
  creator_id: string;
  assignee_id: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  completed_at?: string;
}
