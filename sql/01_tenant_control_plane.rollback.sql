-- ==============================================================================
-- 01_tenant_control_plane.rollback.sql: Revert Control Plane Schema
-- ==============================================================================

DROP TABLE IF EXISTS fsm_system.tenant_branding CASCADE;
DROP TABLE IF EXISTS fsm_system.tenant_features CASCADE;
DROP TABLE IF EXISTS fsm_system.tenants CASCADE;
DROP SCHEMA IF EXISTS fsm_system CASCADE;

SELECT 'fsm_system control plane rollback complete' AS status;
