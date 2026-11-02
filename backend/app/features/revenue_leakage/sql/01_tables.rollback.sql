-- ==============================================================================
-- 01_tables.rollback.sql: Rollback Revenue Leakage Tables & Enums
-- Feature: Revenue Leakage Detection (Phase 2)
-- Table Prefix: fsm_revenue_leakage_
-- ==============================================================================

DROP TABLE IF EXISTS fsm_app.fsm_revenue_leakage_alert_views CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_revenue_leakage_alert_notifications CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_revenue_leakage_user_sync_state CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_revenue_leakage_source_availability CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_revenue_leakage_scan_runs CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_revenue_leakage_alert_chains CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_revenue_leakage_alert_observations CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_revenue_leakage_alert_actions CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_revenue_leakage_alerts CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_revenue_leakage_rule_changes CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_revenue_leakage_rules CASCADE;

-- Drop Enums
DROP TYPE IF EXISTS fsm_app.notification_kind CASCADE;
DROP TYPE IF EXISTS fsm_app.scan_mode CASCADE;
DROP TYPE IF EXISTS fsm_app.scan_status CASCADE;
DROP TYPE IF EXISTS fsm_app.observation_reason CASCADE;
DROP TYPE IF EXISTS fsm_app.outcome CASCADE;
DROP TYPE IF EXISTS fsm_app.action_type CASCADE;
DROP TYPE IF EXISTS fsm_app.alert_status CASCADE;
DROP TYPE IF EXISTS fsm_app.attention_priority CASCADE;
DROP TYPE IF EXISTS fsm_app.classification CASCADE;
DROP TYPE IF EXISTS fsm_app.rule_code CASCADE;

-- Verification
SELECT 
    'Revenue Leakage Tables Dropped Successfully' AS status,
    count(*) AS remaining_fsm_revenue_leakage_tables
FROM information_schema.tables 
WHERE table_schema = 'fsm_app' AND table_name LIKE 'fsm_revenue_leakage_%';
