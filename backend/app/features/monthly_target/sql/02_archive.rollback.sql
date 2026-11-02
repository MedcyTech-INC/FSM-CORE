-- ==============================================================================
-- 02_archive.rollback.sql: Rollback Archive Schema & Tables
-- Feature: Monthly Target (Phase 1 / T-25)
-- Table Prefix: fsm_monthly_targets_
-- ==============================================================================

DROP TABLE IF EXISTS fsm_archive.fsm_monthly_targets_progress_entries CASCADE;
DROP TABLE IF EXISTS fsm_app.fsm_monthly_targets_archived_totals CASCADE;
DROP SCHEMA IF EXISTS fsm_archive CASCADE;

-- End of rollback check query
SELECT 
    (SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = 'fsm_archive') AS archive_schema_count,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'fsm_app' AND table_name = 'fsm_monthly_targets_archived_totals') AS archived_totals_count;
