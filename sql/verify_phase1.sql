-- ==============================================================================
-- verify_phase1.sql: Phase 1 Gate Verification & Security Test Suite
-- Architecture Spec: v2.0-MultiTenant (Phase 1)
-- ==============================================================================

DO $$
DECLARE
    tenant_a UUID := gen_random_uuid();
    tenant_b UUID := gen_random_uuid();
    emp_a_id UUID := gen_random_uuid();
    emp_b_id UUID := gen_random_uuid();
    trigger_passed BOOLEAN := FALSE;
    cross_email_passed BOOLEAN := FALSE;
    intra_email_blocked BOOLEAN := FALSE;
    query_count INTEGER;
BEGIN
    RAISE NOTICE '-------------------------------------------------------------';
    RAISE NOTICE 'Starting Multi-Tenant Phase 1 Gate Verification Suite';
    RAISE NOTICE '-------------------------------------------------------------';

    -- Setup: Create Test Tenants
    INSERT INTO fsm_system.tenants (id, slug, legal_name) VALUES 
        (tenant_a, 'test-tenant-a-' || substr(tenant_a::text, 1, 8), 'Test Pharma A Ltd'),
        (tenant_b, 'test-tenant-b-' || substr(tenant_b::text, 1, 8), 'Test Agri B Ltd');

    -- Setup: Insert root managers for each tenant
    INSERT INTO fsm_app.employees (id, tenant_id, email, password_hash, first_name, last_name, role) VALUES 
        (emp_a_id, tenant_a, 'manager@pharm-a.com', 'hash123', 'Manager', 'A', 'RSM'),
        (emp_b_id, tenant_b, 'manager@agri-b.com', 'hash123', 'Manager', 'B', 'RSM');

    -- Test T-4: Attempt cross-tenant reporting relationship (Should FAIL with exception)
    BEGIN
        INSERT INTO fsm_app.employees (tenant_id, email, password_hash, first_name, last_name, role, reporting_to_id)
        VALUES (tenant_a, 'rogue_subordinate@pharm-a.com', 'hash123', 'Rogue', 'Subordinate', 'MR', emp_b_id);
        
        RAISE EXCEPTION 'TEST T-4 FAILED: Cross-tenant manager relationship was erroneously permitted!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Reporting manager must belong to the exact same tenant%' THEN
            trigger_passed := TRUE;
            RAISE NOTICE '  ✔ Test T-4 PASSED: Cross-tenant reporting manager correctly blocked by trigger.';
        ELSE
            RAISE EXCEPTION 'TEST T-4 UNEXPECTED ERROR: %', SQLERRM;
        END IF;
    END;

    -- Test T-5: Cross-tenant duplicate email (Should SUCCEED because of compound key)
    BEGIN
        INSERT INTO fsm_app.employees (tenant_id, email, password_hash, first_name, last_name, role)
        VALUES (tenant_a, 'shared_email@example.com', 'hash123', 'Alice', 'TenantA', 'MR');

        INSERT INTO fsm_app.employees (tenant_id, email, password_hash, first_name, last_name, role)
        VALUES (tenant_b, 'shared_email@example.com', 'hash123', 'Bob', 'TenantB', 'MR');

        cross_email_passed := TRUE;
        RAISE NOTICE '  ✔ Test T-5 PASSED: Same email permitted across distinct tenants.';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'TEST T-5 FAILED: Duplicate email across distinct tenants failed: %', SQLERRM;
    END;

    -- Test T-6: Intra-tenant duplicate email (Should FAIL with unique violation)
    BEGIN
        INSERT INTO fsm_app.employees (tenant_id, email, password_hash, first_name, last_name, role)
        VALUES (tenant_a, 'shared_email@example.com', 'hash123', 'Duplicate', 'TenantA', 'MR');

        RAISE EXCEPTION 'TEST T-6 FAILED: Duplicate email inside the same tenant was erroneously permitted!';
    EXCEPTION WHEN unique_violation THEN
        intra_email_blocked := TRUE;
        RAISE NOTICE '  ✔ Test T-6 PASSED: Duplicate email within same tenant properly rejected.';
    END;

    -- Cleanup test data
    DELETE FROM fsm_app.employees WHERE tenant_id IN (tenant_a, tenant_b);
    DELETE FROM fsm_system.tenants WHERE id IN (tenant_a, tenant_b);

    RAISE NOTICE '-------------------------------------------------------------';
    RAISE NOTICE 'ALL PHASE 1 ARCHITECTURAL INTEGRITY CHECKS PASSED SUCCESSFULLY';
    RAISE NOTICE '-------------------------------------------------------------';
END $$;
