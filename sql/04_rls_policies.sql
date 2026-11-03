-- ==============================================================================
-- 04_rls_policies.sql: PostgreSQL Row-Level Security Policies & Role Lockdown
-- Architecture Spec: v2.0-MultiTenant (Phase 1)
-- Target: Supabase / PostgreSQL 15+
-- ==============================================================================

DO $$ 
DECLARE
    tbl TEXT;
    target_tables TEXT[] := ARRAY[
        'branches', 
        'employees', 
        'customers', 
        'office_locations', 
        'attendance', 
        'breaks', 
        'field_sessions', 
        'field_visits', 
        'leave_requests', 
        'leave_balances', 
        'tasks', 
        'expenses', 
        'leads', 
        'lead_history', 
        'followups', 
        'followup_history'
    ];
BEGIN 
    FOREACH tbl IN ARRAY target_tables LOOP
        -- Only proceed if the table exists in fsm_app
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'fsm_app' AND table_name = tbl) THEN
            
            -- Ensure tenant_id column exists
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'fsm_app' AND table_name = tbl AND column_name = 'tenant_id'
            ) THEN
                EXECUTE format('ALTER TABLE fsm_app.%I ADD COLUMN tenant_id UUID REFERENCES fsm_system.tenants(id) ON DELETE CASCADE;', tbl);
                EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON fsm_app.%I (tenant_id);', 'ix_' || tbl || '_tenant', tbl);
            END IF;

            -- Auto-populate tenant_id from active session if omitted on INSERT
            EXECUTE format('ALTER TABLE fsm_app.%I ALTER COLUMN tenant_id SET DEFAULT NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid;', tbl);

            -- Enable and force RLS
            EXECUTE format('ALTER TABLE fsm_app.%I ENABLE ROW LEVEL SECURITY;', tbl);
            EXECUTE format('ALTER TABLE fsm_app.%I FORCE ROW LEVEL SECURITY;', tbl);
            
            -- Drop existing policy if present
            EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON fsm_app.%I;', tbl);
            
            -- Apply strictly scoped tenant policy for the runtime application role
            EXECUTE format(
                'CREATE POLICY tenant_isolation_policy ON fsm_app.%I ' ||
                'FOR ALL TO fsm_app_user ' ||
                'USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''信)::uuid) ' ||
                'WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''信)::uuid);',
                tbl
            );
            
            -- Ensure fsm_app_user has all table grants
            EXECUTE format('GRANT ALL ON TABLE fsm_app.%I TO fsm_app_user;', tbl);
        END IF;
    END LOOP;
END $$;

SELECT 'Row-level security policies deployed successfully across operational tables' AS status;
