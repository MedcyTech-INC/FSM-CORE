-- ==============================================================================
-- 02_branches_and_hierarchy.sql: Two-Tier Organization & Employee Integrity
-- Architecture Spec: v2.0-MultiTenant (Phase 1)
-- Target: Supabase / PostgreSQL 15+
-- ==============================================================================

-- 1. Operational Branches (Regional / Divisional entities under a Tenant)
CREATE TABLE IF NOT EXISTS fsm_app.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES fsm_system.tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    branch_code VARCHAR(50) NOT NULL,
    city VARCHAR(100) NOT NULL,
    is_head_office BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_branches_tenant_code UNIQUE (tenant_id, branch_code)
);

CREATE INDEX IF NOT EXISTS ix_branches_tenant_active ON fsm_app.branches (tenant_id, is_active);

-- 2. Add Multi-Tenant Columns to Employees
DO $$ 
BEGIN 
    -- Check and create fsm_app.employees table if not exists, or alter existing table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='fsm_app' AND table_name='employees') THEN
        CREATE TABLE fsm_app.employees (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES fsm_system.tenants(id) ON DELETE CASCADE,
            branch_id UUID REFERENCES fsm_app.branches(id) ON DELETE SET NULL,
            is_tenant_root_admin BOOLEAN NOT NULL DEFAULT FALSE,
            email VARCHAR(255) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            role VARCHAR(50) NOT NULL,
            rank VARCHAR(50),
            territory VARCHAR(150),
            reporting_to_id UUID REFERENCES fsm_app.employees(id) ON DELETE SET NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            metadata_json JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_employees_tenant_email UNIQUE (tenant_id, email)
        );
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='fsm_app' AND table_name='employees' AND column_name='tenant_id') THEN
            ALTER TABLE fsm_app.employees ADD COLUMN tenant_id UUID REFERENCES fsm_system.tenants(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='fsm_app' AND table_name='employees' AND column_name='branch_id') THEN
            ALTER TABLE fsm_app.employees ADD COLUMN branch_id UUID REFERENCES fsm_app.branches(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='fsm_app' AND table_name='employees' AND column_name='is_tenant_root_admin') THEN
            ALTER TABLE fsm_app.employees ADD COLUMN is_tenant_root_admin BOOLEAN NOT NULL DEFAULT FALSE;
        END IF;

        -- Drop single-tenant unique email constraint and add compound unique key
        ALTER TABLE fsm_app.employees DROP CONSTRAINT IF EXISTS employees_email_key;
        ALTER TABLE fsm_app.employees DROP CONSTRAINT IF EXISTS uq_employees_email;
        ALTER TABLE fsm_app.employees DROP CONSTRAINT IF EXISTS uq_employees_tenant_email;
        ALTER TABLE fsm_app.employees ADD CONSTRAINT uq_employees_tenant_email UNIQUE (tenant_id, email);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_employees_tenant_branch ON fsm_app.employees (tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS ix_employees_tenant_role ON fsm_app.employees (tenant_id, role);
CREATE INDEX IF NOT EXISTS ix_employees_reporting ON fsm_app.employees (reporting_to_id);

-- 3. Cross-Tenant Hierarchy Integrity Trigger
CREATE OR REPLACE FUNCTION fsm_app.validate_employee_tenant_integrity() 
RETURNS TRIGGER AS $$ 
BEGIN 
    IF NEW.reporting_to_id IS NOT NULL THEN 
        IF NOT EXISTS ( 
            SELECT 1 FROM fsm_app.employees 
            WHERE id = NEW.reporting_to_id AND tenant_id = NEW.tenant_id 
        ) THEN 
            RAISE EXCEPTION 'Integrity Error: Reporting manager must belong to the exact same tenant.'; 
        END IF; 
    END IF; 
    RETURN NEW; 
END; 
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employee_tenant_integrity ON fsm_app.employees;
CREATE TRIGGER trg_employee_tenant_integrity 
BEFORE INSERT OR UPDATE ON fsm_app.employees 
FOR EACH ROW EXECUTE FUNCTION fsm_app.validate_employee_tenant_integrity();

-- 4. Role Grants
GRANT ALL ON TABLE fsm_app.branches TO fsm_app_user;
GRANT ALL ON TABLE fsm_app.employees TO fsm_app_user;

SELECT 'Branches and employee hierarchy trigger deployed successfully' AS status;
