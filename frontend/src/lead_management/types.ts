export type LeadStage = 'NEW' | 'CONTACTED' | 'INTERESTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
export type LeadPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface LeadCustomer {
  id: string;
  name: string;
  customer_type: string;
  phone?: string;
  location_city?: string;
  location_area?: string;
  territory?: string;
  metadata_json?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadCustomerCreate {
  name: string;
  customer_type: string;
  phone?: string;
  location_city?: string;
  location_area?: string;
  territory?: string;
}

export interface Lead {
  id: string;
  employee_id: string;
  employee_name?: string;
  created_by_id: string;
  created_by_name?: string;

  lead_customer_id?: string;
  customer_name?: string;
  customer_type: string;

  title: string;
  lead_type: string;
  interested_product_service?: string;
  customer_response?: string;
  lead_source: string;
  stage: LeadStage;
  priority: LeadPriority;
  expected_value?: number;
  actual_converted_value?: number;
  expected_close_date?: string;
  location_city?: string;
  contact_person?: string;
  contact_phone?: string;
  notes?: string;
  last_interaction_date?: string;

  conversion_outcome?: string;
  loss_reason?: string;
  closed_at?: string;

  field_visit_id?: string;
  next_follow_up_due?: string;
  next_follow_up_title?: string;
  pending_followups_count?: number;

  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadCreateInput {
  title: string;
  lead_type: string;
  interested_product_service?: string;
  customer_response?: string;
  lead_source?: string;
  priority?: LeadPriority;
  expected_value?: number;
  expected_close_date?: string;

  lead_customer_id?: string;
  customer_name?: string;
  customer_type?: string;

  location_city?: string;
  contact_person?: string;
  contact_phone?: string;
  notes?: string;

  field_visit_id?: string;
  employee_id?: string;
}

export interface LeadUpdateInput {
  title?: string;
  lead_type?: string;
  interested_product_service?: string;
  customer_response?: string;
  lead_source?: string;
  priority?: LeadPriority;
  expected_value?: number;
  actual_converted_value?: number;
  expected_close_date?: string;
  location_city?: string;
  contact_person?: string;
  contact_phone?: string;
  notes?: string;
}

export interface LeadStageChangeInput {
  new_stage: LeadStage;
  actual_converted_value?: number;
  conversion_outcome?: string;
  loss_reason?: string;
  notes?: string;
}

export interface LeadAssignInput {
  new_employee_id: string;
  notes?: string;
}

export interface LeadHistoryItem {
  id: string;
  lead_id: string;
  actor_id: string;
  actor_name?: string;
  event_type: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  notes?: string;
  occurred_at: string;
}

export interface LeadSummary {
  total_leads: number;
  open_leads: number;
  interested_leads: number;
  qualified_leads: number;
  converted_leads: number;
  lost_leads: number;
  needs_attention_count: number;
  total_pipeline_value: number;
  my_leads_count: number;
}
