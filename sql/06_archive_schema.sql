-- ==============================================================================
-- 06_archive_schema.sql: Historical Archival Storage Tier Schema
-- Architecture Spec: v2.0-MultiTenant (Phase 1)
-- Target: Supabase / PostgreSQL 15+
-- ==============================================================================

-- 1. Create dedicated warm archival schema
CREATE SCHEMA IF NOT EXISTS fsm_archive;

-- 2. Grants to application role
GRANT USAGE, CREATE ON SCHEMA fsm_archive TO fsm_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA fsm_archive GRANT ALL ON TABLES TO fsm_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA fsm_archive GRANT ALL ON SEQUENCES TO fsm_app_user;

-- 3. Revoke from public roles
REVOKE ALL ON SCHEMA fsm_archive FROM anon, authenticated, public;
ALTER DEFAULT PRIVILEGES IN SCHEMA fsm_archive REVOKE ALL ON TABLES FROM anon, authenticated, public;

SELECT 'fsm_archive schema provisioned successfully' AS status;
