export type FollowupStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';
export type FollowupTab = 'due_today' | 'upcoming' | 'overdue' | 'completed' | 'all';
export type FollowupPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Followup {
  id: string;
  employee_id: string;
  employee_name?: string;
  created_by_id: string;
  created_by_name?: string;

  lead_id?: string;
  lead_title?: string;
  lead_customer_id?: string;
  field_visit_id?: string;
  customer_name?: string;

  action_type: string;
  title: string;
  due_at: string; // ISO UTC
  priority: FollowupPriority;
  notes?: string;

  status: FollowupStatus;
  outcome?: string;
  cancel_reason?: string;
  completed_at?: string;

  is_overdue: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface FollowupCreateInput {
  lead_id?: string;
  lead_customer_id?: string;
  field_visit_id?: string;
  customer_name?: string;

  action_type: string;
  title: string;
  due_at: string;
  priority?: FollowupPriority;
  notes?: string;
  employee_id?: string;
}

export interface FollowupCompleteInput {
  outcome: string;
}

export interface FollowupRescheduleInput {
  new_due_at: string;
  reason: string;
}

export interface FollowupCancelInput {
  cancel_reason: string;
}

export interface FollowupHistoryItem {
  id: string;
  followup_id: string;
  actor_id: string;
  actor_name?: string;
  event_type: string;
  old_value?: string;
  new_value?: string;
  notes?: string;
  occurred_at: string;
}

export interface DueSummary {
  due_today: number;
  overdue: number;
  upcoming: number;
  completed_today: number;
}
