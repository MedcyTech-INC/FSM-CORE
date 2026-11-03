-- ==============================================================================
-- 02_branches_and_hierarchy.rollback.sql: Revert Branches & Hierarchy Trigger
-- ==============================================================================

DROP TRIGGER IF EXISTS trg_employee_tenant_integrity ON fsm_app.employees;
DROP FUNCTION IF EXISTS fsm_app.validate_employee_tenant_integrity();

ALTER TABLE fsm_app.employees DROP CONSTRAINT IF EXISTS uq_employees_tenant_email;
ALTER TABLE fsm_app.employees DROP COLUMN IF EXISTS is_tenant_root_admin;
ALTER TABLE fsm_app.employees DROP COLUMN IF EXISTS branch_id;
ALTER TABLE fsm_app.employees DROP COLUMN IF EXISTS tenant_id;

DROP TABLE IF EXISTS fsm_app.branches CASCADE;

SELECT 'Branches and employee hierarchy rollback complete' AS status;
