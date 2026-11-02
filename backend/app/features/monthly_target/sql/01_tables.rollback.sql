-- ==============================================================================
-- 01_tables.rollback.sql: Rollback Monthly Target Schema & Tables
-- Feature: Monthly Target (Phase 1)
-- Table Prefix: fsm_monthly_targets_
-- ==============================================================================

DROP TABLE IF EXISTS fsm_app.fsm_monthly_targets_archived_totals CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_monthly_targets_reconciliation_drifts CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_monthly_targets_reconciliation_runs CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_monthly_targets_metric_definitions CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_monthly_targets_failed_events CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_monthly_targets_processed_events CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_monthly_targets_event_outbox CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_monthly_targets_org_membership_history CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_monthly_targets_changes CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_monthly_targets_progress_entries CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_monthly_targets_progress CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_monthly_targets_assignments CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_monthly_targets_targets CASCADE;

-- Drop Enums
DROP TYPE IF EXISTS fsm_app.entry_type CASCADE;
DROP TYPE IF EXISTS fsm_app.target_status CASCADE;
DROP TYPE IF EXISTS fsm_app.entity_type CASCADE;
DROP TYPE IF EXISTS fsm_app.metric_type CASCADE;

-- Verification
SELECT 
    'Monthly Target Tables Dropped Successfully' AS status,
    count(*) AS remaining_fsm_monthly_targets_tables
FROM information_schema.tables 
WHERE table_schema = 'fsm_app' AND table_name LIKE 'fsm_monthly_targets_%';
