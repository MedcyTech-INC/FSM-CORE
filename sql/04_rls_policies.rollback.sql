-- ==============================================================================
-- 04_rls_policies.rollback.sql: Revert Row-Level Security Policies
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
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'fsm_app' AND table_name = tbl) THEN
            EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON fsm_app.%I;', tbl);
            EXECUTE format('ALTER TABLE fsm_app.%I NO FORCE ROW LEVEL SECURITY;', tbl);
            EXECUTE format('ALTER TABLE fsm_app.%I DISABLE ROW LEVEL SECURITY;', tbl);
        END IF;
    END LOOP;
END $$;

SELECT 'Row-level security policies rollback complete' AS status;
