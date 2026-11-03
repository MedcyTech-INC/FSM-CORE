-- ==============================================================================
-- 03_canonical_customers.rollback.sql: Revert Unified Customer Master
-- ==============================================================================

DROP TABLE IF EXISTS fsm_app.customers CASCADE;

SELECT 'Canonical customer master rollback complete' AS status;
