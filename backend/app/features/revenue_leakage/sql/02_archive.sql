-- ==============================================================================
-- 02_archive.sql: Revenue Leakage Cold Archive Schema & Tables
-- Feature: Revenue Leakage Detection (Phase 2 / T-22, Critic Gap P-16)
-- Table Prefix: fsm_revenue_leakage_
-- Target: Supabase / PostgreSQL 15+ (Schema: fsm_archive, fsm_app)
-- ==============================================================================

-- 1. Ensure fsm_archive schema exists with strict isolation
CREATE SCHEMA IF NOT EXISTS fsm_archive;
REVOKE ALL ON SCHEMA fsm_archive FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA fsm_archive TO fsm_app_user;

-- 2. Archived Alerts Table
CREATE TABLE IF NOT EXISTS fsm_archive.fsm_revenue_leakage_alerts (
    id UUID PRIMARY KEY,
    rule_id UUID NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    classification fsm_app.classification NOT NULL,
    attention_priority fsm_app.attention_priority NOT NULL,
    priority_reason VARCHAR(500) NOT NULL,
    observation JSONB NOT NULL,
    exposure_amount NUMERIC(15,2) NULL,
    exposure_basis VARCHAR(500) NULL,
    status fsm_app.alert_status NOT NULL,
    version INTEGER NOT NULL,
    occurrence_no INTEGER NOT NULL,
    previous_alert_id UUID NULL,
    first_detected_at TIMESTAMPTZ NOT NULL,
    last_observed_at TIMESTAMPTZ NOT NULL,
    last_notified_at TIMESTAMPTZ NULL,
    clear_streak INTEGER NOT NULL,
    suppressed_until TIMESTAMPTZ NULL,
    escalation_level INTEGER NOT NULL,
    escalated_at TIMESTAMPTZ NULL,
    resolved_at TIMESTAMPTZ NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archived_leakage_alerts_entity 
ON fsm_archive.fsm_revenue_leakage_alerts (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_archived_leakage_alerts_rule 
ON fsm_archive.fsm_revenue_leakage_alerts (rule_id);

-- 3. Archived Alert Actions Table
CREATE TABLE IF NOT EXISTS fsm_archive.fsm_revenue_leakage_alert_actions (
    id UUID PRIMARY KEY,
    alert_id UUID NOT NULL,
    action_type fsm_app.action_type NOT NULL,
    outcome fsm_app.outcome NULL,
    action_taken VARCHAR(255) NOT NULL,
    evidence_reference VARCHAR(255) NULL,
    notes VARCHAR(1000) NULL,
    action_by UUID NOT NULL,
    idempotency_key VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archived_alert_actions_alert 
ON fsm_archive.fsm_revenue_leakage_alert_actions (alert_id);

-- 4. Archived Alert Observations Table
CREATE TABLE IF NOT EXISTS fsm_archive.fsm_revenue_leakage_alert_observations (
    id UUID PRIMARY KEY,
    alert_id UUID NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    observation JSONB NOT NULL,
    attention_priority fsm_app.attention_priority NOT NULL,
    reason fsm_app.observation_reason NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archived_alert_obs_alert 
ON fsm_archive.fsm_revenue_leakage_alert_observations (alert_id);

-- 5. Archived Alert Views Table
CREATE TABLE IF NOT EXISTS fsm_archive.fsm_revenue_leakage_alert_views (
    id UUID PRIMARY KEY,
    alert_id UUID NOT NULL,
    viewer_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    viewed_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archived_alert_views_alert 
ON fsm_archive.fsm_revenue_leakage_alert_views (alert_id);

-- 6. Enable RLS and Grant Permissions
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'fsm_revenue_leakage_alerts',
        'fsm_revenue_leakage_alert_actions',
        'fsm_revenue_leakage_alert_observations',
        'fsm_revenue_leakage_alert_views'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE fsm_archive.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('GRANT ALL ON TABLE fsm_archive.%I TO fsm_app_user;', tbl);
    END LOOP;
END $$;

-- 7. Backfill alert_chains from any pre-existing alerts (T-22 / Critic Gap P-16)
INSERT INTO fsm_app.fsm_revenue_leakage_alert_chains (
    rule_id, entity_type, entity_id, last_alert_id, last_occurrence_no, last_closed_at, suppressed_until, updated_at
)
SELECT DISTINCT ON (rule_id, entity_type, entity_id)
    rule_id, entity_type, entity_id, id, occurrence_no, resolved_at, suppressed_until, NOW()
FROM fsm_app.fsm_revenue_leakage_alerts
ORDER BY rule_id, entity_type, entity_id, occurrence_no DESC
ON CONFLICT (rule_id, entity_type, entity_id) DO NOTHING;

-- 8. Verification Summary
SELECT 
    'Revenue Leakage Archive Tables Created Successfully' AS status,
    count(*) AS archive_table_count
FROM information_schema.tables 
WHERE table_schema = 'fsm_archive' AND table_name LIKE 'fsm_revenue_leakage_%';

