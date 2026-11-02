-- ==============================================================================
-- 01_tables.sql: Monthly Target Schema, Tables, Constraints & Seeds
-- Feature: Monthly Target (Phase 1)
-- Table Prefix: fsm_monthly_targets_
-- Target: Supabase / PostgreSQL 15+ (Schema: fsm_app)
-- ==============================================================================

-- 0. Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 1. Create Enums if they do not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'metric_type' AND n.nspname = 'fsm_app') THEN
        CREATE TYPE fsm_app.metric_type AS ENUM (
            'revenue',
            'doctor_visits',
            'new_leads',
            'conversions',
            'collections'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'entity_type' AND n.nspname = 'fsm_app') THEN
        CREATE TYPE fsm_app.entity_type AS ENUM (
            'representative',
            'team',
            'territory',
            'branch',
            'customer',
            'product'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'target_status' AND n.nspname = 'fsm_app') THEN
        CREATE TYPE fsm_app.target_status AS ENUM (
            'active',
            'backfilling',
            'closed',
            'cancelled'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'entry_type' AND n.nspname = 'fsm_app') THEN
        CREATE TYPE fsm_app.entry_type AS ENUM (
            'contribution',
            'reversal'
        );
    END IF;
END $$;

-- 2. Core Targets Table
CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL CHECK (char_length(title) >= 3),
    metric_type fsm_app.metric_type NOT NULL,
    target_value NUMERIC(15,2) NOT NULL CHECK (target_value >= 0),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL CHECK (end_date > start_date),
    status fsm_app.target_status NOT NULL DEFAULT 'active',
    version INTEGER NOT NULL DEFAULT 1,
    final_value NUMERIC(15,2) NULL,
    closed_at TIMESTAMPTZ NULL,
    adjusted_at TIMESTAMPTZ NULL,
    cancel_reason VARCHAR(500) NULL,
    idempotency_key VARCHAR(100) NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS ix_targets_dates ON fsm_app.fsm_monthly_targets_targets (start_date, end_date);
CREATE INDEX IF NOT EXISTS ix_targets_metric ON fsm_app.fsm_monthly_targets_targets (metric_type);
CREATE INDEX IF NOT EXISTS ix_targets_status ON fsm_app.fsm_monthly_targets_targets (status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_targets_idempotency ON fsm_app.fsm_monthly_targets_targets (created_by, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 3. Target Assignments Table (Polymorphic assignees)
CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id UUID NOT NULL REFERENCES fsm_app.fsm_monthly_targets_targets(id) ON DELETE RESTRICT,
    entity_type fsm_app.entity_type NOT NULL,
    entity_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_target_assignment UNIQUE (target_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS ix_target_assignments_entity ON fsm_app.fsm_monthly_targets_assignments (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_target_assignments_target ON fsm_app.fsm_monthly_targets_assignments (target_id);

-- 4. Target Progress Cached State Table (1:1 with assignment)
CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL UNIQUE REFERENCES fsm_app.fsm_monthly_targets_assignments(id) ON DELETE CASCADE,
    current_value NUMERIC(15,2) NOT NULL DEFAULT 0,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Target Progress Entries Table (The Append-Only Ledger of Facts)
CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_progress_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES fsm_app.fsm_monthly_targets_assignments(id) ON DELETE RESTRICT,
    source_event_id UUID NOT NULL,
    source_event_type VARCHAR(50) NOT NULL,
    entry_type fsm_app.entry_type NOT NULL,
    delta NUMERIC(15,2) NOT NULL,
    contributor_id UUID NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    business_date DATE NOT NULL,
    excluded BOOLEAN NOT NULL DEFAULT FALSE,
    excluded_reason VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_progress_entry UNIQUE (assignment_id, source_event_id, entry_type),
    CONSTRAINT ck_progress_delta CHECK (
        (entry_type = 'contribution' AND delta > 0) OR
        (entry_type = 'reversal' AND delta < 0)
    )
);

CREATE INDEX IF NOT EXISTS ix_progress_entries_assignment_date ON fsm_app.fsm_monthly_targets_progress_entries (assignment_id, business_date);
CREATE INDEX IF NOT EXISTS ix_progress_entries_source_event ON fsm_app.fsm_monthly_targets_progress_entries (source_event_id);

-- 6. Target Changes Audit Table
CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id UUID NOT NULL REFERENCES fsm_app.fsm_monthly_targets_targets(id) ON DELETE RESTRICT,
    version INTEGER NOT NULL,
    field VARCHAR(50) NOT NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    reason VARCHAR(500) NOT NULL,
    changed_by UUID NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_target_changes_target_version ON fsm_app.fsm_monthly_targets_changes (target_id, version);

-- 7. Org Membership History Table (Point-in-time Attribution & Transfers)
CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_org_membership_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    team_id UUID NOT NULL,
    territory_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ NULL,
    CONSTRAINT ex_org_membership_overlap EXCLUDE USING gist (
        employee_id WITH =,
        tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz)) WITH &&
    )
);

CREATE INDEX IF NOT EXISTS ix_org_membership_emp ON fsm_app.fsm_monthly_targets_org_membership_history (employee_id);

-- 8. Transactional Event Outbox Table
CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_event_outbox (
    id UUID PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    event_version INTEGER NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NULL
);

CREATE INDEX IF NOT EXISTS ix_outbox_unprocessed ON fsm_app.fsm_monthly_targets_event_outbox (created_at) WHERE processed_at IS NULL;

-- 9. Processed Events Deduplication Table
CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_processed_events (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Dead-Letter / Failed Events Table
CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_failed_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    event_version INTEGER NOT NULL,
    payload JSONB NOT NULL,
    reason VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ NULL
);

-- 11. Metric Definitions Table
CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_metric_definitions (
    metric_type fsm_app.metric_type PRIMARY KEY,
    source_event_type VARCHAR(50) NOT NULL,
    counts_what TEXT NOT NULL,
    date_field VARCHAR(50) NOT NULL,
    dedupe_rule TEXT NOT NULL,
    is_integer BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 12. Reconciliation Runs & Drifts Tables
CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_reconciliation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    targets_checked INTEGER NOT NULL DEFAULT 0,
    drifts_found INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_reconciliation_drifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES fsm_app.fsm_monthly_targets_reconciliation_runs(id) ON DELETE CASCADE,
    assignment_id UUID NOT NULL REFERENCES fsm_app.fsm_monthly_targets_assignments(id) ON DELETE CASCADE,
    stored_value NUMERIC(15,2) NOT NULL,
    recomputed_value NUMERIC(15,2) NOT NULL,
    source_value NUMERIC(15,2) NULL,
    kind VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Archived Totals Table (P-16 Data Retention)
CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_archived_totals (
    assignment_id UUID PRIMARY KEY REFERENCES fsm_app.fsm_monthly_targets_assignments(id) ON DELETE CASCADE,
    entry_count INTEGER NOT NULL,
    entry_sum NUMERIC(15,2) NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Enable Row Level Security (RLS) on all tables with no public policy
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'fsm_monthly_targets_targets',
        'fsm_monthly_targets_assignments',
        'fsm_monthly_targets_progress',
        'fsm_monthly_targets_progress_entries',
        'fsm_monthly_targets_changes',
        'fsm_monthly_targets_org_membership_history',
        'fsm_monthly_targets_event_outbox',
        'fsm_monthly_targets_processed_events',
        'fsm_monthly_targets_failed_events',
        'fsm_monthly_targets_metric_definitions',
        'fsm_monthly_targets_reconciliation_runs',
        'fsm_monthly_targets_reconciliation_drifts',
        'fsm_monthly_targets_archived_totals'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE fsm_app.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('GRANT ALL ON TABLE fsm_app.%I TO fsm_app_user;', tbl);
    END LOOP;
END $$;

-- 15. Seed Metric Definitions (Locked Decision D2)
INSERT INTO fsm_app.fsm_monthly_targets_metric_definitions (
    metric_type, source_event_type, counts_what, date_field, dedupe_rule, is_integer, is_active
) VALUES
    ('doctor_visits', 'visit_completed', 'Verified doctor visits logged in field', 'completed_at', 'One count per visit_id with valid geofence', TRUE, TRUE),
    ('new_leads', 'lead_created', 'New customer leads generated by rep', 'created_at', 'One count per lead_id', TRUE, TRUE),
    ('conversions', 'lead_converted', 'Leads converted into active accounts', 'converted_at', 'One count per lead_id conversion', TRUE, TRUE),
    ('revenue', 'order_closed', 'Commercial sales orders net of returns', 'closed_at', 'Sum of order_value in INR', FALSE, TRUE),
    ('collections', 'collection_recorded', 'Cash and check collections received', 'recorded_at', 'Sum of payment amounts in INR', FALSE, TRUE)
ON CONFLICT (metric_type) DO UPDATE
SET source_event_type = EXCLUDED.source_event_type,
    counts_what = EXCLUDED.counts_what,
    date_field = EXCLUDED.date_field,
    dedupe_rule = EXCLUDED.dedupe_rule,
    is_integer = EXCLUDED.is_integer,
    is_active = EXCLUDED.is_active;

-- 16. Verification Summary
SELECT 
    'Monthly Target Tables Created Successfully' AS status,
    count(*) AS table_count
FROM information_schema.tables 
WHERE table_schema = 'fsm_app' AND table_name LIKE 'fsm_monthly_targets_%';
