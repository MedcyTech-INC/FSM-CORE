-- =============================================================================
-- FSM MASTER CORE - COMPLETE ALL-IN-ONE DATABASE SCHEMA
-- Contains all tables across Core, Multi-Tenancy, and all 7 Features
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS audit_log (
	actor_id UUID, 
	action VARCHAR(100) NOT NULL, 
	resource_type VARCHAR(100) NOT NULL, 
	resource_id VARCHAR(100), 
	before_state JSONB, 
	after_state JSONB, 
	ip_address VARCHAR(50), 
	user_agent VARCHAR(255), 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_audit_resource ON audit_log (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS ix_audit_log_action ON audit_log (action);
CREATE INDEX IF NOT EXISTS ix_audit_log_resource_type ON audit_log (resource_type);
CREATE INDEX IF NOT EXISTS ix_audit_log_resource_id ON audit_log (resource_id);
CREATE INDEX IF NOT EXISTS ix_audit_log_actor_id ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS ix_audit_log_id ON audit_log (id);

CREATE TABLE IF NOT EXISTS employees (
	email VARCHAR(255) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	first_name VARCHAR(100) NOT NULL, 
	last_name VARCHAR(100) NOT NULL, 
	role VARCHAR(50) NOT NULL, 
	rank VARCHAR(50), 
	territory VARCHAR(150), 
	is_active BOOLEAN NOT NULL, 
	reporting_to_id UUID, 
	metadata_json JSONB, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(reporting_to_id) REFERENCES employees (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_employees_email ON employees (email);
CREATE INDEX IF NOT EXISTS ix_employees_role ON employees (role);
CREATE INDEX IF NOT EXISTS ix_employees_id ON employees (id);
CREATE INDEX IF NOT EXISTS ix_employees_active_role ON employees (is_active, role);
CREATE INDEX IF NOT EXISTS ix_employees_reporting_to_id ON employees (reporting_to_id);
CREATE INDEX IF NOT EXISTS ix_employees_is_active ON employees (is_active);
CREATE INDEX IF NOT EXISTS ix_employees_territory ON employees (territory);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_event_outbox (
	id UUID NOT NULL, 
	event_type VARCHAR(50) NOT NULL, 
	event_version INTEGER NOT NULL, 
	payload JSONB NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	processed_at TIMESTAMP WITH TIME ZONE, 
	attempts INTEGER NOT NULL, 
	last_error TEXT, 
	PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_outbox_unprocessed ON fsm_app.fsm_monthly_targets_event_outbox (created_at) WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_failed_events (
	event_type VARCHAR(50) NOT NULL, 
	event_version INTEGER NOT NULL, 
	payload JSONB NOT NULL, 
	reason VARCHAR(500) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	resolved_at TIMESTAMP WITH TIME ZONE, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_monthly_targets_failed_events_id ON fsm_app.fsm_monthly_targets_failed_events (id);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_metric_definitions (
	metric_type fsm_app.metric_type NOT NULL, 
	source_event_type VARCHAR(50) NOT NULL, 
	counts_what TEXT NOT NULL, 
	date_field VARCHAR(50) NOT NULL, 
	dedupe_rule TEXT NOT NULL, 
	is_integer BOOLEAN NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	PRIMARY KEY (metric_type)
);


CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_org_membership_history (
	employee_id UUID NOT NULL, 
	team_id UUID NOT NULL, 
	territory_id UUID NOT NULL, 
	branch_id UUID NOT NULL, 
	effective_from TIMESTAMP WITH TIME ZONE NOT NULL, 
	effective_to TIMESTAMP WITH TIME ZONE, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_monthly_targets_org_membership_history_id ON fsm_app.fsm_monthly_targets_org_membership_history (id);
CREATE INDEX IF NOT EXISTS ix_org_membership_emp ON fsm_app.fsm_monthly_targets_org_membership_history (employee_id);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_processed_events (
	event_id UUID NOT NULL, 
	event_type VARCHAR(50) NOT NULL, 
	processed_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (event_id)
);


CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_reconciliation_runs (
	started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	finished_at TIMESTAMP WITH TIME ZONE, 
	status VARCHAR(50) NOT NULL, 
	targets_checked INTEGER NOT NULL, 
	drifts_found INTEGER NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_monthly_targets_reconciliation_runs_id ON fsm_app.fsm_monthly_targets_reconciliation_runs (id);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_targets (
	title VARCHAR(255) NOT NULL, 
	metric_type fsm_app.metric_type NOT NULL, 
	target_value NUMERIC(15, 2) NOT NULL, 
	start_date DATE NOT NULL, 
	end_date DATE NOT NULL, 
	status fsm_app.target_status NOT NULL, 
	version INTEGER NOT NULL, 
	final_value NUMERIC(15, 2), 
	closed_at TIMESTAMP WITH TIME ZONE, 
	adjusted_at TIMESTAMP WITH TIME ZONE, 
	cancel_reason VARCHAR(500), 
	idempotency_key VARCHAR(100), 
	created_by UUID NOT NULL, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_targets_metric ON fsm_app.fsm_monthly_targets_targets (metric_type);
CREATE INDEX IF NOT EXISTS ix_targets_dates ON fsm_app.fsm_monthly_targets_targets (start_date, end_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_targets_idempotency ON fsm_app.fsm_monthly_targets_targets (created_by, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_monthly_targets_targets_id ON fsm_app.fsm_monthly_targets_targets (id);
CREATE INDEX IF NOT EXISTS ix_targets_status ON fsm_app.fsm_monthly_targets_targets (status);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_rules (
	rule_code fsm_app.rule_code NOT NULL, 
	rule_name VARCHAR(255) NOT NULL, 
	description VARCHAR(500), 
	threshold_days INTEGER NOT NULL, 
	threshold_value NUMERIC(15, 2) NOT NULL, 
	medium_priority_ratio NUMERIC(5, 2) NOT NULL, 
	high_priority_ratio NUMERIC(5, 2) NOT NULL, 
	change_ratio NUMERIC(5, 2) NOT NULL, 
	cooldown_days INTEGER NOT NULL, 
	dismiss_days INTEGER NOT NULL, 
	autoclear_scans INTEGER NOT NULL, 
	escalation_days INTEGER NOT NULL, 
	min_history_months INTEGER NOT NULL, 
	params JSONB NOT NULL, 
	required_sources VARCHAR[] NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (rule_code)
);

CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_revenue_leakage_rules_id ON fsm_app.fsm_revenue_leakage_rules (id);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_scan_runs (
	rule_code fsm_app.rule_code NOT NULL, 
	mode fsm_app.scan_mode NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	heartbeat_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	finished_at TIMESTAMP WITH TIME ZONE, 
	status fsm_app.scan_status NOT NULL, 
	rows_evaluated INTEGER NOT NULL, 
	alerts_created INTEGER NOT NULL, 
	alerts_updated INTEGER NOT NULL, 
	alerts_cleared INTEGER NOT NULL, 
	skipped_not_synced INTEGER NOT NULL, 
	attempt INTEGER NOT NULL, 
	error_message VARCHAR(1000), 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_revenue_leakage_scan_runs_id ON fsm_app.fsm_revenue_leakage_scan_runs (id);
CREATE INDEX IF NOT EXISTS ix_scan_runs_rule_started ON fsm_app.fsm_revenue_leakage_scan_runs (rule_code, started_at);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_source_availability (
	source_key VARCHAR(50) NOT NULL, 
	is_available BOOLEAN NOT NULL, 
	checked_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	note VARCHAR(500), 
	PRIMARY KEY (source_key)
);


CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_user_sync_state (
	user_id UUID NOT NULL, 
	last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (user_id)
);


CREATE TABLE IF NOT EXISTS fsm_app.holidays (
	holiday_date DATE NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	region VARCHAR(50), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (holiday_date)
);


CREATE TABLE IF NOT EXISTS fsm_customers (
	name VARCHAR(200) NOT NULL, 
	customer_type VARCHAR(50) NOT NULL, 
	contact_person VARCHAR(150), 
	phone VARCHAR(20), 
	location_city VARCHAR(100), 
	location_area VARCHAR(150), 
	territory VARCHAR(150), 
	latitude FLOAT, 
	longitude FLOAT, 
	is_active BOOLEAN NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_fsm_customers_location_city ON fsm_customers (location_city);
CREATE INDEX IF NOT EXISTS ix_fsm_customers_customer_type ON fsm_customers (customer_type);
CREATE INDEX IF NOT EXISTS ix_fsm_customers_territory ON fsm_customers (territory);
CREATE INDEX IF NOT EXISTS ix_fsm_customers_name ON fsm_customers (name);
CREATE INDEX IF NOT EXISTS ix_fsm_customers_id ON fsm_customers (id);
CREATE INDEX IF NOT EXISTS ix_fsm_customers_is_active ON fsm_customers (is_active);

CREATE TABLE IF NOT EXISTS lead_customers (
	name VARCHAR(200) NOT NULL, 
	customer_type VARCHAR(50) NOT NULL, 
	phone VARCHAR(20), 
	location_city VARCHAR(100), 
	location_area VARCHAR(150), 
	territory VARCHAR(150), 
	is_active BOOLEAN NOT NULL, 
	metadata_json JSONB, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_lead_customers_id ON lead_customers (id);
CREATE INDEX IF NOT EXISTS ix_lead_customers_location_city ON lead_customers (location_city);
CREATE INDEX IF NOT EXISTS ix_lead_customers_customer_type ON lead_customers (customer_type);
CREATE INDEX IF NOT EXISTS ix_lead_customers_active_type ON lead_customers (is_active, customer_type);
CREATE INDEX IF NOT EXISTS ix_lead_customers_name ON lead_customers (name);
CREATE INDEX IF NOT EXISTS ix_lead_customers_territory ON lead_customers (territory);
CREATE INDEX IF NOT EXISTS ix_lead_customers_is_active ON lead_customers (is_active);

CREATE TABLE IF NOT EXISTS office_locations (
	name VARCHAR(150) NOT NULL, 
	address VARCHAR(255), 
	latitude FLOAT NOT NULL, 
	longitude FLOAT NOT NULL, 
	radius_meters INTEGER NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	coordinates geometry(POINT,4326), 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_office_locations_coordinates ON office_locations USING gist (coordinates);
CREATE INDEX IF NOT EXISTS ix_office_locations_id ON office_locations (id);

CREATE TABLE IF NOT EXISTS system_config (
	id INTEGER NOT NULL, 
	features JSONB NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS analytics_daily_summary (
	summary_date DATE NOT NULL, 
	zone VARCHAR(100) NOT NULL, 
	employee_id UUID, 
	completed_calls INTEGER NOT NULL, 
	total_target_calls INTEGER NOT NULL, 
	strike_rate FLOAT NOT NULL, 
	expense_burn NUMERIC(12, 2) NOT NULL, 
	pipeline_value NUMERIC(14, 2) NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_analytics_summary_date_zone_emp UNIQUE (summary_date, zone, employee_id), 
	FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_analytics_daily_summary_zone ON analytics_daily_summary (zone);
CREATE INDEX IF NOT EXISTS ix_analytics_daily_summary_employee_id ON analytics_daily_summary (employee_id);
CREATE INDEX IF NOT EXISTS ix_analytics_daily_summary_summary_date ON analytics_daily_summary (summary_date);
CREATE INDEX IF NOT EXISTS idx_analytics_date_zone ON analytics_daily_summary (summary_date, zone);
CREATE INDEX IF NOT EXISTS ix_analytics_daily_summary_id ON analytics_daily_summary (id);

CREATE TABLE IF NOT EXISTS attendance (
	employee_id UUID NOT NULL, 
	work_date DATE NOT NULL, 
	punch_in_time TIMESTAMP WITH TIME ZONE, 
	punch_out_time TIMESTAMP WITH TIME ZONE, 
	punch_in_lat FLOAT, 
	punch_in_lon FLOAT, 
	punch_out_lat FLOAT, 
	punch_out_lon FLOAT, 
	punch_in_proof TEXT, 
	punch_out_summary TEXT, 
	status VARCHAR(50) NOT NULL, 
	verification_status VARCHAR(50) NOT NULL, 
	working_minutes INTEGER NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_attendance_id ON attendance (id);
CREATE INDEX IF NOT EXISTS ix_attendance_employee_id ON attendance (employee_id);
CREATE INDEX IF NOT EXISTS ix_attendance_work_date ON attendance (work_date);
CREATE UNIQUE INDEX IF NOT EXISTS ix_attendance_emp_date ON attendance (employee_id, work_date);

CREATE TABLE IF NOT EXISTS field_sessions (
	employee_id UUID NOT NULL, 
	start_time TIMESTAMP WITH TIME ZONE NOT NULL, 
	end_time TIMESTAMP WITH TIME ZONE, 
	start_lat FLOAT NOT NULL, 
	start_lon FLOAT NOT NULL, 
	end_lat FLOAT, 
	end_lon FLOAT, 
	accumulated_distance_km FLOAT NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_field_sessions_employee_id ON field_sessions (employee_id);
CREATE INDEX IF NOT EXISTS ix_field_sessions_id ON field_sessions (id);
CREATE INDEX IF NOT EXISTS ix_field_sessions_emp_active ON field_sessions (employee_id, status);
CREATE INDEX IF NOT EXISTS ix_field_sessions_status ON field_sessions (status);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_assignments (
	target_id UUID NOT NULL, 
	entity_type fsm_app.entity_type NOT NULL, 
	entity_id UUID NOT NULL, 
	assigned_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	ended_at TIMESTAMP WITH TIME ZONE, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_target_assignment UNIQUE (target_id, entity_type, entity_id), 
	FOREIGN KEY(target_id) REFERENCES fsm_app.fsm_monthly_targets_targets (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_monthly_targets_assignments_id ON fsm_app.fsm_monthly_targets_assignments (id);
CREATE INDEX IF NOT EXISTS ix_target_assignments_entity ON fsm_app.fsm_monthly_targets_assignments (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_target_assignments_target ON fsm_app.fsm_monthly_targets_assignments (target_id);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_changes (
	target_id UUID NOT NULL, 
	version INTEGER NOT NULL, 
	field VARCHAR(50) NOT NULL, 
	old_value TEXT, 
	new_value TEXT, 
	reason VARCHAR(500) NOT NULL, 
	changed_by UUID NOT NULL, 
	changed_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(target_id) REFERENCES fsm_app.fsm_monthly_targets_targets (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_monthly_targets_changes_id ON fsm_app.fsm_monthly_targets_changes (id);
CREATE INDEX IF NOT EXISTS ix_target_changes_target_version ON fsm_app.fsm_monthly_targets_changes (target_id, version);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_alert_chains (
	rule_id UUID NOT NULL, 
	entity_type VARCHAR(50) NOT NULL, 
	entity_id UUID NOT NULL, 
	last_alert_id UUID NOT NULL, 
	last_occurrence_no INTEGER NOT NULL, 
	last_closed_at TIMESTAMP WITH TIME ZONE, 
	suppressed_until TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (rule_id, entity_type, entity_id), 
	FOREIGN KEY(rule_id) REFERENCES fsm_app.fsm_revenue_leakage_rules (id) ON DELETE RESTRICT
);


CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_alerts (
	rule_id UUID NOT NULL, 
	entity_type VARCHAR(50) NOT NULL, 
	entity_id UUID NOT NULL, 
	classification fsm_app.classification NOT NULL, 
	attention_priority fsm_app.attention_priority NOT NULL, 
	priority_reason VARCHAR(500) NOT NULL, 
	observation JSONB NOT NULL, 
	exposure_amount NUMERIC(15, 2), 
	exposure_basis VARCHAR(500), 
	status fsm_app.alert_status NOT NULL, 
	version INTEGER NOT NULL, 
	occurrence_no INTEGER NOT NULL, 
	previous_alert_id UUID, 
	first_detected_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	last_observed_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	last_notified_at TIMESTAMP WITH TIME ZONE, 
	clear_streak INTEGER NOT NULL, 
	suppressed_until TIMESTAMP WITH TIME ZONE, 
	escalation_level INTEGER NOT NULL, 
	escalated_at TIMESTAMP WITH TIME ZONE, 
	resolved_at TIMESTAMP WITH TIME ZONE, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(rule_id) REFERENCES fsm_app.fsm_revenue_leakage_rules (id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_leakage_alert ON fsm_app.fsm_revenue_leakage_alerts (rule_id, entity_type, entity_id) WHERE status IN ('active', 'acknowledged');
CREATE INDEX IF NOT EXISTS ix_leakage_alerts_status_prio ON fsm_app.fsm_revenue_leakage_alerts (status, attention_priority);
CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_revenue_leakage_alerts_id ON fsm_app.fsm_revenue_leakage_alerts (id);
CREATE INDEX IF NOT EXISTS ix_leakage_alerts_previous ON fsm_app.fsm_revenue_leakage_alerts (previous_alert_id);
CREATE INDEX IF NOT EXISTS ix_leakage_alerts_entity ON fsm_app.fsm_revenue_leakage_alerts (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_rule_changes (
	rule_id UUID NOT NULL, 
	field VARCHAR(50) NOT NULL, 
	old_value TEXT, 
	new_value TEXT, 
	reason VARCHAR(500) NOT NULL, 
	changed_by UUID NOT NULL, 
	changed_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(rule_id) REFERENCES fsm_app.fsm_revenue_leakage_rules (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_revenue_leakage_rule_changes_id ON fsm_app.fsm_revenue_leakage_rule_changes (id);
CREATE INDEX IF NOT EXISTS ix_rule_changes_rule_time ON fsm_app.fsm_revenue_leakage_rule_changes (rule_id, changed_at);

CREATE TABLE IF NOT EXISTS fsm_daily_sales_plans (
	employee_id UUID NOT NULL, 
	plan_date DATE NOT NULL, 
	version INTEGER NOT NULL, 
	revision_type VARCHAR(50) NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	total_planned_stops INTEGER NOT NULL, 
	total_planned_distance_meters FLOAT NOT NULL, 
	total_planned_duration_seconds INTEGER NOT NULL, 
	routing_engine VARCHAR(50) NOT NULL, 
	idempotency_key UUID NOT NULL, 
	approved_by_id UUID, 
	approved_at TIMESTAMP WITH TIME ZONE, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_plan_emp_date_version UNIQUE (employee_id, plan_date, version), 
	FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE, 
	UNIQUE (idempotency_key), 
	FOREIGN KEY(approved_by_id) REFERENCES employees (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plans_employee_id ON fsm_daily_sales_plans (employee_id);
CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plans_id ON fsm_daily_sales_plans (id);
CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plans_status ON fsm_daily_sales_plans (status);
CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plans_plan_date ON fsm_daily_sales_plans (plan_date);
CREATE INDEX IF NOT EXISTS ix_plans_emp_date_status ON fsm_daily_sales_plans (employee_id, plan_date, status);

CREATE TABLE IF NOT EXISTS fsm_monthly_targets (
	employee_id UUID NOT NULL, 
	target_month DATE NOT NULL, 
	target_revenue FLOAT NOT NULL, 
	achieved_revenue FLOAT NOT NULL, 
	target_visits INTEGER NOT NULL, 
	achieved_visits INTEGER NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_monthly_targets_emp_month ON fsm_monthly_targets (employee_id, target_month);
CREATE INDEX IF NOT EXISTS ix_fsm_monthly_targets_target_month ON fsm_monthly_targets (target_month);
CREATE INDEX IF NOT EXISTS ix_fsm_monthly_targets_id ON fsm_monthly_targets (id);
CREATE INDEX IF NOT EXISTS ix_fsm_monthly_targets_employee_id ON fsm_monthly_targets (employee_id);

CREATE TABLE IF NOT EXISTS leave_balances (
	employee_id UUID NOT NULL, 
	leave_type VARCHAR(50) NOT NULL, 
	year INTEGER NOT NULL, 
	allocated_days FLOAT NOT NULL, 
	used_days FLOAT NOT NULL, 
	remaining_days FLOAT NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_leave_balance_emp_type_year ON leave_balances (employee_id, leave_type, year);
CREATE INDEX IF NOT EXISTS ix_leave_balances_employee_id ON leave_balances (employee_id);
CREATE INDEX IF NOT EXISTS ix_leave_balances_id ON leave_balances (id);
CREATE INDEX IF NOT EXISTS ix_leave_balances_year ON leave_balances (year);

CREATE TABLE IF NOT EXISTS leave_requests (
	employee_id UUID NOT NULL, 
	leave_type VARCHAR(50) NOT NULL, 
	start_date DATE NOT NULL, 
	end_date DATE NOT NULL, 
	days_count FLOAT NOT NULL, 
	reason TEXT NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	approved_by_id UUID, 
	approved_at TIMESTAMP WITH TIME ZONE, 
	rejection_reason TEXT, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE, 
	FOREIGN KEY(approved_by_id) REFERENCES employees (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_leave_requests_employee_id ON leave_requests (employee_id);
CREATE INDEX IF NOT EXISTS ix_leave_requests_status ON leave_requests (status);
CREATE INDEX IF NOT EXISTS ix_leave_requests_emp_status ON leave_requests (employee_id, status);
CREATE INDEX IF NOT EXISTS ix_leave_requests_id ON leave_requests (id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
	employee_id UUID NOT NULL, 
	token_hash VARCHAR(255) NOT NULL, 
	device_fingerprint VARCHAR(255), 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	is_revoked BOOLEAN NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_refresh_tokens_expires_at ON refresh_tokens (expires_at);
CREATE INDEX IF NOT EXISTS ix_tokens_emp_valid ON refresh_tokens (employee_id, is_revoked, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS ix_refresh_tokens_token_hash ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_employee_id ON refresh_tokens (employee_id);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_is_revoked ON refresh_tokens (is_revoked);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_id ON refresh_tokens (id);

CREATE TABLE IF NOT EXISTS tasks (
	creator_id UUID NOT NULL, 
	assignee_id UUID NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	description TEXT, 
	due_date TIMESTAMP WITH TIME ZONE, 
	priority VARCHAR(50) NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(creator_id) REFERENCES employees (id) ON DELETE CASCADE, 
	FOREIGN KEY(assignee_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_tasks_assignee_status ON tasks (assignee_id, status);
CREATE INDEX IF NOT EXISTS ix_tasks_id ON tasks (id);
CREATE INDEX IF NOT EXISTS ix_tasks_assignee_id ON tasks (assignee_id);
CREATE INDEX IF NOT EXISTS ix_tasks_creator_id ON tasks (creator_id);
CREATE INDEX IF NOT EXISTS ix_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS ix_tasks_due_date ON tasks (due_date);

CREATE TABLE IF NOT EXISTS breaks (
	attendance_id UUID NOT NULL, 
	employee_id UUID NOT NULL, 
	start_time TIMESTAMP WITH TIME ZONE NOT NULL, 
	end_time TIMESTAMP WITH TIME ZONE, 
	reason VARCHAR(255), 
	duration_minutes INTEGER NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(attendance_id) REFERENCES attendance (id) ON DELETE CASCADE, 
	FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_breaks_id ON breaks (id);
CREATE INDEX IF NOT EXISTS ix_breaks_employee_id ON breaks (employee_id);
CREATE INDEX IF NOT EXISTS ix_breaks_attendance_id ON breaks (attendance_id);
CREATE INDEX IF NOT EXISTS ix_breaks_active ON breaks (employee_id, end_time);

CREATE TABLE IF NOT EXISTS expenses (
	employee_id UUID NOT NULL, 
	field_session_id UUID, 
	category VARCHAR(50) NOT NULL, 
	amount FLOAT NOT NULL, 
	claim_date DATE NOT NULL, 
	receipt_url TEXT, 
	description TEXT, 
	is_split_bill BOOLEAN NOT NULL, 
	split_with_employee_id UUID, 
	receipt_invoice_number VARCHAR(100), 
	total_receipt_amount FLOAT, 
	image_sha256 VARCHAR(64), 
	validation_status VARCHAR(50) NOT NULL, 
	validation_flags JSON NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	reviewed_by UUID, 
	reviewed_at TIMESTAMP WITH TIME ZONE, 
	review_note TEXT, 
	reimbursed_at TIMESTAMP WITH TIME ZONE, 
	manager_reviewed_by UUID, 
	manager_reviewed_at TIMESTAMP WITH TIME ZONE, 
	manager_review_note TEXT, 
	zsm_reviewed_by UUID, 
	zsm_reviewed_at TIMESTAMP WITH TIME ZONE, 
	zsm_review_note TEXT, 
	finance_reviewed_by UUID, 
	finance_reviewed_at TIMESTAMP WITH TIME ZONE, 
	finance_review_note TEXT, 
	payment_reference VARCHAR(100), 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE, 
	FOREIGN KEY(field_session_id) REFERENCES field_sessions (id) ON DELETE SET NULL, 
	FOREIGN KEY(split_with_employee_id) REFERENCES employees (id) ON DELETE SET NULL, 
	FOREIGN KEY(reviewed_by) REFERENCES employees (id) ON DELETE SET NULL, 
	FOREIGN KEY(manager_reviewed_by) REFERENCES employees (id) ON DELETE SET NULL, 
	FOREIGN KEY(zsm_reviewed_by) REFERENCES employees (id) ON DELETE SET NULL, 
	FOREIGN KEY(finance_reviewed_by) REFERENCES employees (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_expenses_field_session_id ON expenses (field_session_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses (status);
CREATE INDEX IF NOT EXISTS idx_expenses_invoice ON expenses (receipt_invoice_number, claim_date);
CREATE INDEX IF NOT EXISTS idx_expenses_sha ON expenses (image_sha256);
CREATE INDEX IF NOT EXISTS ix_expenses_id ON expenses (id);
CREATE INDEX IF NOT EXISTS ix_expenses_employee_id ON expenses (employee_id);
CREATE INDEX IF NOT EXISTS idx_expenses_emp_date ON expenses (employee_id, claim_date);
CREATE INDEX IF NOT EXISTS ix_expenses_status ON expenses (status);

CREATE TABLE IF NOT EXISTS field_visits (
	session_id UUID, 
	employee_id UUID NOT NULL, 
	target_type VARCHAR(50) NOT NULL, 
	target_name VARCHAR(200) NOT NULL, 
	target_identifier VARCHAR(100), 
	visit_date DATE NOT NULL, 
	arrival_time TIMESTAMP WITH TIME ZONE, 
	completion_time TIMESTAMP WITH TIME ZONE, 
	latitude FLOAT, 
	longitude FLOAT, 
	proof_photo TEXT, 
	discussion_notes TEXT, 
	status VARCHAR(50) NOT NULL, 
	custom_fields JSONB, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(session_id) REFERENCES field_sessions (id) ON DELETE SET NULL, 
	FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_field_visits_employee_id ON field_visits (employee_id);
CREATE INDEX IF NOT EXISTS ix_field_visits_id ON field_visits (id);
CREATE INDEX IF NOT EXISTS ix_field_visits_target_type ON field_visits (target_type);
CREATE INDEX IF NOT EXISTS ix_field_visits_session_id ON field_visits (session_id);
CREATE INDEX IF NOT EXISTS ix_field_visits_status ON field_visits (status);
CREATE INDEX IF NOT EXISTS ix_field_visits_visit_date ON field_visits (visit_date);
CREATE INDEX IF NOT EXISTS ix_visits_emp_date ON field_visits (employee_id, visit_date);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_archived_totals (
	assignment_id UUID NOT NULL, 
	entry_count INTEGER NOT NULL, 
	entry_sum NUMERIC(15, 2) NOT NULL, 
	archived_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (assignment_id), 
	FOREIGN KEY(assignment_id) REFERENCES fsm_app.fsm_monthly_targets_assignments (id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_progress (
	assignment_id UUID NOT NULL, 
	current_value NUMERIC(15, 2) NOT NULL, 
	last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (assignment_id), 
	FOREIGN KEY(assignment_id) REFERENCES fsm_app.fsm_monthly_targets_assignments (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_monthly_targets_progress_id ON fsm_app.fsm_monthly_targets_progress (id);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_progress_entries (
	assignment_id UUID NOT NULL, 
	source_event_id UUID NOT NULL, 
	source_event_type VARCHAR(50) NOT NULL, 
	entry_type fsm_app.entry_type NOT NULL, 
	delta NUMERIC(15, 2) NOT NULL, 
	contributor_id UUID NOT NULL, 
	occurred_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	business_date DATE NOT NULL, 
	excluded BOOLEAN NOT NULL, 
	excluded_reason VARCHAR(100), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_progress_entry UNIQUE (assignment_id, source_event_id, entry_type), 
	FOREIGN KEY(assignment_id) REFERENCES fsm_app.fsm_monthly_targets_assignments (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_monthly_targets_progress_entries_id ON fsm_app.fsm_monthly_targets_progress_entries (id);
CREATE INDEX IF NOT EXISTS ix_progress_entries_source_event ON fsm_app.fsm_monthly_targets_progress_entries (source_event_id);
CREATE INDEX IF NOT EXISTS ix_progress_entries_assignment_date ON fsm_app.fsm_monthly_targets_progress_entries (assignment_id, business_date);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_reconciliation_drifts (
	run_id UUID NOT NULL, 
	assignment_id UUID NOT NULL, 
	stored_value NUMERIC(15, 2) NOT NULL, 
	recomputed_value NUMERIC(15, 2) NOT NULL, 
	source_value NUMERIC(15, 2), 
	kind VARCHAR(50) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(run_id) REFERENCES fsm_app.fsm_monthly_targets_reconciliation_runs (id) ON DELETE CASCADE, 
	FOREIGN KEY(assignment_id) REFERENCES fsm_app.fsm_monthly_targets_assignments (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_monthly_targets_reconciliation_drifts_id ON fsm_app.fsm_monthly_targets_reconciliation_drifts (id);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_alert_actions (
	alert_id UUID NOT NULL, 
	action_type fsm_app.action_type NOT NULL, 
	outcome fsm_app.outcome, 
	action_taken VARCHAR(255) NOT NULL, 
	evidence_reference VARCHAR(255), 
	notes VARCHAR(1000), 
	action_by UUID NOT NULL, 
	idempotency_key VARCHAR(100), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(alert_id) REFERENCES fsm_app.fsm_revenue_leakage_alerts (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_alert_actions_alert_created ON fsm_app.fsm_revenue_leakage_alert_actions (alert_id, created_at);
CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_revenue_leakage_alert_actions_id ON fsm_app.fsm_revenue_leakage_alert_actions (id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_action_idemp ON fsm_app.fsm_revenue_leakage_alert_actions (alert_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_alert_notifications (
	alert_id UUID NOT NULL, 
	recipient_id UUID NOT NULL, 
	kind fsm_app.notification_kind NOT NULL, 
	attention_priority fsm_app.attention_priority NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	digest_date DATE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	sent_at TIMESTAMP WITH TIME ZONE, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_alert_notification UNIQUE (alert_id, recipient_id, kind, attention_priority), 
	FOREIGN KEY(alert_id) REFERENCES fsm_app.fsm_revenue_leakage_alerts (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_alert_notifications_pending ON fsm_app.fsm_revenue_leakage_alert_notifications (status, created_at);
CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_revenue_leakage_alert_notifications_id ON fsm_app.fsm_revenue_leakage_alert_notifications (id);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_alert_observations (
	alert_id UUID NOT NULL, 
	observed_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	observation JSONB NOT NULL, 
	attention_priority fsm_app.attention_priority NOT NULL, 
	reason fsm_app.observation_reason NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(alert_id) REFERENCES fsm_app.fsm_revenue_leakage_alerts (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_alert_obs_alert_time ON fsm_app.fsm_revenue_leakage_alert_observations (alert_id, observed_at);
CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_revenue_leakage_alert_observations_id ON fsm_app.fsm_revenue_leakage_alert_observations (id);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_alert_views (
	alert_id UUID NOT NULL, 
	viewer_id UUID NOT NULL, 
	action VARCHAR(20) NOT NULL, 
	viewed_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(alert_id) REFERENCES fsm_app.fsm_revenue_leakage_alerts (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_alert_views_alert ON fsm_app.fsm_revenue_leakage_alert_views (alert_id, viewed_at);
CREATE INDEX IF NOT EXISTS ix_fsm_app_fsm_revenue_leakage_alert_views_id ON fsm_app.fsm_revenue_leakage_alert_views (id);

CREATE TABLE IF NOT EXISTS fsm_daily_sales_plan_revisions (
	plan_id UUID NOT NULL, 
	version INTEGER NOT NULL, 
	revision_type VARCHAR(50) NOT NULL, 
	plan_snapshot JSONB NOT NULL, 
	created_by_id UUID NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(plan_id) REFERENCES fsm_daily_sales_plans (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by_id) REFERENCES employees (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plan_revisions_plan_id ON fsm_daily_sales_plan_revisions (plan_id);
CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plan_revisions_id ON fsm_daily_sales_plan_revisions (id);

CREATE TABLE IF NOT EXISTS fsm_leads (
	employee_id UUID NOT NULL, 
	created_by_id UUID NOT NULL, 
	customer_id UUID, 
	customer_name VARCHAR(200), 
	customer_type VARCHAR(50) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	opportunity_type VARCHAR(80) NOT NULL, 
	interested_product_service VARCHAR(200), 
	customer_response VARCHAR(200), 
	lead_source VARCHAR(80) NOT NULL, 
	stage VARCHAR(50) NOT NULL, 
	priority VARCHAR(20) NOT NULL, 
	expected_value FLOAT, 
	actual_converted_value FLOAT, 
	expected_close_date DATE, 
	location_city VARCHAR(100), 
	contact_person VARCHAR(150), 
	contact_phone VARCHAR(20), 
	latitude FLOAT, 
	longitude FLOAT, 
	notes TEXT, 
	last_interaction_date TIMESTAMP WITH TIME ZONE, 
	conversion_outcome TEXT, 
	loss_reason TEXT, 
	closed_at TIMESTAMP WITH TIME ZONE, 
	field_visit_id UUID, 
	is_archived BOOLEAN NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT chk_fsm_lead_stage CHECK (stage IN ('NEW', 'CONTACTED', 'INTERESTED', 'QUALIFIED', 'CONVERTED', 'LOST')), 
	CONSTRAINT chk_fsm_lead_priority CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')), 
	FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE RESTRICT, 
	FOREIGN KEY(created_by_id) REFERENCES employees (id) ON DELETE RESTRICT, 
	FOREIGN KEY(customer_id) REFERENCES fsm_customers (id) ON DELETE SET NULL, 
	FOREIGN KEY(field_visit_id) REFERENCES field_visits (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_fsm_leads_id ON fsm_leads (id);
CREATE INDEX IF NOT EXISTS ix_fsm_leads_stage ON fsm_leads (stage);
CREATE INDEX IF NOT EXISTS ix_fsm_leads_emp_stage ON fsm_leads (employee_id, stage);
CREATE INDEX IF NOT EXISTS ix_fsm_leads_customer_id ON fsm_leads (customer_id);
CREATE INDEX IF NOT EXISTS ix_fsm_leads_is_archived ON fsm_leads (is_archived);
CREATE INDEX IF NOT EXISTS ix_fsm_leads_employee_id ON fsm_leads (employee_id);
CREATE INDEX IF NOT EXISTS ix_fsm_leads_priority ON fsm_leads (priority);

CREATE TABLE IF NOT EXISTS leads (
	employee_id UUID NOT NULL, 
	created_by_id UUID NOT NULL, 
	lead_customer_id UUID, 
	customer_name VARCHAR(200), 
	customer_type VARCHAR(50) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	lead_type VARCHAR(80) NOT NULL, 
	interested_product_service VARCHAR(200), 
	customer_response VARCHAR(200), 
	lead_source VARCHAR(80) NOT NULL, 
	stage VARCHAR(50) NOT NULL, 
	priority VARCHAR(20) NOT NULL, 
	expected_value FLOAT, 
	expected_close_date DATE, 
	location_city VARCHAR(100), 
	contact_person VARCHAR(150), 
	contact_phone VARCHAR(20), 
	notes TEXT, 
	last_interaction_date TIMESTAMP WITH TIME ZONE, 
	actual_converted_value FLOAT, 
	conversion_outcome TEXT, 
	loss_reason TEXT, 
	closed_at TIMESTAMP WITH TIME ZONE, 
	field_visit_id UUID, 
	is_archived BOOLEAN NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by_id) REFERENCES employees (id) ON DELETE CASCADE, 
	FOREIGN KEY(lead_customer_id) REFERENCES lead_customers (id) ON DELETE SET NULL, 
	FOREIGN KEY(field_visit_id) REFERENCES field_visits (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_leads_employee_id ON leads (employee_id);
CREATE INDEX IF NOT EXISTS ix_leads_emp_stage ON leads (employee_id, stage);
CREATE INDEX IF NOT EXISTS ix_leads_stage ON leads (stage);
CREATE INDEX IF NOT EXISTS ix_leads_created_by_id ON leads (created_by_id);
CREATE INDEX IF NOT EXISTS ix_leads_id ON leads (id);
CREATE INDEX IF NOT EXISTS ix_leads_stage_priority ON leads (stage, priority);
CREATE INDEX IF NOT EXISTS ix_leads_lead_customer_id ON leads (lead_customer_id);
CREATE INDEX IF NOT EXISTS ix_leads_field_visit_id ON leads (field_visit_id);
CREATE INDEX IF NOT EXISTS ix_leads_is_archived ON leads (is_archived);
CREATE INDEX IF NOT EXISTS ix_leads_priority ON leads (priority);

CREATE TABLE IF NOT EXISTS followups (
	employee_id UUID NOT NULL, 
	created_by_id UUID NOT NULL, 
	lead_id UUID, 
	lead_customer_id UUID, 
	field_visit_id UUID, 
	customer_name VARCHAR(200), 
	action_type VARCHAR(80) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	due_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	priority VARCHAR(20) NOT NULL, 
	notes TEXT, 
	status VARCHAR(30) NOT NULL, 
	outcome TEXT, 
	cancel_reason TEXT, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	is_archived BOOLEAN NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT chk_followup_has_context CHECK (lead_id IS NOT NULL OR lead_customer_id IS NOT NULL OR field_visit_id IS NOT NULL), 
	FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by_id) REFERENCES employees (id) ON DELETE CASCADE, 
	FOREIGN KEY(lead_id) REFERENCES leads (id) ON DELETE SET NULL, 
	FOREIGN KEY(lead_customer_id) REFERENCES lead_customers (id) ON DELETE SET NULL, 
	FOREIGN KEY(field_visit_id) REFERENCES field_visits (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_followups_employee_id ON followups (employee_id);
CREATE INDEX IF NOT EXISTS ix_followups_created_by_id ON followups (created_by_id);
CREATE INDEX IF NOT EXISTS ix_followups_status ON followups (status);
CREATE INDEX IF NOT EXISTS ix_followups_lead_customer_id ON followups (lead_customer_id);
CREATE INDEX IF NOT EXISTS ix_followups_priority ON followups (priority);
CREATE INDEX IF NOT EXISTS ix_followups_emp_status_due ON followups (employee_id, status, due_at);
CREATE INDEX IF NOT EXISTS ix_followups_due_at ON followups (due_at);
CREATE INDEX IF NOT EXISTS ix_followups_id ON followups (id);
CREATE INDEX IF NOT EXISTS ix_followups_lead_id ON followups (lead_id);
CREATE INDEX IF NOT EXISTS ix_followups_field_visit_id ON followups (field_visit_id);
CREATE INDEX IF NOT EXISTS ix_followups_is_archived ON followups (is_archived);

CREATE TABLE IF NOT EXISTS fsm_daily_sales_plan_items (
	plan_id UUID NOT NULL, 
	sequence_order INTEGER NOT NULL, 
	activity_type VARCHAR(50) NOT NULL, 
	planned_arrival_time TIME WITHOUT TIME ZONE, 
	planned_departure_time TIME WITHOUT TIME ZONE, 
	estimated_duration_minutes INTEGER NOT NULL, 
	lead_id UUID, 
	customer_id UUID, 
	latitude FLOAT, 
	longitude FLOAT, 
	location_address TEXT, 
	stop_type VARCHAR(50) NOT NULL, 
	recommendation_score FLOAT, 
	recommendation_reasons JSONB, 
	status VARCHAR(50) NOT NULL, 
	field_visit_id UUID, 
	transit_distance_m FLOAT NOT NULL, 
	transit_duration_s INTEGER NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_item_plan_sequence UNIQUE (plan_id, sequence_order), 
	FOREIGN KEY(plan_id) REFERENCES fsm_daily_sales_plans (id) ON DELETE CASCADE, 
	FOREIGN KEY(lead_id) REFERENCES fsm_leads (id) ON DELETE SET NULL, 
	FOREIGN KEY(customer_id) REFERENCES fsm_customers (id) ON DELETE SET NULL, 
	FOREIGN KEY(field_visit_id) REFERENCES field_visits (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plan_items_customer_id ON fsm_daily_sales_plan_items (customer_id);
CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plan_items_id ON fsm_daily_sales_plan_items (id);
CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plan_items_field_visit_id ON fsm_daily_sales_plan_items (field_visit_id);
CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plan_items_plan_id ON fsm_daily_sales_plan_items (plan_id);
CREATE INDEX IF NOT EXISTS ix_plan_items_lead_status ON fsm_daily_sales_plan_items (lead_id, status);
CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plan_items_status ON fsm_daily_sales_plan_items (status);
CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plan_items_lead_id ON fsm_daily_sales_plan_items (lead_id);

CREATE TABLE IF NOT EXISTS fsm_followups (
	employee_id UUID NOT NULL, 
	created_by_id UUID NOT NULL, 
	lead_id UUID, 
	customer_id UUID, 
	field_visit_id UUID, 
	customer_name VARCHAR(200), 
	action_type VARCHAR(80) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	due_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	priority VARCHAR(20) NOT NULL, 
	notes TEXT, 
	status VARCHAR(30) NOT NULL, 
	outcome TEXT, 
	cancel_reason TEXT, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	is_archived BOOLEAN NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT chk_fsm_followup_priority CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')), 
	CONSTRAINT chk_fsm_followup_status CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')), 
	CONSTRAINT chk_fsm_followup_anchor CHECK (lead_id IS NOT NULL OR customer_id IS NOT NULL OR field_visit_id IS NOT NULL), 
	FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by_id) REFERENCES employees (id) ON DELETE RESTRICT, 
	FOREIGN KEY(lead_id) REFERENCES fsm_leads (id) ON DELETE SET NULL, 
	FOREIGN KEY(customer_id) REFERENCES fsm_customers (id) ON DELETE SET NULL, 
	FOREIGN KEY(field_visit_id) REFERENCES field_visits (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_fsm_followups_due_at ON fsm_followups (due_at);
CREATE INDEX IF NOT EXISTS ix_fsm_followups_action_type ON fsm_followups (action_type);
CREATE INDEX IF NOT EXISTS ix_fsm_followups_id ON fsm_followups (id);
CREATE INDEX IF NOT EXISTS ix_fsm_followups_is_archived ON fsm_followups (is_archived);
CREATE INDEX IF NOT EXISTS ix_fsm_followups_lead_id ON fsm_followups (lead_id);
CREATE INDEX IF NOT EXISTS ix_fsm_followups_customer_id ON fsm_followups (customer_id);
CREATE INDEX IF NOT EXISTS ix_fsm_followups_emp_status_due ON fsm_followups (employee_id, status, due_at);
CREATE INDEX IF NOT EXISTS ix_fsm_followups_employee_id ON fsm_followups (employee_id);
CREATE INDEX IF NOT EXISTS ix_fsm_followups_status ON fsm_followups (status);

CREATE TABLE IF NOT EXISTS lead_history (
	lead_id UUID NOT NULL, 
	actor_id UUID NOT NULL, 
	event_type VARCHAR(80) NOT NULL, 
	field_name VARCHAR(80), 
	old_value TEXT, 
	new_value TEXT, 
	notes TEXT, 
	occurred_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(lead_id) REFERENCES leads (id) ON DELETE CASCADE, 
	FOREIGN KEY(actor_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_lead_history_id ON lead_history (id);
CREATE INDEX IF NOT EXISTS ix_lead_history_lead_time ON lead_history (lead_id, occurred_at);
CREATE INDEX IF NOT EXISTS ix_lead_history_lead_id ON lead_history (lead_id);
CREATE INDEX IF NOT EXISTS ix_lead_history_actor_id ON lead_history (actor_id);
CREATE INDEX IF NOT EXISTS ix_lead_history_occurred_at ON lead_history (occurred_at);

CREATE TABLE IF NOT EXISTS followup_history (
	followup_id UUID NOT NULL, 
	actor_id UUID NOT NULL, 
	event_type VARCHAR(80) NOT NULL, 
	old_value TEXT, 
	new_value TEXT, 
	notes TEXT, 
	occurred_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(followup_id) REFERENCES followups (id) ON DELETE CASCADE, 
	FOREIGN KEY(actor_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_followup_history_followup_id ON followup_history (followup_id);
CREATE INDEX IF NOT EXISTS ix_followup_history_id ON followup_history (id);
CREATE INDEX IF NOT EXISTS ix_followup_history_actor_id ON followup_history (actor_id);
CREATE INDEX IF NOT EXISTS ix_followup_history_occurred_at ON followup_history (occurred_at);
CREATE INDEX IF NOT EXISTS ix_followup_history_time ON followup_history (followup_id, occurred_at);

CREATE TABLE IF NOT EXISTS fsm_activity_history (
	lead_id UUID, 
	followup_id UUID, 
	customer_id UUID, 
	actor_id UUID NOT NULL, 
	actor_name VARCHAR(150), 
	activity_type VARCHAR(80) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description TEXT, 
	old_value TEXT, 
	new_value TEXT, 
	occurred_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(lead_id) REFERENCES fsm_leads (id) ON DELETE CASCADE, 
	FOREIGN KEY(followup_id) REFERENCES fsm_followups (id) ON DELETE SET NULL, 
	FOREIGN KEY(customer_id) REFERENCES fsm_customers (id) ON DELETE SET NULL, 
	FOREIGN KEY(actor_id) REFERENCES employees (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_fsm_activity_history_occurred_at ON fsm_activity_history (occurred_at);
CREATE INDEX IF NOT EXISTS ix_fsm_activity_history_actor_id ON fsm_activity_history (actor_id);
CREATE INDEX IF NOT EXISTS ix_fsm_activity_history_followup_id ON fsm_activity_history (followup_id);
CREATE INDEX IF NOT EXISTS ix_fsm_activity_history_id ON fsm_activity_history (id);
CREATE INDEX IF NOT EXISTS ix_fsm_activity_history_lead_id ON fsm_activity_history (lead_id);
CREATE INDEX IF NOT EXISTS ix_fsm_activity_history_customer_id ON fsm_activity_history (customer_id);
CREATE INDEX IF NOT EXISTS ix_fsm_activity_history_activity_type ON fsm_activity_history (activity_type);

CREATE TABLE IF NOT EXISTS fsm_daily_sales_plan_item_obligations (
	plan_item_id UUID NOT NULL, 
	obligation_type VARCHAR(50) NOT NULL, 
	obligation_title VARCHAR(255) NOT NULL, 
	is_mandatory BOOLEAN NOT NULL, 
	lead_id UUID, 
	follow_up_id UUID, 
	task_id UUID, 
	fulfillment_status VARCHAR(50) NOT NULL, 
	outcome_notes TEXT, 
	fulfilled_at TIMESTAMP WITH TIME ZONE, 
	rescheduled_date DATE, 
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT chk_obligation_source_anchor CHECK (lead_id IS NOT NULL OR follow_up_id IS NOT NULL OR task_id IS NOT NULL), 
	FOREIGN KEY(plan_item_id) REFERENCES fsm_daily_sales_plan_items (id) ON DELETE CASCADE, 
	FOREIGN KEY(lead_id) REFERENCES leads (id) ON DELETE CASCADE, 
	FOREIGN KEY(follow_up_id) REFERENCES followups (id) ON DELETE CASCADE, 
	FOREIGN KEY(task_id) REFERENCES tasks (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plan_item_obligations_task_id ON fsm_daily_sales_plan_item_obligations (task_id);
CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plan_item_obligations_follow_up_id ON fsm_daily_sales_plan_item_obligations (follow_up_id);
CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plan_item_obligations_plan_item_id ON fsm_daily_sales_plan_item_obligations (plan_item_id);
CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plan_item_obligations_lead_id ON fsm_daily_sales_plan_item_obligations (lead_id);
CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plan_item_obligations_fulfillment_status ON fsm_daily_sales_plan_item_obligations (fulfillment_status);
CREATE INDEX IF NOT EXISTS ix_fsm_daily_sales_plan_item_obligations_id ON fsm_daily_sales_plan_item_obligations (id);

-- Seed Default SuperAdmin and Field Rep
INSERT INTO employees (id, email, password_hash, first_name, last_name, role, rank, territory, is_active)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'admin@fsm.com', '$2b$12$e8YqK..placeholder', 'Alex', 'Vance', 'ADMIN', 'General Director', 'Headquarters', true),
    ('22222222-2222-2222-2222-222222222222', 'field@fsm.com', '$2b$12$e8YqK..placeholder', 'Rahul', 'Sharma', 'MR', 'Senior Field Executive', 'South Mumbai', true)
ON CONFLICT (email) DO NOTHING;
