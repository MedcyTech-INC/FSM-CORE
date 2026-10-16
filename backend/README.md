# FSM Master Core - Backend Monolith

Production-grade, client-agnostic Field Service Management (FSM) core platform built with **FastAPI**, **SQLAlchemy 2.0 (Async)**, and **PostgreSQL (PostGIS)**.

---

## Key Architectural Principles

1. **Zero Hardcoded Secrets & Zero Vendor Lock-in**:
   * No Supabase URLs, keys, or client credentials are saved in this codebase.
   * Connection strings and secrets are loaded dynamically at runtime via `.env`.
2. **Zero Hardcoded Table Names**:
   * Domain models resolve database table names dynamically using `TableRegistry`.
   * Configure table names per client deployment via `.env` (e.g. `TABLE_EMPLOYEES=employees`, `TABLE_VISITS=field_visits`).
3. **Multi-Vertical Operations**:
   * Universal operational primitives support **Pharma**, **Healthcare**, **Agriculture**, and **Industrial** field operations.
   * Industry-specific metadata is persisted seamlessly via PostgreSQL `JSONB` custom fields without requiring core schema changes.
4. **FastAPI Authorization Ownership**:
   * Supabase PostgREST is bypassed for all business mutations.
   * Access control and organizational boundary isolation (MR → RSM → ZSM → GM → Admin) are enforced through recursive Common Table Expressions (CTEs).
5. **Backwards-Compatible Proof Storage**:
   * Proof images are stored as Base64 strings in PostgreSQL `TEXT` columns in compliance with `arch.pdf` to protect active pilot data.

---

## Directory Overview

```
backend/
├── app/
│   ├── config.py                 # Pydantic Settings & Dynamic TableRegistry
│   ├── main.py                   # FastAPI Application Factory, CORS & Routers
│   ├── database/
│   │   ├── base.py               # DeclarativeBase, UUIDPrimaryKeyMixin, TimestampMixin
│   │   ├── engine.py             # SQLAlchemy 2.0 Async Engine with pool settings
│   │   └── session.py            # AsyncSessionLocal & get_db dependency
│   ├── models/                   # Universal Domain Models (resolve table names from config)
│   ├── schemas/                  # Pydantic V2 Request & Response DTOs
│   ├── services/                 # Decoupled business logic (Auth, Hierarchy, Geofence, Leave)
│   ├── dependencies/             # FastApi Security Guards (JWT, Roles, Hierarchy Scope)
│   └── routers/                  # Modular Domain Routers
├── scripts/
│   └── init_client_db.py         # Automated one-command client onboarding & table generation
├── docker-compose.yml            # Local PostgreSQL 16 + PostGIS dev container
├── requirements.txt              # Pinned production dependencies
└── .env.example                  # Environment variable configuration template
```

---

## Quickstart: Local Setup

### 1. Environment Configuration
Copy the template and configure your local or client database connection:
```bash
cp .env.example .env
```

### 2. Launch Local Database (Docker)
```bash
docker compose up -d
```

### 3. Provision Client Database
Run the automated onboarding script to enable extensions, generate tables using your configured table names, and seed the initial SuperAdmin:
```bash
python scripts/init_client_db.py --admin-email admin@client.com --admin-password "SecurePass123!"
```

### 4. Run the Backend API Server
```bash
uvicorn app.main:app --reload --port 8000
```
* **Interactive API Documentation (Swagger)**: `http://localhost:8000/docs`
* **Health Check**: `http://localhost:8000/health`
