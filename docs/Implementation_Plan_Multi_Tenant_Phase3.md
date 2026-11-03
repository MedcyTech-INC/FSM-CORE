# Implementation Plan: Enterprise Multi-Tenant & Multi-Branch Architecture (Phase 3)

**Target System**: Field Force Master Platform  
**Architecture Spec**: [`docs/Multi-Tenant Architecture Specification (1).pdf`](file:///c:/Users/harin/Downloads/fsm/docs/Multi-Tenant%20Architecture%20Specification%20%281%29.pdf) (v2.0-MultiTenant)  
**Deliverable**: Phase 3 — Multi-Tenant Daemon Background Workers & UI Dynamic Terminology / Branding Integration  
**Target Runtimes**: Python 3.10+ (FastAPI, SQLAlchemy Async, asyncpg) & React 18+ (Vite, TypeScript, Zustand, TailwindCSS)  

---

## 1. Phase 3 Goal & Scope

Building on the database schemas and RLS policies (Phase 1) and the request gateway, middleware, dynamic session leasing, and admin APIs (Phase 2), **Phase 3** delivers the operational background processing engine and the tenant-facing white-label UI experience:

1. **Multi-Tenant Daemon & Background Worker Protocols**:
   - Implement `MultiTenantWorkerDaemon` (`backend/app/core/workers.py`) adhering to Section 8 of the architecture specification:
     - **Tenant Iteration Loop**: Discovers all active client tenants (`fsm_system.tenants WHERE is_active = TRUE`).
     - **Atomic Session Binding**: Before executing tasks for a tenant, executes:
       `SET LOCAL app.current_tenant_id = :tenant_id`
       ensuring PostgreSQL Row-Level Security correctly scopes all table queries and mutations.
     - **Fault Containment**: Wraps each tenant execution in an isolated transaction. A processing failure in Tenant A triggers a rollback for Tenant A without aborting execution for Tenant B.
     - **Worker Tasks**:
       - `sweeper`: Outbox sweeper batching (`OutboxSweeper.sweep_pending`).
       - `reconcile`: Nightly target drift reconciliation (`TargetJobs.run_nightly_reconciliation`).
       - `closing`: Target period auto-closing (`TargetJobs.run_closing_job`).
       - `archive`: Warm tier data archiving (`TargetJobs.run_archive_job`).
       - `leakage_scan`: Inactive revenue leakage rule evaluator (`LeakageScanner.scan_all_rules`).
       - `digest`: Manager notification daily digest (`mgr.send_daily_digests`).
       - `escalate`: Unacknowledged alert escalation (`run_escalation`).
   - Create unified CLI runner script: [`backend/scripts/run_workers.py`](file:///c:/Users/harin/Downloads/fsm/backend/scripts/run_workers.py) with `--job` and optional `--tenant` flags.

2. **Frontend Dynamic Terminology & Branding Layer**:
   - Implement `useTenantStore` in [`frontend/src/store/tenantStore.ts`](file:///c:/Users/harin/Downloads/fsm/frontend/src/store/tenantStore.ts):
     - Stores tenant metadata, active branch, branding profile, and terminology dictionary.
     - Exposes `t(termKey, fallback)` helper for dynamic UI vocabulary (e.g., Doctor vs. Farmer vs. Dealer; DCR Call vs. Field Visit).
     - Injects CSS custom properties (`--brand-primary`) to dynamically theme the interface with the client's corporate palette.
   - Update [`frontend/src/api/client.ts`](file:///c:/Users/harin/Downloads/fsm/frontend/src/api/client.ts):
     - Inject `X-Tenant-Slug` header automatically into all outbound HTTP requests.
     - Add tenant client endpoints (`getTenantBranding`, `getTenantBranches`, `getTenantProfile`, `provisionTenant`).
   - Integrate with [`frontend/src/components/AppShell.tsx`](file:///c:/Users/harin/Downloads/fsm/frontend/src/components/AppShell.tsx) and key pages:
     - Render tenant brand name and active branch badge in the top navigation bar.
     - Dynamically translate page headings, subheadings, and entity selectors according to tenant terminology.

3. **Automated Verification & Test Suite**:
   - Write [`backend/tests/test_phase3_daemon_workers.py`](file:///c:/Users/harin/Downloads/fsm/backend/tests/test_phase3_daemon_workers.py) covering multi-tenant iteration, RLS binding, fault containment, and single-tenant scoping.
   - Ensure all backend unit tests pass.
