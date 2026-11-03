-- ==============================================================================
-- 01_tenant_control_plane.sql: SaaS Control Plane Schema, Entitlements & Branding
-- Architecture Spec: v2.0-MultiTenant (Phase 1)
-- Target: Supabase / PostgreSQL 15+
-- ==============================================================================

-- 1. Create dedicated control plane schema
CREATE SCHEMA IF NOT EXISTS fsm_system;

-- 2. Corporate Paying Tenants
CREATE TABLE IF NOT EXISTS fsm_system.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(63) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'standard',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenants_slug UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS ix_tenants_active_slug ON fsm_system.tenants (is_active, slug);

-- 3. Dynamic Feature Entitlements per Tenant
CREATE TABLE IF NOT EXISTS fsm_system.tenant_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES fsm_system.tenants(id) ON DELETE CASCADE,
    feature_key VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_feature UNIQUE (tenant_id, feature_key)
);

CREATE INDEX IF NOT EXISTS ix_tenant_features_tenant ON fsm_system.tenant_features (tenant_id);

-- 4. Dynamic White-Label Branding & Terminology Mappings
CREATE TABLE IF NOT EXISTS fsm_system.tenant_branding (
    tenant_id UUID PRIMARY KEY REFERENCES fsm_system.tenants(id) ON DELETE CASCADE,
    brand_name VARCHAR(100) NOT NULL,
    logo_url TEXT,
    primary_color VARCHAR(20) DEFAULT '#00897B',
    terminology_mapping JSONB NOT NULL DEFAULT '{"target":"Doctor","visit":"DCR Call"}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Role Permissions: Grant read access to runtime application role
GRANT USAGE ON SCHEMA fsm_system TO fsm_app_user;
GRANT SELECT ON ALL TABLES IN SCHEMA fsm_system TO fsm_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA fsm_system GRANT SELECT ON TABLES TO fsm_app_user;

-- 6. Guard: Revoke access from Supabase PostgREST public roles
REVOKE ALL ON SCHEMA fsm_system FROM anon, authenticated, public;
ALTER DEFAULT PRIVILEGES IN SCHEMA fsm_system REVOKE ALL ON TABLES FROM anon, authenticated, public;

-- Verification
SELECT 
    'fsm_system control plane provisioned successfully' AS status,
    count(*) AS initial_tenant_count 
FROM fsm_system.tenants;
