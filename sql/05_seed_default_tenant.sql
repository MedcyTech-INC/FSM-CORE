-- ==============================================================================
-- 05_seed_default_tenant.sql: Seed Reference Tenant & Primary HQ Branch
-- Architecture Spec: v2.0-MultiTenant (Phase 1)
-- Target: Supabase / PostgreSQL 15+
-- ==============================================================================

-- 1. Insert Default Reference Tenant
INSERT INTO fsm_system.tenants (id, slug, legal_name, trade_name, subscription_tier, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'default',
    'FSM Master Enterprise Corp',
    'FSM Global Operations',
    'enterprise',
    TRUE
)
ON CONFLICT (slug) DO UPDATE 
SET legal_name = EXCLUDED.legal_name, trade_name = EXCLUDED.trade_name;

-- 2. Insert Default Feature Entitlements
INSERT INTO fsm_system.tenant_features (tenant_id, feature_key, is_enabled)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'attendance', TRUE),
    ('00000000-0000-0000-0000-000000000001', 'field_visits', TRUE),
    ('00000000-0000-0000-0000-000000000001', 'leaves', TRUE),
    ('00000000-0000-0000-0000-000000000001', 'tasks', TRUE),
    ('00000000-0000-0000-0000-000000000001', 'expenses', TRUE),
    ('00000000-0000-0000-0000-000000000001', 'analytics', TRUE),
    ('00000000-0000-0000-0000-000000000001', 'monthly_targets', TRUE),
    ('00000000-0000-0000-0000-000000000001', 'revenue_leakage', TRUE),
    ('00000000-0000-0000-0000-000000000001', 'lead_management', TRUE),
    ('00000000-0000-0000-0000-000000000001', 'followups', TRUE)
ON CONFLICT (tenant_id, feature_key) DO UPDATE 
SET is_enabled = EXCLUDED.is_enabled;

-- 3. Insert Default White-Label Branding
INSERT INTO fsm_system.tenant_branding (tenant_id, brand_name, logo_url, primary_color, terminology_mapping)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'FSM Core Platform',
    NULL,
    '#00897B',
    '{"target":"Doctor","visit":"DCR Call","customer":"Clinic/Hospital"}'::jsonb
)
ON CONFLICT (tenant_id) DO UPDATE 
SET brand_name = EXCLUDED.brand_name, terminology_mapping = EXCLUDED.terminology_mapping;

-- 4. Insert Primary HQ Branch
INSERT INTO fsm_app.branches (id, tenant_id, name, branch_code, city, is_head_office, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Corporate Headquarters',
    'HQ-MUMBAI',
    'Mumbai',
    TRUE,
    TRUE
)
ON CONFLICT (tenant_id, branch_code) DO UPDATE 
SET name = EXCLUDED.name, is_head_office = TRUE;

-- 5. Backfill existing legacy records if tenant_id is NULL
DO $$ 
DECLARE
    tbl TEXT;
    target_tables TEXT[] := ARRAY[
        'employees', 'customers', 'office_locations', 
        'attendance', 'breaks', 'field_sessions', 'field_visits', 
        'leave_requests', 'leave_balances', 'tasks', 'expenses'
    ];
BEGIN 
    FOREACH tbl IN ARRAY target_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'fsm_app' AND table_name = tbl) THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'fsm_app' AND table_name = tbl AND column_name = 'tenant_id') THEN
                EXECUTE format(
                    'UPDATE fsm_app.%I SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL;',
                    tbl
                );
            END IF;
        END IF;
    END LOOP;
END $$;

SELECT 'Default tenant and HQ branch bootstrapped successfully' AS status;
