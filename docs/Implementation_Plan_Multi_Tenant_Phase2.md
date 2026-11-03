# Implementation Plan: Enterprise Multi-Tenant & Multi-Branch Architecture (Phase 2)

**Target System**: Field Force Master Platform  
**Architecture Spec**: [`docs/Multi-Tenant Architecture Specification (1).pdf`](file:///c:/Users/harin/Downloads/fsm/docs/Multi-Tenant%20Architecture%20Specification%20%281%29.pdf) (v2.0-MultiTenant)  
**Deliverable**: Phase 2 — Gateway & Middleware, Dynamic Session Leasing & JWT Claim Validation  
**Target Runtime**: FastAPI (Python 3.10+), SQLAlchemy 2.0 Async, asyncpg, Starlette ASGI  

---

## 1. Phase 2 Goal & Scope

Building directly on Phase 1's database schemas and RLS policies, **Phase 2** establishes the runtime request lifecycle, context resolution, session isolation, and administrative control APIs:

1. **FastAPI `MultiTenantSessionMiddleware`**:
   - Resolves tenant slug from `X-Tenant-Slug` header, `X-Tenant-ID` header, or Host subdomain.
   - Validates tenant existence and active status against `fsm_system.tenants`.
   - Fast in-memory TTL caching to avoid repeated DB hits.
   - Sets `request.state.tenant_id`, `request.state.tenant_slug`.
   - Bypasses public routes (`/health`, `/docs`, `/openapi.json`, `/`, `/admin/platform/...`).
2. **Dynamic Database Session Leasing with RLS**:
   - Enhances `get_db` dependency to automatically bind PostgreSQL session variable:
     `SET LOCAL app.current_tenant_id = '<tenant_uuid>'`
   - Automatically unbinds / clears upon connection return to pool.
3. **JWT Tenant Claim Validation**:
   - Injects `tenant_id`, `branch_id`, and `is_tenant_root_admin` into JWT access tokens.
   - Enforces cross-tenant token rejection in `get_current_employee` (tokens issued for Tenant A cannot access Tenant B endpoints).
4. **Platform Super-Admin APIs (`/admin/platform`)**:
   - `POST /admin/platform/tenants`: Provisions corporate tenant, primary HQ branch, and root admin.
   - `POST /admin/platform/tenants/{id}/branches`: Attaches regional branches under existing tenant without forking.
   - `GET /admin/platform/tenants`: Lists all corporate client organizations.
5. **Tenant Portal & Branding APIs (`/api/tenant`)**:
   - `GET /api/tenant/branding`: Returns tenant branding and dynamic vocabulary mappings.
   - `GET /api/tenant/branches`: Returns branches within the authenticated tenant.
6. **Automated Verification & Test Suite**:
   - Unit tests covering slug resolution, RLS session binding, JWT claim checks, and cross-tenant isolation.
