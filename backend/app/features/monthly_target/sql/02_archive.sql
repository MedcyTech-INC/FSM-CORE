-- ==============================================================================
-- 02_archive.sql: Archive Schema, Archived Totals & Archived Ledger Table
-- Feature: Monthly Target (Phase 1 / T-25, Critic Gap P-16)
-- Table Prefix: fsm_monthly_targets_
-- Target: Supabase / PostgreSQL 15+ (Schema: fsm_archive, fsm_app)
-- ==============================================================================

-- 1. Create fsm_archive schema with strict isolation
CREATE SCHEMA IF NOT EXISTS fsm_archive;

-- Revoke all public / client access
REVOKE ALL ON SCHEMA fsm_archive FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA fsm_archive TO fsm_app_user;

-- 2. Archived Totals table in fsm_app
CREATE TABLE IF NOT EXISTS fsm_app.fsm_monthly_targets_archived_totals (
    assignment_id UUID PRIMARY KEY REFERENCES fsm_app.fsm_monthly_targets_assignments(id) ON DELETE CASCADE,
    entry_count INTEGER NOT NULL CHECK (entry_count >= 0),
    entry_sum NUMERIC(15,2) NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for archived_totals
ALTER TABLE fsm_app.fsm_monthly_targets_archived_totals ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON fsm_app.fsm_monthly_targets_archived_totals TO fsm_app_user;

-- 3. Archived Ledger Entries in fsm_archive
CREATE TABLE IF NOT EXISTS fsm_archive.fsm_monthly_targets_progress_entries (
    id UUID PRIMARY KEY,
    assignment_id UUID NOT NULL,
    source_event_id UUID NOT NULL,
    source_event_type VARCHAR(50) NOT NULL,
    entry_type fsm_app.entry_type NOT NULL,
    delta NUMERIC(15,2) NOT NULL,
    contributor_id UUID NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    business_date DATE NOT NULL,
    excluded BOOLEAN NOT NULL DEFAULT FALSE,
    excluded_reason VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes on archived ledger for historical audit / investigation
CREATE INDEX IF NOT EXISTS idx_archived_entries_assignment 
ON fsm_archive.fsm_monthly_targets_progress_entries (assignment_id, business_date);

CREATE INDEX IF NOT EXISTS idx_archived_entries_source_event 
ON fsm_archive.fsm_monthly_targets_progress_entries (source_event_id);

-- RLS and permissions for fsm_archive
ALTER TABLE fsm_archive.fsm_monthly_targets_progress_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON fsm_archive.fsm_monthly_targets_progress_entries TO fsm_app_user;

-- End of script check query
SELECT 
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'fsm_archive' AND table_name = 'fsm_monthly_targets_progress_entries') AS archive_table_exists,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'fsm_app' AND table_name = 'fsm_monthly_targets_archived_totals') AS archived_totals_exists;
