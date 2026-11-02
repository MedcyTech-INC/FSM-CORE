-- ==============================================================================
-- 00_foundation.rollback.sql: Revert Foundation Schema & Shared Holidays
-- ==============================================================================

DROP TABLE IF EXISTS fsm_app.holidays CASCADE;
DROP SCHEMA IF EXISTS fsm_app CASCADE;

-- Note: Role fsm_app_user is retained unless explicitly dropped by administrator:
-- DROP ROLE IF EXISTS fsm_app_user;

SELECT 'Foundation rollback complete' AS status;
