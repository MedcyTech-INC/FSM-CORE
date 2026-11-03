-- ==============================================================================
-- 06_archive_schema.rollback.sql: Revert Archival Schema
-- ==============================================================================

DROP SCHEMA IF EXISTS fsm_archive CASCADE;

SELECT 'fsm_archive rollback complete' AS status;
