/**
 * Monthly Target Feature Types
 * Strictly aligned with Backend Schemas and Implementation Plan (Revision 4).
 */

export type MetricType = 'revenue' | 'doctor_visits' | 'new_leads' | 'conversions' | 'collections';
export type EntityType = 'representative' | 'team' | 'territory' | 'branch' | 'customer' | 'product';
export type TargetStatus = 'active' | 'backfilling' | 'closed' | 'cancelled';
export type TargetState = 'upcoming' | 'active' | 'achieved' | 'ended_short';

export interface TargetProgressDTO {
  current_value: number;
  last_updated_at: string;
}

export interface TargetAssignmentDTO {
  id: string;
  target_id: string;
  entity_type: EntityType;
  entity_id: string;
  assigned_at: string;
  ended_at: string | null;
  progress: TargetProgressDTO;
}

export interface TargetChangeDTO {
  id: string;
  target_id: string;
  version: number;
  field: string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  changed_by: string;
  changed_at: string;
}

export interface TargetDetailDTO {
  id: string;
  title: string;
  metric_type: MetricType;
  target_value: number;
  start_date: string;
  end_date: string;
  status: TargetStatus;
  version: number;
  final_value: number | null;
  closed_at: string | null;
  adjusted_at: string | null;
  cancel_reason: string | null;
  idempotency_key: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  assignments: TargetAssignmentDTO[];
  changes?: TargetChangeDTO[];
}

export interface MyProgressItemDTO {
  payload_version: number;
  target_id: string;
  title: string;
  scope: EntityType;
  entity_id: string;
  metric_type: MetricType;
  target_value: number;
  current_value: number;
  own_contribution: number;
  gap_remaining: number;
  days_left: number;
  required_daily_run_rate: number | null;
  percent_complete: number | null;
  state: TargetState;
  adjusted: boolean;
  start_date: string;
  end_date: string;
}

export interface TargetAssignmentCreatePayload {
  entity_type: EntityType;
  entity_id: string;
}

export interface TargetCreatePayload {
  title: string;
  metric_type: MetricType;
  target_value: number;
  start_date: string;
  end_date: string;
  assignments: TargetAssignmentCreatePayload[];
}

export interface TargetPatchPayload {
  version: number;
  reason: string;
  target_value?: number;
  start_date?: string;
  end_date?: string;
}

export interface TargetCancelPayload {
  version: number;
  reason: string;
}

export interface FSMErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any> | null;
  };
}

export interface HolidayDTO {
  holiday_date: string;
  name: string;
  region: string | null;
  created_at?: string;
}

export interface HolidayCreatePayload {
  holiday_date: string;
  name: string;
  region?: string;
}
