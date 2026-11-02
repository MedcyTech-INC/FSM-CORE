/**
 * Revenue Leakage Feature Types
 * Strictly aligned with Backend Schemas and Implementation Plan (Revision 4).
 * Strict Language Rule: NEVER use 'loss', 'lost revenue' or 'leakage amount'.
 */

export type RuleCode =
  | 'unvisited_client'
  | 'abandoned_lead'
  | 'declining_frequency'
  | 'inactive_opportunity'
  | 'underperforming_territory';

export type AlertClassification =
  | 'operational_warning'
  | 'potential_exposure'
  | 'confirmed_commercial_loss'
  | 'verified_financial_discrepancy';

export type AttentionPriority = 'low' | 'medium' | 'high';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';

export type ActionType = 'acknowledged' | 'resolved' | 'dismissed' | 'note' | 'escalated' | 'auto_cleared';

export type ActionOutcome =
  | 'normal_variation'
  | 'investigation_needed'
  | 'corrective_action_taken'
  | 'commercial_outcome_evidenced'
  | 'condition_cleared';

export type ObservationReason =
  | 'created'
  | 'priority_changed'
  | 'value_changed'
  | 'resolved'
  | 'suppressed_recurrence';

export interface AlertObservationDTO {
  id: string;
  observed_at: string;
  observation: Record<string, any>;
  attention_priority: AttentionPriority;
  reason: ObservationReason;
}

export interface AlertActionDTO {
  id: string;
  alert_id: string;
  action_type: ActionType;
  outcome: ActionOutcome | null;
  action_taken: string;
  evidence_reference: string | null;
  notes: string | null;
  action_by: string;
  created_at: string;
}

export interface EarlierOccurrenceDTO {
  id: string;
  occurrence_no: number;
  status: AlertStatus;
  first_detected_at: string;
  resolved_at: string | null;
  archived: boolean;
}

export interface AlertItemDTO {
  id: string;
  rule_code: RuleCode;
  rule_name: string;
  entity_type: 'customer' | 'lead' | 'territory';
  entity_id: string;
  entity_label: string;
  owner_id: string | null;
  classification: AlertClassification;
  attention_priority: AttentionPriority;
  priority_reason: string;
  observation: Record<string, any>;
  exposure_amount: number | null;
  exposure_basis: string | null;
  status: AlertStatus;
  version: number;
  occurrence_no: number;
  previous_alert_id: string | null;
  first_detected_at: string;
  last_observed_at: string;
  resolved_at: string | null;
  suppressed_until: string | null;
  clear_streak: number;
  escalation_level: number;
}

export interface AlertDetailDTO extends AlertItemDTO {
  observations: AlertObservationDTO[];
  actions: AlertActionDTO[];
  occurrences: EarlierOccurrenceDTO[];
}

export interface PaginatedAlertsDTO {
  items: AlertItemDTO[];
  total: number;
  page: number;
  page_size: number;
}

export interface RuleDTO {
  id: string;
  rule_code: RuleCode;
  rule_name: string;
  description: string | null;
  threshold_days: number;
  threshold_value: number;
  medium_priority_ratio: number;
  high_priority_ratio: number;
  change_ratio: number;
  cooldown_days: number;
  dismiss_days: number;
  autoclear_scans: number;
  escalation_days: number;
  min_history_months: number;
  params: Record<string, any>;
  required_sources: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RulePatchPayload {
  threshold_days?: number;
  threshold_value?: number;
  medium_priority_ratio?: number;
  high_priority_ratio?: number;
  change_ratio?: number;
  cooldown_days?: number;
  dismiss_days?: number;
  autoclear_scans?: number;
  escalation_days?: number;
  min_history_months?: number;
  params?: Record<string, any>;
  is_active?: boolean;
  reason: string;
}

export interface ScanRunDTO {
  id: string;
  rule_code: RuleCode;
  mode: 'baseline' | 'normal';
  started_at: string;
  heartbeat_at: string;
  finished_at: string | null;
  status: 'running' | 'succeeded' | 'failed' | 'partial' | 'skipped_source_missing';
  rows_evaluated: number;
  alerts_created: number;
  alerts_updated: number;
  alerts_cleared: number;
  skipped_not_synced: number;
  attempt: number;
  error_message: string | null;
}

export interface AlertActionPayload {
  action_type: ActionType;
  expected_version: number;
  outcome?: ActionOutcome;
  action_taken: string;
  evidence_reference?: string;
  notes?: string;
}
