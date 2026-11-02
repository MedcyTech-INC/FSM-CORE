# FSM Master Core Platform

Enterprise-grade, client-agnostic Field Service Management (FSM) platform designed for multi-client distribution across Pharma, Healthcare, Agriculture, and Industrial verticals.

---

## Workspace Structure & Service Isolation

The repository strictly enforces service boundaries and complete folder isolation:

```
fsm/
├── backend/                  # Standalone FastAPI Modular Monolith (Python 3.10+)
│   ├── app/                  # Pure Business Logic, Auth, Dynamic TableRegistry, APIs
│   ├── scripts/              # Client DB provisioning CLI
│   ├── requirements.txt      # Isolated Python dependencies
│   ├── Dockerfile            # Isolated backend container
│   ├── .dockerignore
│   ├── .gitignore            # Independent version control ignore
│   ├── .env.example          # Independent environment schema
│   └── README.md
│
├── frontend/                 # Standalone React 18 PWA UI (Node.js 20+)
│   ├── src/                  # Pure Presentation Layer, Zustand State, HTTP Client
│   ├── package.json          # Isolated NPM dependencies
│   ├── Dockerfile            # Isolated multi-stage Nginx container
│   ├── nginx.conf
│   ├── .dockerignore
│   ├── .gitignore            # Independent version control ignore
│   ├── .env.example          # Independent environment schema
│   └── README.md
│
└── docs/                     # Reference Architecture & Design Assets
    ├── architecture/         # Target architecture specifications & reading guides
    ├── features/             # Executive analytics & feature feasibility docs
    └── screenshots/          # Baseline design system & UI references
```

---

## Architectural Isolation Principles

1. **Independent Runtimes**:
   * `backend/` and `frontend/` have zero shared files, zero relative path imports between each other, and independent dependency trees.
   * `frontend/` communicates with `backend/` strictly via typed HTTP REST APIs.
2. **Zero Hardcoded Table Names**:
   * All database table names are dynamically resolved from environment variables via `TableRegistry`.
3. **White-Label Branding**:
   * Client company names, logo initials, and portal subheadings are injected dynamically via `frontend/src/config/branding.ts` without modifying UI code.
