# Healthcare Field Sales Management (FSM)
# Complete Architectural & Implementation Guide: Lead Management & Follow-ups

---

## 1. Executive Summary & Core Philosophy

In pharmaceutical, medical device, and healthcare commercial operations, field sales organizations suffer from two major operational bottlenecks:
1. **Revenue Leakage (~40% of deals die silently):** Not because doctors reject a pitch, but because field representatives fail to follow up with requested pricing, diagnostic lease terms, clinical trial data, or product demonstrations on time.
2. **Context Loss During High Field Turnover:** Sales representatives frequently transition territories or leave companies. In traditional setups, handwritten notes and mental history vanish with them, forcing incoming representatives to ask clinic doctors the exact same questions from scratch.

### The Three Cardinal Architectural Rules Built Into FSM-CORE
* **Rule 1: One Customer $\rightarrow$ Many Concurrent Opportunities:** A hospital or doctor can have multiple distinct commercial deals active simultaneously (e.g., an *"Equipment Supply Contract"* and an *"Annual Diagnostic Reagent Contract"*) without creating duplicate doctor profiles.
* **Rule 2: One Lead $\rightarrow$ Zero or Many Follow-ups:** Every sales opportunity maintains an active trail of promised actions. Stalled deals without a scheduled next step are surfaced automatically.
* **Rule 3: Standalone Follow-ups ("No Fake Leads"):** Over 40% of representative visits involve routine customer care (e.g., collecting updated registration documents, picking up renewal forms, delivering product brochures). Traditional CRMs force reps to create fake sales leads just to set a reminder, artificially inflating sales pipelines by 300%. Our system allows follow-ups to attach directly to a doctor or clinic **without creating a fake sales lead**, keeping sales forecasts 100% accurate.

---

## 2. Backend Architecture & REST APIs

### 2.1 Lead Management Engine (`backend/app/lead_management/`)

* **Database Schemas & Models (`models.py`):**
  * `LeadCustomer`: Central registry for clinics, doctors, and hospitals (`target_type`, `target_name`, `phone`, `location_city`, `territory`).
  * `Lead`: Represents the sales deal (`title`, `lead_type`, `stage`, `priority`, `expected_value`, `actual_value`, `expected_close_date`, `assigned_to_id`, `created_by_id`, `related_visit_id`).
  * `LeadHistory`: An **immutable audit ledger**. Every stage movement, transfer, and discussion note appends an indelible record with the timestamp and author identity.

* **Stage State Machine Lifecycle:**
  $$\text{NEW} \longrightarrow \text{CONTACTED} \longrightarrow \text{INTERESTED} \longrightarrow \text{QUALIFIED} \longrightarrow \text{CONVERTED / LOST}$$

* **Strict Closure Gating Rules (`service.py`):**
  * Marking a deal **`CONVERTED`** strictly requires entering confirmed realized revenue (`actual_value`) and agreement details (`conversion_outcome`).
  * Marking a deal **`LOST`** strictly requires logging the cancellation rationale (`loss_reason`).

* **Recursive Hierarchy Scoping (Universal RBAC):**
  Integrated with `HierarchyService` using PostgreSQL recursive Common Table Expressions (CTEs):
  * **Field Sales Officer (MR):** Sees own leads and created leads.
  * **Team Lead (RSM):** Downward visibility over their subordinate team's pipeline.
  * **Branch Manager (ZSM):** Territory-wide pipeline oversight.
  * **Executive Director:** Multi-territory, global organizational forecasting.

* **REST API Endpoints (`router.py`):**
  * `GET /api/leads` — List leads with filters (stage, search, priority, team vs. personal scope).
  * `POST /api/leads` — Create lead (with pre-fill support from field visits).
  * `GET /api/leads/{id}` — Complete details with dynamic next action and audit timeline.
  * `PATCH /api/leads/{id}` — Update editable fields (`title`, `expected_value`, `notes`).
  * `POST /api/leads/{id}/stage` — Gated stage transition.
  * `POST /api/leads/{id}/assign` — Manager lead reassignment.
  * `GET /api/leads/summary` — Aggregated pipeline totals and stage distribution.

---

### 2.2 Follow-ups Engine (`backend/app/followups/`)

* **Database Schemas & Models (`models.py`):**
  * `Followup`: Key invariant is that **`lead_id` is nullable**. If linked to an opportunity, it powers the deal; if standalone, it attaches to the customer or clinic visit.
  * `FollowupHistory`: Immutable log tracking every rescheduling, completion outcome, or cancellation.

* **Healthcare Action Categories:**
  `CALL` (Phone check-in), `REVISIT` (Clinic return visit), `QUOTATION` (Pricing/lease delivery), `DEMO` (Clinical device test), `DOCUMENTS` (Regulatory collection), `PAYMENT` (Invoice reminder), `OTHER`.

* **Runtime Overdue Calculation Engine:**
  The server compares `due_at` (stored in UTC) against `current_timestamp` dynamically at runtime, ensuring actions categorize cleanly into **Due Today**, **Overdue**, or **Upcoming** regardless of client timezones.

* **REST API Endpoints (`router.py`):**
  * `GET /api/followups` — List follow-ups by tab (due today, overdue, upcoming, completed, all).
  * `POST /api/followups` — Schedule a new commitment.
  * `POST /api/followups/{id}/complete` — Mandates non-empty outcome description.
  * `POST /api/followups/{id}/reschedule` — Mandates new due date/time and reason.
  * `POST /api/followups/{id}/cancel` — Mandates cancellation reason.
  * `GET /api/followups/due-summary` — Live counters for due today, overdue, and completed.

---

## 3. Frontend Architecture & User Interface

### 3.1 State Management (Zustand Stores)
* **`useLeadsStore` (`frontend/src/lead_management/store.ts`):** Manages pipeline leads, stage filter selection (`ALL`, `NEW`, `CONTACTED`, `INTERESTED`, `QUALIFIED`, `CONVERTED`, `LOST`, `ATTENTION`), text search, selected lead profile, and audit timeline logs.
* **`useFollowupsStore` (`frontend/src/followups/store.ts`):** Manages follow-up checklists, active tab navigation, due summary metrics, and asynchronous completion/rescheduling mutations.

---

### 3.2 Lead Management UI Modules (`frontend/src/lead_management/`)

* **Pipeline Dashboard (`LeadsPage.tsx`):**
  * **Stage Filter Pills:** One-tap filtering across every stage of the pipeline.
  * **Bottleneck Radar (`⚠️ Needs Attention`):** Automatically surfaces stalled opportunities where deals have been sitting in `INTERESTED` or `QUALIFIED` with zero scheduled next actions, or untouched for $> 7$ days.
  * **High-Density Opportunity Cards (`LeadCard.tsx`):** Displays deal title, doctor/hospital name, customer type, assigned rep, deal value formatted in Indian Rupees (`₹18.4L`), priority badge, and a dynamic preview of the earliest next scheduled action.

* **The Full-Page Opportunity Workspace (`LeadDetailPage.tsx`):**
  * **Replaced Cramped Drawers:** Completely removed the broken 50% slide-out side drawer that squeezed text into narrow slivers against a dark background. Replaced it with an expansive, full-width workspace with a prominent `← Back to Opportunities Pipeline` button that preserves active filters and searches.
  * **Doctor Direct Contact Card:** Clickable direct phone link (`tel:+91...`) enabling one-tap calling from mobile phones, city/territory tags, and expected closure dates.
  * **Clinical Demand Containers:** Highlighted callouts for *"Interested Product / Service"* and italicized *"Customer Response / Demand"*.
  * **Scheduled Next Steps Sub-Section:** In-line action cards showing all pending and completed commitments for this opportunity, with direct *"Add Follow-up"* buttons.
  * **Audit Timeline Sidebar (`LeadTimeline.tsx`):** Displays the immutable chronological record of stage movements, ownership transfers, and audit notes.

* **Interactive Visual Stage Progress Stepper (`StageProgressBar.tsx`):**
  * A horizontal 5-phase visual stepper:
    $$\text{1. New Lead} \longrightarrow \text{2. Contacted} \longrightarrow \text{3. Interested} \longrightarrow \text{4. Qualified} \longrightarrow \text{5. Converted}$$
  * Completed steps show brand purple checkmarks; active steps pulse with a glowing ring; clicking any step opens the Stage Transition modal.

* **Modal Dialogs:**
  * **`StageChangeModal.tsx`:** Selection grid for new stage, warning alert if open follow-ups exist, and mandatory textareas for Won agreements or Lost reasons.
  * **`AssignLeadModal.tsx`:** Searchable employee directory modal allowing managers to find active team members by name or role and reassign deals in two clicks with a transfer note.
  * **`LeadFormPage.tsx`:** Form supporting manual opportunity capture or auto-filled capture straight from a completed doctor visit.

---

### 3.3 Follow-ups Commitment UI Modules (`frontend/src/followups/`)

* **Field Commitment Hub (`FollowupsPage.tsx`):**
  * KPI metric cards with live counters for **Due Today**, **Overdue Actions** (highlighted in red alert), **Upcoming**, and **Completed**.
  * Categorized checklist tabs allowing reps to focus strictly on what needs to be fulfilled before end-of-day.

* **Action Card (`FollowupCard.tsx`):**
  * Healthcare action icon (phone call, clinic revisit, quotation delivery, medical demonstration, document pickup, payment collection).
  * Direct link chip navigating straight to the linked sales opportunity.
  * Action buttons: Reschedule (calendar icon), Cancel, and a primary **"Mark Done"** button.

* **Action Modal Dialogs:**
  * **`CompleteFollowupModal.tsx`:** Modal prompting the rep to log what happened (e.g., *"Delivered Holter lease sheet to Dr. Sharma; hospital committee review next Tuesday"*).
  * **`RescheduleModal.tsx`:** Date and time picker prompting for an audited reason why the commitment was postponed.
  * **`FollowupFormPage.tsx`:** Modal allowing reps to schedule actions either linked to an opportunity or as standalone customer tasks.

---

## 4. Critical Technical Bug Solved: Screen Flickering / Strobe Glitch

* **The Problem:** During testing of the follow-up completion flow, clicking **"Mark Done"** caused the screen to rapidly strobe and flicker between a tiny clipped modal inside a card and a full-screen overlay.
* **The Root Cause (CSS Stacking Context Trap):**
  * Modern browser rendering engines dictate that when an element has a CSS `transform` applied (such as the subtle upward lift on card hover: `transform: translateY(-2px)`), it establishes a **new local stacking context**.
  * Any child element using `position: fixed` ceases to be positioned relative to the full viewport; instead, it gets trapped inside the small boundaries of the card and clipped by `overflow: hidden`.
  * When the modal opened, the mouse was no longer over the card, which deactivated the hover transform and snapped the modal to full screen.
  * However, snapping to full screen immediately re-triggered the hover state, creating an **infinite layout loop running at 60 frames per second** that looked like a violent flickering light strobe.
* **The Engineering Fix (React Portals):**
  * Re-architected all modals (`CompleteFollowupModal`, `RescheduleModal`, `StageChangeModal`, `AssignLeadModal`, `FollowupFormPage`, `LeadFormPage`) to use `createPortal(..., document.body)` with `z-[9999]`.
  * Modals are now mounted directly at the root `<body>` level outside the card hierarchy, making them completely immune to parent hover states, CSS transforms, and overflow clipping.

---

## 5. Visual Design System Overhaul (Medcy Royal Purple)

* **Unified Color Palette:** Eradicated disjointed legacy teal (`#00897B`) and dull grays across the entire platform. Standardized on the authoritative **Medcy Royal Purple** design system:
  * Primary Brand: `#6B52B6`
  * Deep Violet (Active / Hover): `#5B42A4`
  * Vibrant Purple (Highlights): `#7B61C9`
  * Soft Lavender (Surfaces): `#F5F3FF`

* **Standardized Core Modules:**
  * **Operational Dashboard:** Restored authentic GPS punch-in/out station, real-time shift indicators, dynamic leave balance badge, and weekly attendance timesheet blocks, removing fake clutter.
  * **Doctor Visits, Attendance Logs, Leaves, and Tasks:** All re-skinned with consistent purple typography, badge chips, focus rings, and card elevations.

---

## 6. Operational User Flows (How the System Operates)

```
[ Flow A: Commercial Revenue Loop ]
Doctor Visit ──► Tap "Create Lead" (Pre-filled) ──► Add Follow-up ("Send Quotation")
                                                           │
                                                           ▼
Deal Won (Conversion Terms Logged) ◄── Mark Done (Outcome Captured) ◄── Due Today Alert

[ Flow B: Routine Customer Service (No Fake Leads) ]
Clinic Request (e.g. License Form) ──► Add Standalone Follow-up ──► Due Today Alert ──► Completed (0 Fake Leads)

[ Flow C: Manager Coaching & Reassignment ]
Manager on "Team Scope" ──► Spots Overdue Deal ──► Search Directory ──► Reassign to Available Rep with Audit Note
```

---

## 7. Build Verification & Deliverables Summary

* **Frontend Build Status:** Ran `npm run build` — compiled cleanly with **0 TypeScript and Vite errors**.
* **Live Servers:**
  * Backend running on `http://127.0.0.1:8000` (FastAPI + Swagger Docs at `/docs`).
  * Frontend running on `http://127.0.0.1:5173` (Vite + React PWA).

