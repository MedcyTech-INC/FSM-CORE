-- ==============================================================================
-- 03_canonical_customers.sql: Unified Customer Master
-- Architecture Spec: v2.0-MultiTenant (Phase 1)
-- Target: Supabase / PostgreSQL 15+
-- ==============================================================================

CREATE TABLE IF NOT EXISTS fsm_app.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES fsm_system.tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES fsm_app.branches(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    customer_type VARCHAR(50) NOT NULL DEFAULT 'Doctor',
    phone VARCHAR(20),
    contact_person VARCHAR(150),
    location_city VARCHAR(100),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_customers_tenant_type ON fsm_app.customers (tenant_id, customer_type);
CREATE INDEX IF NOT EXISTS ix_customers_tenant_branch ON fsm_app.customers (tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS ix_customers_tenant_active ON fsm_app.customers (tenant_id, is_active);

-- Role Grants
GRANT ALL ON TABLE fsm_app.customers TO fsm_app_user;

SELECT 'Canonical customer master created successfully' AS status;
