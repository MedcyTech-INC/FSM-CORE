/**
 * Domain contracts for AI Daily Sales Plan and CRM Pipeline.
 * 100% aligned with backend Pydantic models and REST API routers.
 */

export type PlanStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CONFLICT_DETECTED'
  | 'REJECTED'
  | 'SUPERSEDED';

export type ItemStatus =
  | 'PENDING'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'EXTERNALLY_RESOLVED';

export type ActivityType =
  | 'PHYSICAL_VISIT'
  | 'PHONE_CALL'
  | 'LUNCH_BREAK'
  | 'ADMIN_DESK';

export type StopType =
  | 'AI_RECOMMENDED'
  | 'MANAGER_MANDATORY'
  | 'TASK_VISIT'
  | 'LUNCH_BREAK';

export type ObligationStatus =
  | 'PENDING'
  | 'FULFILLED'
  | 'UNFULFILLED_RESCHEDULED'
  | 'CANCELLED'
  | 'EXTERNALLY_RESOLVED';

export type LeadStage =
  | 'NEW'
  | 'CONTACTED'
  | 'INTERESTED'
  | 'QUALIFIED'
  | 'CONVERTED'
  | 'LOST';

export type LeadPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type VisitOutcome =
  | 'SUCCESSFUL_MEETING'
  | 'DOCTOR_UNAVAILABLE'
  | 'RESCHEDULE_REQUESTED'
  | 'GATEKEEPER_BLOCKED';

export interface WhyBadge {
  type: 'URGENCY' | 'VALUE' | 'PACING' | 'PRIORITY' | 'RECENCY' | 'CHRONIC_BACKLOG' | 'CONVERSION';
  text: string;
}

export interface RecommendationReasons {
  factors?: {
    urgency?: number;
    deal_value?: number;
    target_pacing_boost?: number;
    priority?: number;
    recency_decay?: number;
  };
  badges?: WhyBadge[];
  actual_arrival_time?: string;
  actual_departure_time?: string;
  arrival_latitude?: number;
  arrival_longitude?: number;
  completion_latitude?: number;
  completion_longitude?: number;
  visit_outcome?: string;
  notes?: string;
  skip_reason?: string;
  proof_photo_uploaded?: boolean;
  [key: string]: any;
}

export interface PlanObligationResponse {
  id: string;
  plan_item_id: string;
  obligation_type: string;
  obligation_title: string;
  is_mandatory: boolean;
  lead_id?: string | null;
  follow_up_id?: string | null;
  task_id?: string | null;
  fulfillment_status: ObligationStatus;
  outcome_notes?: string | null;
  fulfilled_at?: string | null;
  rescheduled_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanItemResponse {
  id: string;
  plan_id: string;
  sequence_order: number;
  activity_type: ActivityType;
  planned_arrival_time?: string | null;
  planned_departure_time?: string | null;
  estimated_duration_minutes: number;
  lead_id?: string | null;
  customer_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_address?: string | null;
  stop_type: StopType;
  recommendation_score?: number | null;
  recommendation_reasons?: RecommendationReasons | null;
  status: ItemStatus;
  field_visit_id?: string | null;
  transit_distance_m: number;
  transit_duration_s: number;
  obligations: PlanObligationResponse[];
  created_at: string;
  updated_at: string;
}

export interface PlanResponse {
  id: string;
  employee_id: string;
  plan_date: string;
  version: number;
  revision_type: string;
  status: PlanStatus;
  total_planned_stops: number;
  total_planned_distance_meters: number;
  total_planned_duration_seconds: number;
  routing_engine: string;
  idempotency_key: string;
  approved_by_id?: string | null;
  approved_at?: string | null;
  items: PlanItemResponse[];
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Request Payloads
// -----------------------------------------------------------------------------

export interface PlanGeneratePayload {
  employee_id: string;
  plan_date: string; // YYYY-MM-DD
  start_latitude: number;
  start_longitude: number;
  max_stops?: number;
  idempotency_key: string;
  force_regenerate?: boolean;
}

export interface PlanReplanPayload {
  current_latitude: number;
  current_longitude: number;
  replan_reason: string;
}

export interface PlanItemStartPayload {
  latitude: number;
  longitude: number;
  proof_photo?: string; // Base64 string per Phase 1-3 spec
}

export interface ObligationFulfillmentItem {
  obligation_id: string;
  fulfillment_status: 'FULFILLED' | 'UNFULFILLED_RESCHEDULED' | 'CANCELLED';
  notes?: string;
  rescheduled_date?: string; // YYYY-MM-DD
}

export interface NextFollowUpPayload {
  scheduled_date: string; // YYYY-MM-DD
  scheduled_time?: string; // HH:MM:SS
  title: string;
  urgency?: 'NORMAL' | 'HIGH';
  action_type?: string;
}

export interface PlanItemCompletePayload {
  idempotency_key: string;
  actual_latitude: number;
  actual_longitude: number;
  visit_outcome: VisitOutcome;
  notes?: string;
  updated_lead_stage?: LeadStage;
  actual_converted_value?: number;
  obligations?: ObligationFulfillmentItem[];
  next_follow_up?: NextFollowUpPayload;
}

export interface PlanItemSkipPayload {
  skip_reason: string;
}

export interface PlanApprovePayload {
  notes?: string;
}

// -----------------------------------------------------------------------------
// CRM Pipeline Entities
// -----------------------------------------------------------------------------

export interface LeadResponse {
  id: string;
  employee_id: string;
  created_by_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_type: string;
  title: string;
  opportunity_type: string;
  interested_product_service?: string | null;
  customer_response?: string | null;
  lead_source: string;
  stage: LeadStage;
  priority: LeadPriority;
  expected_value?: number | null;
  actual_converted_value?: number | null;
  expected_close_date?: string | null;
  location_city?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  last_interaction_date?: string | null;
  conversion_outcome?: string | null;
  loss_reason?: string | null;
  closed_at?: string | null;
  field_visit_id?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadCreatePayload {
  employee_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_type?: string;
  title: string;
  opportunity_type?: string;
  interested_product_service?: string | null;
  customer_response?: string | null;
  lead_source?: string;
  stage?: LeadStage;
  priority?: LeadPriority;
  expected_value?: number | null;
  expected_close_date?: string | null;
  location_city?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
}

export interface FollowUpResponse {
  id: string;
  employee_id: string;
  created_by_id: string;
  lead_id?: string | null;
  customer_id?: string | null;
  field_visit_id?: string | null;
  customer_name?: string | null;
  action_type: string;
  title: string;
  due_at: string;
  priority: LeadPriority;
  notes?: string | null;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  outcome?: string | null;
  cancel_reason?: string | null;
  completed_at?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface FollowUpCreatePayload {
  employee_id: string;
  lead_id?: string | null;
  customer_id?: string | null;
  field_visit_id?: string | null;
  customer_name?: string | null;
  action_type?: string;
  title: string;
  due_at: string;
  priority?: LeadPriority;
  notes?: string | null;
}

export interface MonthlyTargetResponse {
  id: string;
  employee_id: string;
  target_month: string; // YYYY-MM-DD (1st of month)
  target_revenue: number;
  achieved_revenue: number;
  target_visits: number;
  achieved_visits: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerResponse {
  id: string;
  name: string;
  customer_type: string;
  contact_person?: string | null;
  phone?: string | null;
  location_city?: string | null;
  location_area?: string | null;
  territory?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
