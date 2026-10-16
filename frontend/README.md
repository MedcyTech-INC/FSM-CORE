# FSM Master Core - Frontend PWA Shell

Client-facing Progressive Web App (PWA) presentation layer built with **React 18**, **Vite**, **TailwindCSS**, and **Zustand**.

---

## Architecture & Boundary Principles

1. **Zero Direct Database Knowledge**:
   * The frontend code contains **no database connection strings, Supabase keys, or SQL table names**.
   * All mutations and queries flow strictly through the typed backend REST API client.
2. **Responsive Hybrid Shell**:
   * Desktop view features an enterprise command sidebar.
   * Mobile view provides native-like bottom navigation tabs.
3. **Hardware Integrations**:
   * **Geolocation Hook** (`useGeolocation.ts`): Captures accurate GPS coordinates for geofence verification and anti-spoofing velocity checks.
   * **Camera Proof Hook** (`useCamera.ts`): Captures camera frames directly and formats them as Base64 image payloads in compliance with `arch.pdf`.
4. **Multi-Vertical Views**:
   * Target stops support Pharma (Doctors, Chemists), Agriculture (Farmers, Dealers), and Industrial (Facilities, Plants) with custom notes and metadata payloads.

---

## Directory Structure

```
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── src/
    ├── api/                      # Typed HTTP client to backend endpoints
    ├── types/                    # Pure DTO interfaces (zero table names)
    ├── store/                    # Zustand client state (auth, offline)
    ├── hooks/                    # Hardware hooks (camera, geolocation)
    ├── components/               # Layout wrappers and UI elements
    ├── pages/                    # Views (Dashboard, Attendance, Visits, Leaves, Tasks)
    ├── App.tsx
    └── main.tsx
```

---

## Quickstart: Local Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Launch Development Server
```bash
npm run dev
```
The app will be accessible at `http://localhost:5173`.
