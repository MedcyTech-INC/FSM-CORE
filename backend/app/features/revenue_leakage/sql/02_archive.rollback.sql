-- ==============================================================================
-- 02_archive.rollback.sql: Rollback Revenue Leakage Archive Tables
-- Feature: Revenue Leakage Detection (Phase 2 / T-22)
-- Table Prefix: fsm_revenue_leakage_
-- ==============================================================================

DROP TABLE IF EXISTS fsm_archive.fsm_revenue_leakage_alert_views CASCADE;
DROP TABLE IF EXISTS fsm_archive.fsm_revenue_leakage_alert_observations CASCADE;
DROP TABLE IF EXISTS fsm_archive.fsm_revenue_leakage_alert_actions CASCADE;
DROP TABLE IF EXISTS fsm_archive.fsm_revenue_leakage_alerts CASCADE;

-- Verification
SELECT 
    'Revenue Leakage Archive Tables Dropped Successfully' AS status,
    count(*) AS remaining_fsm_revenue_leakage_archive_tables
FROM information_schema.tables 
WHERE table_schema = 'fsm_archive' AND table_name LIKE 'fsm_revenue_leakage_%';
