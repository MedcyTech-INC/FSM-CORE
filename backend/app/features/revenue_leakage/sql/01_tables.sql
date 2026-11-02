-- ==============================================================================
-- 01_tables.sql: Revenue Leakage Detection Schema, Tables, Constraints & Seeds
-- Feature: Revenue Leakage Detection (Phase 2)
-- Table Prefix: fsm_revenue_leakage_
-- Target: Supabase / PostgreSQL 15+ (Schema: fsm_app)
-- Language Rule: NEVER use 'loss', 'lost revenue' or 'leakage amount'
-- ==============================================================================

-- 0. Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Feature Enums inside fsm_app schema
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'rule_code' AND n.nspname = 'fsm_app') THEN
        CREATE TYPE fsm_app.rule_code AS ENUM (
            'unvisited_client',
            'abandoned_lead',
            'declining_frequency',
            'inactive_opportunity',
            'underperforming_territory'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'classification' AND n.nspname = 'fsm_app') THEN
        CREATE TYPE fsm_app.classification AS ENUM (
            'operational_warning',
            'potential_exposure',
            'confirmed_commercial_loss',
            'verified_financial_discrepancy'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'attention_priority' AND n.nspname = 'fsm_app') THEN
        CREATE TYPE fsm_app.attention_priority AS ENUM (
            'low',
            'medium',
            'high'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'alert_status' AND n.nspname = 'fsm_app') THEN
        CREATE TYPE fsm_app.alert_status AS ENUM (
            'active',
            'acknowledged',
            'resolved',
            'dismissed'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'action_type' AND n.nspname = 'fsm_app') THEN
        CREATE TYPE fsm_app.action_type AS ENUM (
            'acknowledged',
            'resolved',
            'dismissed',
            'note',
            'escalated',
            'auto_cleared'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'outcome' AND n.nspname = 'fsm_app') THEN
        CREATE TYPE fsm_app.outcome AS ENUM (
            'normal_variation',
            'investigation_needed',
            'corrective_action_taken',
            'commercial_outcome_evidenced',
            'condition_cleared'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'observation_reason' AND n.nspname = 'fsm_app') THEN
        CREATE TYPE fsm_app.observation_reason AS ENUM (
            'created',
            'priority_changed',
            'value_changed',
            'resolved',
            'suppressed_recurrence'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'scan_status' AND n.nspname = 'fsm_app') THEN
        CREATE TYPE fsm_app.scan_status AS ENUM (
            'running',
            'succeeded',
            'failed',
            'partial',
            'skipped_source_missing'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'scan_mode' AND n.nspname = 'fsm_app') THEN
        CREATE TYPE fsm_app.scan_mode AS ENUM (
            'baseline',
            'normal'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'notification_kind' AND n.nspname = 'fsm_app') THEN
        CREATE TYPE fsm_app.notification_kind AS ENUM (
            'created',
            'priority_raised',
            'escalated'
        );
    END IF;
END $$;

-- 2. Rules Configuration Table
CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code fsm_app.rule_code NOT NULL UNIQUE,
    rule_name VARCHAR(255) NOT NULL,
    description VARCHAR(500) NULL,
    threshold_days INTEGER NOT NULL DEFAULT 30 CHECK (threshold_days >= 1),
    threshold_value NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (threshold_value >= 0),
    medium_priority_ratio NUMERIC(5,2) NOT NULL DEFAULT 1.50 CHECK (medium_priority_ratio >= 1.0),
    high_priority_ratio NUMERIC(5,2) NOT NULL DEFAULT 2.00 CHECK (high_priority_ratio > medium_priority_ratio),
    change_ratio NUMERIC(5,2) NOT NULL DEFAULT 0.10 CHECK (change_ratio > 0 AND change_ratio <= 1.0),
    cooldown_days INTEGER NOT NULL DEFAULT 7 CHECK (cooldown_days >= 0),
    dismiss_days INTEGER NOT NULL DEFAULT 30 CHECK (dismiss_days >= 0),
    autoclear_scans INTEGER NOT NULL DEFAULT 2 CHECK (autoclear_scans >= 1),
    escalation_days INTEGER NOT NULL DEFAULT 3 CHECK (escalation_days >= 1),
    min_history_months INTEGER NOT NULL DEFAULT 3 CHECK (min_history_months >= 1),
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    required_sources TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Rule Changes Audit Table (Critic Gap RL-2)
CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_rule_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES fsm_app.fsm_revenue_leakage_rules(id) ON DELETE RESTRICT,
    field VARCHAR(50) NOT NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    reason VARCHAR(500) NOT NULL CHECK (char_length(reason) >= 5),
    changed_by UUID NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_rule_changes_rule_time ON fsm_app.fsm_revenue_leakage_rule_changes (rule_id, changed_at DESC);

-- 4. Alerts Table
CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES fsm_app.fsm_revenue_leakage_rules(id) ON DELETE RESTRICT,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('customer', 'lead', 'territory')),
    entity_id UUID NOT NULL,
    classification fsm_app.classification NOT NULL DEFAULT 'operational_warning',
    attention_priority fsm_app.attention_priority NOT NULL,
    priority_reason VARCHAR(500) NOT NULL,
    observation JSONB NOT NULL,
    exposure_amount NUMERIC(15,2) NULL,
    exposure_basis VARCHAR(500) NULL,
    status fsm_app.alert_status NOT NULL DEFAULT 'active',
    version INTEGER NOT NULL DEFAULT 1,
    occurrence_no INTEGER NOT NULL DEFAULT 1,
    previous_alert_id UUID NULL,
    first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_notified_at TIMESTAMPTZ NULL,
    clear_streak INTEGER NOT NULL DEFAULT 0,
    suppressed_until TIMESTAMPTZ NULL,
    escalation_level INTEGER NOT NULL DEFAULT 0,
    escalated_at TIMESTAMPTZ NULL,
    resolved_at TIMESTAMPTZ NULL,
    CONSTRAINT ck_exposure_basis CHECK (
        (exposure_amount IS NULL AND exposure_basis IS NULL) OR
        (exposure_amount IS NOT NULL AND exposure_basis IS NOT NULL)
    )
);

-- Critic Gap P-5: Partial unique index created before any scan runs
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_leakage_alert 
ON fsm_app.fsm_revenue_leakage_alerts (rule_id, entity_type, entity_id) 
WHERE status IN ('active', 'acknowledged');

CREATE INDEX IF NOT EXISTS ix_leakage_alerts_status_prio ON fsm_app.fsm_revenue_leakage_alerts (status, attention_priority);
CREATE INDEX IF NOT EXISTS ix_leakage_alerts_entity ON fsm_app.fsm_revenue_leakage_alerts (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_leakage_alerts_previous ON fsm_app.fsm_revenue_leakage_alerts (previous_alert_id);

-- 5. Alert Actions Table
CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_alert_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES fsm_app.fsm_revenue_leakage_alerts(id) ON DELETE RESTRICT,
    action_type fsm_app.action_type NOT NULL,
    outcome fsm_app.outcome NULL,
    action_taken VARCHAR(255) NOT NULL CHECK (char_length(action_taken) >= 5),
    evidence_reference VARCHAR(255) NULL,
    notes VARCHAR(1000) NULL,
    action_by UUID NOT NULL,
    idempotency_key VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_action_outcome CHECK (
        (action_type IN ('resolved', 'dismissed') AND outcome IS NOT NULL) OR
        (action_type NOT IN ('resolved', 'dismissed'))
    ),
    CONSTRAINT ck_action_evidence CHECK (
        (outcome = 'commercial_outcome_evidenced' AND evidence_reference IS NOT NULL) OR
        (outcome != 'commercial_outcome_evidenced' OR outcome IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_action_idemp 
ON fsm_app.fsm_revenue_leakage_alert_actions (alert_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_alert_actions_alert_created ON fsm_app.fsm_revenue_leakage_alert_actions (alert_id, created_at);

-- 6. Alert Observations Table
CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_alert_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES fsm_app.fsm_revenue_leakage_alerts(id) ON DELETE CASCADE,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    observation JSONB NOT NULL,
    attention_priority fsm_app.attention_priority NOT NULL,
    reason fsm_app.observation_reason NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_alert_obs_alert_time ON fsm_app.fsm_revenue_leakage_alert_observations (alert_id, observed_at);

-- 7. Alert Chains Table (P-16: Keeps numbering and cool-downs across archives)
CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_alert_chains (
    rule_id UUID NOT NULL REFERENCES fsm_app.fsm_revenue_leakage_rules(id) ON DELETE RESTRICT,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    last_alert_id UUID NOT NULL,
    last_occurrence_no INTEGER NOT NULL DEFAULT 1,
    last_closed_at TIMESTAMPTZ NULL,
    suppressed_until TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (rule_id, entity_type, entity_id)
);

-- 8. Scan Runs Table
CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_scan_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code fsm_app.rule_code NOT NULL,
    mode fsm_app.scan_mode NOT NULL DEFAULT 'normal',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ NULL,
    status fsm_app.scan_status NOT NULL DEFAULT 'running',
    rows_evaluated INTEGER NOT NULL DEFAULT 0,
    alerts_created INTEGER NOT NULL DEFAULT 0,
    alerts_updated INTEGER NOT NULL DEFAULT 0,
    alerts_cleared INTEGER NOT NULL DEFAULT 0,
    skipped_not_synced INTEGER NOT NULL DEFAULT 0,
    attempt INTEGER NOT NULL DEFAULT 1,
    error_message VARCHAR(1000) NULL
);

CREATE INDEX IF NOT EXISTS ix_scan_runs_rule_started ON fsm_app.fsm_revenue_leakage_scan_runs (rule_code, started_at DESC);

-- 9. Source Availability Table (Critic Gap RL-14)
CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_source_availability (
    source_key VARCHAR(50) PRIMARY KEY,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note VARCHAR(500) NULL
);

-- 10. User Sync State Table (Critic Gap RL-13)
CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_user_sync_state (
    user_id UUID PRIMARY KEY,
    last_synced_at TIMESTAMPTZ NOT NULL
);

-- 11. Alert Notifications Table
CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_alert_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES fsm_app.fsm_revenue_leakage_alerts(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL,
    kind fsm_app.notification_kind NOT NULL,
    attention_priority fsm_app.attention_priority NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
    digest_date DATE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_alert_notification UNIQUE (alert_id, recipient_id, kind, attention_priority)
);

CREATE INDEX IF NOT EXISTS ix_alert_notifications_pending 
ON fsm_app.fsm_revenue_leakage_alert_notifications (status, created_at) 
WHERE status = 'pending';

-- 12. Alert Views Audit Table (Critic Gap P-10)
CREATE TABLE IF NOT EXISTS fsm_app.fsm_revenue_leakage_alert_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES fsm_app.fsm_revenue_leakage_alerts(id) ON DELETE CASCADE,
    viewer_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL DEFAULT 'view' CHECK (action IN ('view', 'export')),
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_alert_views_alert ON fsm_app.fsm_revenue_leakage_alert_views (alert_id, viewed_at);

-- 13. Enable Row Level Security (RLS) and Grant Permissions to fsm_app_user
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'fsm_revenue_leakage_rules',
        'fsm_revenue_leakage_rule_changes',
        'fsm_revenue_leakage_alerts',
        'fsm_revenue_leakage_alert_actions',
        'fsm_revenue_leakage_alert_observations',
        'fsm_revenue_leakage_alert_chains',
        'fsm_revenue_leakage_scan_runs',
        'fsm_revenue_leakage_source_availability',
        'fsm_revenue_leakage_user_sync_state',
        'fsm_revenue_leakage_alert_notifications',
        'fsm_revenue_leakage_alert_views'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE fsm_app.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('GRANT ALL ON TABLE fsm_app.%I TO fsm_app_user;', tbl);
    END LOOP;
END $$;

-- 14. Seed Rules (Section 2 & 5.1 Defaults)
INSERT INTO fsm_app.fsm_revenue_leakage_rules (
    rule_code, rule_name, description, threshold_days, threshold_value,
    medium_priority_ratio, high_priority_ratio, change_ratio,
    cooldown_days, dismiss_days, autoclear_scans, escalation_days,
    min_history_months, params, required_sources, is_active
) VALUES
    (
        'unvisited_client',
        'High-Value Client Overdue for Visit',
        'Fires when working days since last verified visit exceed threshold for high-value accounts.',
        30, 100000.00, 1.50, 2.00, 0.10, 7, 30, 2, 3, 3,
        '{"lookback_months": 3}'::jsonb,
        ARRAY['visits', 'orders'],
        TRUE
    ),
    (
        'abandoned_lead',
        'High-Value Lead Without Timely Follow-up',
        'Fires when open lead has had no follow-up status change for more than threshold working days.',
        30, 0.00, 1.50, 2.00, 0.10, 7, 30, 2, 3, 3,
        '{}'::jsonb,
        ARRAY['leads'],
        TRUE
    ),
    (
        'declining_frequency',
        'Order Frequency Decline',
        'Fires when monthly order count drops below historical baseline for consecutive months.',
        30, 0.00, 1.50, 2.00, 0.10, 7, 30, 2, 3, 3,
        '{"consecutive_months": 2, "min_fall_percent": 30}'::jsonb,
        ARRAY['orders'],
        TRUE
    ),
    (
        'inactive_opportunity',
        'Stalled Commercial Opportunity',
        'Fires when open opportunity remains in pipeline stage beyond expected cadence without contact.',
        30, 0.00, 1.50, 2.00, 0.10, 7, 30, 2, 3, 3,
        '{}'::jsonb,
        ARRAY['visits', 'leads'],
        TRUE
    ),
    (
        'underperforming_territory',
        'Territory Revenue Behind Pace',
        'Fires when territory revenue achievement percentage lags working days elapsed.',
        30, 15.00, 1.50, 2.00, 0.10, 7, 30, 2, 3, 3,
        '{"min_elapsed_working_days": 5}'::jsonb,
        ARRAY['targets', 'orders'],
        TRUE
    )
ON CONFLICT (rule_code) DO UPDATE
SET rule_name = EXCLUDED.rule_name,
    description = EXCLUDED.description,
    threshold_days = EXCLUDED.threshold_days,
    threshold_value = EXCLUDED.threshold_value,
    medium_priority_ratio = EXCLUDED.medium_priority_ratio,
    high_priority_ratio = EXCLUDED.high_priority_ratio,
    params = EXCLUDED.params,
    required_sources = EXCLUDED.required_sources,
    is_active = EXCLUDED.is_active;

-- 15. Seed Initial Source Availability
INSERT INTO fsm_app.fsm_revenue_leakage_source_availability (source_key, is_available, checked_at, note) VALUES
    ('visits', TRUE, NOW(), 'Field visit submission records'),
    ('orders', TRUE, NOW(), 'Sales order transactions'),
    ('leads', TRUE, NOW(), 'CRM customer leads and pipeline stages'),
    ('targets', TRUE, NOW(), 'Monthly targets progress ledger'),
    ('leave', TRUE, NOW(), 'Approved employee leave calendar'),
    ('sync', TRUE, NOW(), 'Mobile device sync state log')
ON CONFLICT (source_key) DO UPDATE
SET is_available = EXCLUDED.is_available,
    checked_at = EXCLUDED.checked_at,
    note = EXCLUDED.note;

-- 16. Verification Summary Query
SELECT 
    'Revenue Leakage Tables Created Successfully' AS status,
    count(*) AS table_count
FROM information_schema.tables 
WHERE table_schema = 'fsm_app' AND table_name LIKE 'fsm_revenue_leakage_%';
