-- ==============================================================================
-- 00_foundation.sql: FSM Core Foundation Schema, Roles, Security & Shared Holidays
-- Revision: Revision 4 (Monthly Target & Revenue Leakage Implementation Plan)
-- Target: Supabase / PostgreSQL 15+
-- ==============================================================================

-- 1. Create isolated application schema (never exposed to Supabase PostgREST API)
CREATE SCHEMA IF NOT EXISTS fsm_app;

-- 2. Create application runtime role if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fsm_app_user') THEN
        CREATE ROLE fsm_app_user WITH LOGIN PASSWORD 'ChangeMeInProductionSecret123!';
    END IF;
END $$;

-- 3. Grant schema permissions to application user
GRANT USAGE, CREATE ON SCHEMA fsm_app TO fsm_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA fsm_app GRANT ALL ON TABLES TO fsm_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA fsm_app GRANT ALL ON SEQUENCES TO fsm_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA fsm_app GRANT ALL ON FUNCTIONS TO fsm_app_user;

-- 4. Critic Gap P-1: Revoke all access from Supabase PostgREST public roles
REVOKE ALL ON SCHEMA fsm_app FROM anon, authenticated, public;
ALTER DEFAULT PRIVILEGES IN SCHEMA fsm_app REVOKE ALL ON TABLES FROM anon, authenticated, public;
ALTER DEFAULT PRIVILEGES IN SCHEMA fsm_app REVOKE ALL ON SEQUENCES FROM anon, authenticated, public;
ALTER DEFAULT PRIVILEGES IN SCHEMA fsm_app REVOKE ALL ON FUNCTIONS FROM anon, authenticated, public;

-- 5. Shared Holidays Table (Decision D4 - shared between Monthly Target & Revenue Leakage)
CREATE TABLE IF NOT EXISTS fsm_app.holidays (
    holiday_date DATE PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    region VARCHAR(50) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row-Level Security with no public policy (P-1 second guard)
ALTER TABLE fsm_app.holidays ENABLE ROW LEVEL SECURITY;

-- Grant access on holidays table to application user
GRANT ALL ON TABLE fsm_app.holidays TO fsm_app_user;

-- 6. Seed Default Standard 2026 Holidays (Indian National / Standard Corporate Holidays)
INSERT INTO fsm_app.holidays (holiday_date, name, region) VALUES
    ('2026-01-26', 'Republic Day', 'National'),
    ('2026-03-03', 'Holi', 'National'),
    ('2026-03-21', 'Id-ul-Fitr (Eid)', 'National'),
    ('2026-04-03', 'Good Friday', 'National'),
    ('2026-04-14', 'Dr. Ambedkar Jayanti', 'National'),
    ('2026-05-01', 'May Day / Labor Day', 'National'),
    ('2026-05-27', 'Bakrid / Eid al-Adha', 'National'),
    ('2026-08-15', 'Independence Day', 'National'),
    ('2026-09-04', 'Janmashtami', 'National'),
    ('2026-10-02', 'Mahatma Gandhi Jayanti', 'National'),
    ('2026-10-20', 'Dussehra / Vijaya Dashami', 'National'),
    ('2026-11-08', 'Diwali / Deepavali', 'National'),
    ('2026-12-25', 'Christmas Day', 'National')
ON CONFLICT (holiday_date) DO UPDATE 
SET name = EXCLUDED.name, region = EXCLUDED.region;

-- 7. Verification check query
SELECT 
    'Foundation verification successful' AS status,
    schema_name,
    (SELECT count(*) FROM fsm_app.holidays) AS holiday_count
FROM information_schema.schemata 
WHERE schema_name = 'fsm_app';
