-- =============================================================================
-- Feature: AI Daily Sales Plan & Dynamic Route Optimization Schema
-- Multi-Vertical FSM Engine
-- All feature tables prefixed with: fsm_
-- Compatible with PostgreSQL 15+ and Supabase
-- =============================================================================

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Universal Customer Directory (fsm_customers)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fsm_customers (
	id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
	name VARCHAR(200) NOT NULL,
	customer_type VARCHAR(50) DEFAULT 'Doctor' NOT NULL,
	contact_person VARCHAR(150),
	phone VARCHAR(20),
	location_city VARCHAR(100),
	location_area VARCHAR(150),
	territory VARCHAR(150),
	latitude FLOAT,
	longitude FLOAT,
	is_active BOOLEAN DEFAULT TRUE NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_fsm_customers_name ON fsm_customers (name);
CREATE INDEX IF NOT EXISTS ix_fsm_customers_customer_type ON fsm_customers (customer_type);
CREATE INDEX IF NOT EXISTS ix_fsm_customers_location_city ON fsm_customers (location_city);
CREATE INDEX IF NOT EXISTS ix_fsm_customers_territory ON fsm_customers (territory);

-- -----------------------------------------------------------------------------
-- 2. Commercial Leads & Pipeline Opportunities (fsm_leads)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fsm_leads (
	id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
	employee_id UUID NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
	created_by_id UUID NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
	customer_id UUID REFERENCES fsm_customers (id) ON DELETE SET NULL,
	customer_name VARCHAR(200),
	customer_type VARCHAR(50) DEFAULT 'Doctor' NOT NULL,
	title VARCHAR(300) NOT NULL,
	opportunity_type VARCHAR(80) DEFAULT 'Hospital service' NOT NULL,
	interested_product_service VARCHAR(200),
	customer_response VARCHAR(200),
	lead_source VARCHAR(80) DEFAULT 'Doctor Visit' NOT NULL,
	stage VARCHAR(50) DEFAULT 'NEW' NOT NULL,
	priority VARCHAR(20) DEFAULT 'MEDIUM' NOT NULL,
	expected_value FLOAT,
	actual_converted_value FLOAT,
	expected_close_date DATE,
	location_city VARCHAR(100),
	contact_person VARCHAR(150),
	contact_phone VARCHAR(20),
	latitude FLOAT,
	longitude FLOAT,
	notes TEXT,
	last_interaction_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
	conversion_outcome TEXT,
	loss_reason TEXT,
	closed_at TIMESTAMP WITH TIME ZONE,
	field_visit_id UUID REFERENCES field_visits (id) ON DELETE SET NULL,
	is_archived BOOLEAN DEFAULT FALSE NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT chk_fsm_lead_stage CHECK (stage IN ('NEW', 'CONTACTED', 'INTERESTED', 'QUALIFIED', 'CONVERTED', 'LOST')),
	CONSTRAINT chk_fsm_lead_priority CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW'))
);

CREATE INDEX IF NOT EXISTS ix_fsm_leads_employee_id ON fsm_leads (employee_id);
CREATE INDEX IF NOT EXISTS ix_fsm_leads_stage ON fsm_leads (stage);
CREATE INDEX IF NOT EXISTS ix_fsm_leads_priority ON fsm_leads (priority);
CREATE INDEX IF NOT EXISTS ix_fsm_leads_customer_id ON fsm_leads (customer_id);

-- -----------------------------------------------------------------------------
-- 3. Scheduled Appointments & Follow-ups (fsm_followups)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fsm_followups (
	id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
	employee_id UUID NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
	created_by_id UUID NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
	lead_id UUID REFERENCES fsm_leads (id) ON DELETE SET NULL,
	customer_id UUID REFERENCES fsm_customers (id) ON DELETE SET NULL,
	field_visit_id UUID REFERENCES field_visits (id) ON DELETE SET NULL,
	customer_name VARCHAR(200),
	action_type VARCHAR(80) DEFAULT 'Visit' NOT NULL,
	title VARCHAR(300) NOT NULL,
	due_at TIMESTAMP WITH TIME ZONE NOT NULL,
	priority VARCHAR(20) DEFAULT 'MEDIUM' NOT NULL,
	notes TEXT,
	status VARCHAR(30) DEFAULT 'PENDING' NOT NULL,
	outcome TEXT,
	cancel_reason TEXT,
	completed_at TIMESTAMP WITH TIME ZONE,
	is_archived BOOLEAN DEFAULT FALSE NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT chk_fsm_followup_priority CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
	CONSTRAINT chk_fsm_followup_status CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
	CONSTRAINT chk_fsm_followup_anchor CHECK (lead_id IS NOT NULL OR customer_id IS NOT NULL OR field_visit_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ix_fsm_followups_employee_due ON fsm_followups (employee_id, due_at);
CREATE INDEX IF NOT EXISTS ix_fsm_followups_lead_id ON fsm_followups (lead_id);
CREATE INDEX IF NOT EXISTS ix_fsm_followups_status ON fsm_followups (status);

-- -----------------------------------------------------------------------------
-- 4. Audit Trail & Activity Governance Log (fsm_activity_history)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fsm_activity_history (
	id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
	lead_id UUID REFERENCES fsm_leads (id) ON DELETE CASCADE,
	followup_id UUID REFERENCES fsm_followups (id) ON DELETE SET NULL,
	customer_id UUID REFERENCES fsm_customers (id) ON DELETE SET NULL,
	actor_id UUID NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
	actor_name VARCHAR(150),
	activity_type VARCHAR(80) NOT NULL,
	title VARCHAR(255) NOT NULL,
	description TEXT,
	old_value TEXT,
	new_value TEXT,
	occurred_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_fsm_activity_history_lead ON fsm_activity_history (lead_id);
CREATE INDEX IF NOT EXISTS ix_fsm_activity_history_actor ON fsm_activity_history (actor_id);
CREATE INDEX IF NOT EXISTS ix_fsm_activity_history_occurred ON fsm_activity_history (occurred_at);

-- -----------------------------------------------------------------------------
-- 5. Monthly Representative Sales Targets (fsm_monthly_targets)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fsm_monthly_targets (
	id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
	employee_id UUID NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
	target_month DATE NOT NULL,
	target_revenue FLOAT DEFAULT 0.0 NOT NULL,
	achieved_revenue FLOAT DEFAULT 0.0 NOT NULL,
	target_visits INTEGER DEFAULT 0 NOT NULL,
	achieved_visits INTEGER DEFAULT 0 NOT NULL,
	status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT uq_monthly_target_emp_month UNIQUE (employee_id, target_month)
);

CREATE INDEX IF NOT EXISTS ix_fsm_monthly_targets_emp_month ON fsm_monthly_targets (employee_id, target_month);

-- -----------------------------------------------------------------------------
-- 6. AI Daily Sales Plans Header (fsm_daily_sales_plans)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fsm_daily_sales_plans (
	id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
	employee_id UUID NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
	plan_date DATE NOT NULL,
	version INTEGER DEFAULT 1 NOT NULL,
	revision_type VARCHAR(50) DEFAULT 'AI_INITIAL' NOT NULL,
	status VARCHAR(50) DEFAULT 'DRAFT' NOT NULL,
	total_planned_stops INTEGER DEFAULT 0 NOT NULL,
	total_planned_distance_meters FLOAT DEFAULT 0.0 NOT NULL,
	total_planned_duration_seconds INTEGER DEFAULT 0 NOT NULL,
	routing_engine VARCHAR(50) DEFAULT 'OSRM_2OPT_TSPTW' NOT NULL,
	idempotency_key UUID NOT NULL UNIQUE,
	approved_by_id UUID REFERENCES employees (id) ON DELETE SET NULL,
	approved_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT uq_plan_emp_date_version UNIQUE (employee_id, plan_date, version)
);

CREATE INDEX IF NOT EXISTS ix_fsm_plans_emp_date_status ON fsm_daily_sales_plans (employee_id, plan_date, status);

-- -----------------------------------------------------------------------------
-- 7. Daily Sales Plan Stops & Timeline Blocks (fsm_daily_sales_plan_items)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fsm_daily_sales_plan_items (
	id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
	plan_id UUID NOT NULL REFERENCES fsm_daily_sales_plans (id) ON DELETE CASCADE,
	sequence_order INTEGER NOT NULL,
	activity_type VARCHAR(50) DEFAULT 'PHYSICAL_VISIT' NOT NULL,
	planned_arrival_time TIME WITHOUT TIME ZONE,
	planned_departure_time TIME WITHOUT TIME ZONE,
	estimated_duration_minutes INTEGER DEFAULT 20 NOT NULL,
	lead_id UUID REFERENCES fsm_leads (id) ON DELETE SET NULL,
	customer_id UUID REFERENCES fsm_customers (id) ON DELETE SET NULL,
	latitude FLOAT,
	longitude FLOAT,
	location_address TEXT,
	stop_type VARCHAR(50) DEFAULT 'AI_RECOMMENDED' NOT NULL,
	recommendation_score FLOAT,
	recommendation_reasons JSONB DEFAULT '{}'::jsonb,
	status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
	field_visit_id UUID REFERENCES field_visits (id) ON DELETE SET NULL,
	transit_distance_m FLOAT DEFAULT 0.0 NOT NULL,
	transit_duration_s INTEGER DEFAULT 0 NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT uq_item_plan_sequence UNIQUE (plan_id, sequence_order)
);

CREATE INDEX IF NOT EXISTS ix_fsm_plan_items_plan_seq ON fsm_daily_sales_plan_items (plan_id, sequence_order);
CREATE INDEX IF NOT EXISTS ix_fsm_plan_items_lead_id ON fsm_daily_sales_plan_items (lead_id);
CREATE INDEX IF NOT EXISTS ix_fsm_plan_items_status ON fsm_daily_sales_plan_items (status);

-- -----------------------------------------------------------------------------
-- 8. Plan Stop Obligations & Action Checklist (fsm_daily_sales_plan_item_obligations)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fsm_daily_sales_plan_item_obligations (
	id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
	plan_item_id UUID NOT NULL REFERENCES fsm_daily_sales_plan_items (id) ON DELETE CASCADE,
	obligation_type VARCHAR(50) NOT NULL,
	obligation_title VARCHAR(255) NOT NULL,
	is_mandatory BOOLEAN DEFAULT FALSE NOT NULL,
	lead_id UUID REFERENCES fsm_leads (id) ON DELETE CASCADE,
	follow_up_id UUID REFERENCES fsm_followups (id) ON DELETE CASCADE,
	task_id UUID REFERENCES tasks (id) ON DELETE CASCADE,
	fulfillment_status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
	outcome_notes TEXT,
	fulfilled_at TIMESTAMP WITH TIME ZONE,
	rescheduled_date DATE,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT chk_obligation_source_anchor CHECK (lead_id IS NOT NULL OR follow_up_id IS NOT NULL OR task_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ix_fsm_obligations_item_status ON fsm_daily_sales_plan_item_obligations (plan_item_id, fulfillment_status);

-- -----------------------------------------------------------------------------
-- 9. Daily Plan Revision Snapshots (fsm_daily_sales_plan_revisions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fsm_daily_sales_plan_revisions (
	id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
	plan_id UUID NOT NULL REFERENCES fsm_daily_sales_plans (id) ON DELETE CASCADE,
	version INTEGER NOT NULL,
	revision_type VARCHAR(50) DEFAULT 'MIDDAY_REPLAN' NOT NULL,
	plan_snapshot JSONB NOT NULL,
	created_by_id UUID NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_fsm_plan_revisions_plan_version ON fsm_daily_sales_plan_revisions (plan_id, version);
