-- ==============================================================================
-- 05_seed_default_tenant.rollback.sql: Revert Default Tenant Seed Data
-- ==============================================================================

DELETE FROM fsm_app.branches WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM fsm_system.tenant_branding WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM fsm_system.tenant_features WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM fsm_system.tenants WHERE id = '00000000-0000-0000-0000-000000000001';

SELECT 'Default tenant seed rollback complete' AS status;
