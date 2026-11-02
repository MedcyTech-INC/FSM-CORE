# Sales Pipeline (Leads & Follow-ups) — Architecture & Implementation Blueprint

**Module:** Sales Pipeline (Add-on 2: Lead Management + Add-on 9: Follow-ups)  
**Target Platform:** FSM Master Core (FastAPI Backend + PostgreSQL + React 18 PWA Frontend)  
**Document Version:** 3.2 (Comprehensive Business Value, Feature Flows, & Technical Architecture)  
**Navigation Group:** `Sales Pipeline` (Single unified sidebar tab with dual sub-views)

---

## 1. Executive Summary & Core Philosophy

The **Sales Pipeline** module combines **Lead Management** (commercial sales opportunities) and **Follow-ups** (actionable scheduled commitments) into **one cohesive experience**. 

Instead of forcing field staff and managers to navigate multiple fragmented screens, both capabilities operate under a single navigation item (**`Sales Pipeline`**) while maintaining clean separation in the database and business logic.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        💼 SALES PIPELINE                               │
│                                                                        │
│     [ 📋 Opportunities (Leads) ]       [ ⏰ Follow-ups (Actions) ]     │
└────────────────────────────────────────────────────────────────────────┘
```

### The Three Cardinal Architectural Rules
1. **One Customer $\rightarrow$ Many Leads:** A doctor, clinic, or hospital can have multiple concurrent opportunities (e.g., "Diagnostic Service Contract" and "ICU Equipment Supply"). Customer profiles are never duplicated.
2. **One Lead $\rightarrow$ Zero or Many Follow-ups:** A lead retains its complete historical trail of promises and scheduled actions.
3. **Standalone Follow-ups (No Fake Leads!):** Over 40% of representative field tasks are routine customer service (e.g., collecting updated registration documents, delivering sample brochures, payment reminders). **A follow-up can exist directly for an existing customer or visit without creating a fake sales lead.**

---

## 2. Business Value & Organizational Impact

Why does building this feature matter to the business? In healthcare field service management, companies often suffer from high rep turnover, stalled sales deals, and poor visibility. This unified module delivers direct organizational ROI across five pillars:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      ORGANIZATIONAL VALUE PILLARS                        │
├────────────────────┬────────────────────┬────────────────────────────────┤
│ 1. Zero Revenue    │ 2. Accurate Sales  │ 3. 100% Rep Accountability     │
│    Leakage         │    Forecasting     │    & Context Preservation      │
│ (No dropped deals) │ (Real deal value)  │ (Zero knowledge loss on churn) │
├────────────────────┴────────────────────┴────────────────────────────────┤
│ 4. Clean Operational Separation (Sales deals vs routine customer service)│
│ 5. Foundation for AI (AI Daily Sales Planning & Automated Analytics)    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1. Eliminating Revenue Leakage (Preventing Dropped Commitments)
* **The Problem:** In healthcare and pharma field sales, over **40% of commercial deals die silently** not because the doctor said "no", but because the representative forgot to follow up with the requested pricing, proposal, or demonstration.
* **The Value:** With the **"Due Today"** and **"Overdue"** engine, every promised action is surfaced automatically. Managers can view overdue actions across their entire team in one click, preventing high-value hospital accounts from going cold.

### 2. Predictable Sales Pipeline & Revenue Forecasting
* **The Problem:** Leadership often relies on verbal claims or end-of-month spreadsheets where reps guess their conversion numbers.
* **The Value:** The module separates **Estimated Pipeline Value** (potential INR in play across `NEW`, `CONTACTED`, `INTERESTED`, `QUALIFIED` stages) from **Confirmed Realized Revenue** (captured only upon `CONVERTED`). Executive Directors and GMs gain real-time, tamper-proof visibility into territory performance.

### 3. Account Continuity & Context Preservation (Combating Field Turnover)
* **The Problem:** Field representatives in medical device and pharmaceutical distribution frequently change territories or resign. When a rep leaves, their handwritten notes and mental history vanish with them, forcing the new rep to ask the doctor the same questions again.
* **The Value:** Because all discussions, visits, stage movements, and follow-up outcomes are permanently logged in the **immutable timeline**, a newly assigned rep can open a clinic's profile and immediately see the full 6-month relationship history in 30 seconds.

### 4. Protecting Pipeline Data Quality (No "Fake" Leads)
* **The Problem:** When traditional CRMs force reps to create a lead for every single task, reps create junk leads like "Dr. Sharma - Collect Tax Form" just to set a reminder. This artificially inflates open pipeline metrics by 200–300%.
* **The Value:** Standalone follow-ups allow routine administrative, sample delivery, and document collection tasks to be tracked cleanly against the customer without distorting sales conversion rates.

### 5. Seamless Bridge for AI Daily Sales Planning & Analytics
* **The Value:** Clean, structured activity data feeds directly into future AI optimization engines (e.g., AI Daily Route Planner, which ranks which doctors to visit based on open high-value leads and overdue follow-up commitments).

---

## 3. Comprehensive Feature Breakdown

### 3.1 Feature Set: Lead Management (Opportunities)
* **Rapid Opportunity Capture:** Create a lead in $< 30$ seconds with auto-fill from an active Doctor Visit.
* **Dynamic Kanban Board:** Drag-and-drop or one-tap visual progression through stages: `NEW` $\rightarrow$ `CONTACTED` $\rightarrow$ `INTERESTED` $\rightarrow$ `QUALIFIED` $\rightarrow$ `CONVERTED` / `LOST`.
* **Sortable Tabular View:** High-density table with multi-column sorting (Deal Value, Stage, Due Date, Priority).
* **Earliest Action Badge:** Every lead card dynamically displays its next pending follow-up date and action type.
* **Closure Rationale Enforcement:**
  * Marking a deal **`CONVERTED`** requires entering the confirmed business outcome and actual value.
  * Marking a deal **`LOST`** requires capturing the loss reason (e.g., "Competitor pricing lower", "Budget cancelled").
* **Subordinate Reassignment:** Managers can transfer lead ownership to any representative in their downward reporting hierarchy, with the transfer reason permanently audited.

### 3.2 Feature Set: Follow-ups (Action Hub)
* **Daily Action Checklist:** Categorized view with live counters: **Due Today**, **Overdue**, **Upcoming**, and **Completed**.
* **Healthcare Action Types:** Pre-configured action categories (`CALL`, `REVISIT`, `QUOTATION`, `DEMO`, `DOCUMENTS`, `PAYMENT`, `OTHER`).
* **One-Tap Rescheduling:** Ability to postpone an action with an audited reason without corrupting past history.
* **Completion Outcome Capture:** Marking an action done prompts for a quick outcome note (e.g., "Dr. agreed to cardiac panel demo next Friday").
* **Standalone Support:** Follow-ups can attach directly to a Doctor/Clinic or Field Visit without needing a sales deal.

### 3.3 Shared & Cross-Over Capabilities
* **Visit Log Integration:** "Create Lead" and "Add Follow-up" quick-action buttons directly on completed visit logs in [VisitsPage.tsx](file:///c:/Users/vardh/Downloads/FSM-CORE/frontend/src/pages/VisitsPage.tsx).
* **Closure Safety Guards:** Closing a lead prompts the user to resolve any remaining pending follow-up tasks.
* **Direct Deal Navigation:** Clicking a follow-up card that has a linked deal instantly opens that deal's detailed profile.

---

## 4. Operational User Flows (How They Work in Practice)

### Flow A: The Revenue Generation Loop (Visit $\rightarrow$ Lead $\rightarrow$ Follow-up $\rightarrow$ Conversion)

```
[ 1. Visit Clinic ] ──► [ 2. Tap "Create Lead" ] ──► [ 3. Add Follow-up ]
   Field rep logs          Pre-fills Doctor,            Reps schedules
   visit in DCR            territory, and visit ID      "Send Quotation"
                                                               │
                                                               ▼
[ 6. Won / Converted ] ◄── [ 5. Complete Follow-up ] ◄── [ 4. Morning Reminder ]
   Captures realized         Records outcome note         Surfaces in
   value & contract info     and customer response        "Due Today" list
```

1. **Visit:** Ravi (Field Executive) completes a scheduled visit to Dr. Kumar's Cardiology Clinic. The doctor expresses interest in partnering for diagnostic lab testing.
2. **Capture Opportunity:** In the visit completion screen, Ravi taps **"Create Lead from Visit"**. The form opens with Dr. Kumar's clinic name, address, and visit ID already pre-filled. Ravi enters the title *"Diagnostic Testing Partnership"*, sets Priority to *High*, and saves. The lead enters the `NEW` stage.
3. **Promise Next Action:** Ravi immediately taps **"Add Follow-up"**, chooses *Quotation*, sets the due date to *Tomorrow at 11:00 AM*, and adds a note *"Email standardized pricing slab"*.
4. **Action Notification:** The next morning, Ravi opens the **Follow-ups** tab. The quotation task is prominently displayed under **Due Today**.
5. **Execution & Outcome:** Ravi emails the quotation and clicks **"Mark Done"**. A dialog pops up: Ravi writes *"Sent pricing slab; doctor requested hospital director meeting on Friday"*.
6. **Deal Progression & Close:** Ravi updates the lead stage to `QUALIFIED`. Following the Friday meeting, the partnership is confirmed. Ravi marks the deal **`CONVERTED`**, inputs the expected monthly volume (₹75,000/mo), and records the contract start date.

---

### Flow B: Routine Customer Service (Follow-up Without a Lead)

```
[ 1. Customer Interaction ] ──► [ 2. Tap "Add Follow-up" ] ──► [ 3. "Due Today" Alert ]
     Routine visit or call          Selects "Collect Docs"         Surfaces on due date
     with existing hospital         (No sales lead created!)       without sales baggage
                                                                            │
                                                                            ▼
                                [ 5. Audit Trail Preserved ] ◄── [ 4. Mark Completed ]
                                     Saved in customer history       Captures confirmation
```

1. **Context:** Ravi visits City Medical Centre. They are an existing long-term client. The hospital administrator asks Ravi to collect an updated signed renewal form next Tuesday.
2. **No Lead Required:** This is routine customer care, not a new commercial sales opportunity. Ravi taps **"Add Follow-up"** $\rightarrow$ selects Target: *City Medical Centre*, Action Type: *Documents*, Due: *Next Tuesday 2:00 PM*.
3. **Execution:** On Tuesday, the task appears in Ravi's **Due Today** checklist. Ravi collects the document, uploads the confirmation note, and marks it **Completed**.
4. **Result:** The action is safely audited under the clinic's record. **Zero fake leads were created, and the company's sales conversion metrics remained 100% accurate.**

---

### Flow C: Manager Pipeline Coaching & Territory Reassignment

```
[ 1. Manager Views Pipeline ] ──► [ 2. Spots Overdue Deal ] ──► [ 3. Reassign to Rep B ]
     Selects "Team Scope"              Deal has 2 overdue             Reps A is on sick leave;
     on Sales Pipeline page            follow-ups                     reassigns to Rep B
                                                                              │
                                                                              ▼
[ 6. Zero Disruption ] ◄── [ 5. Full Context Retained ] ◄── [ 4. Notification & Audit ]
     Deal moves forward         Rep B reads entire past          Transfer reason logged
     without delays             timeline in 1 minute             in immutable ledger
```

1. **Oversight:** Priya (Team Lead / RSM) logs into the web console on Monday morning and toggles her scope filter from *My Leads* to **Team Pipeline**.
2. **Identification:** She notices a ₹2,00,000 equipment opportunity at Apollo Clinic has an **Overdue Follow-up** (due 4 days ago) assigned to Amit, who is currently out on medical leave.
3. **Reassignment:** Priya clicks into the deal $\rightarrow$ taps **"Reassign"** $\rightarrow$ selects Suresh (available representative in that territory) $\rightarrow$ enters reason *"Amit on medical leave; urgent quote required by clinic board"*.
4. **Immediate Handoff:** Suresh opens his app, sees the lead in his pipeline, reads the full activity history, and fulfills the quotation task that same afternoon.

---

## 5. Technical System Architecture

```
                   [ Field Rep / Manager (React PWA) ]
                                   │
                                   │ Single Sidebar Item: "Sales Pipeline"
                                   ▼
         ┌───────────────────────────────────────────────────┐
         │              SalesPipelinePage.tsx                │
         │  ┌───────────────────────┬──────────────────────┐ │
         │  │ Opportunities Sub-Tab │ Follow-ups Sub-Tab   │ │
         │  │ (Kanban / Table View) │ (Today/Overdue/Tabs) │ │
         │  └───────────────────────┴──────────────────────┘ │
         └─────────────────────────┬─────────────────────────┘
                                   │
                                   │ REST APIs (Bearer JWT)
                                   ▼
                   [ FastAPI Application Routers ]
                      ├── /api/leads
                      └── /api/followups
                                   │
                   [ Service & Authorization Layer ]
                      ├── HierarchyService (Recursive CTE Scoping)
                      ├── LeadService (Stage Transitions & Audits)
                      └── FollowUpService (Due calculation & Outcomes)
                                   │
                                   ▼
                   [ PostgreSQL Dynamic Tables ]
                      ├── TABLE_LEADS (leads)
                      ├── TABLE_FOLLOWUPS (followups)
                      ├── TABLE_LEAD_HISTORY (lead_history)
                      └── TABLE_FOLLOWUP_HISTORY (followup_history)
```

---

## 6. Database Architecture & Native Schema Design

In FSM-CORE:
* **Zero Hardcoded Table Names:** All table names are dynamically resolved from environment variables via `TableRegistry`:
  * `TABLE_LEADS` $\rightarrow$ default `"leads"`
  * `TABLE_FOLLOWUPS` $\rightarrow$ default `"followups"`
  * `TABLE_LEAD_HISTORY` $\rightarrow$ default `"lead_history"`
  * `TABLE_FOLLOWUP_HISTORY` $\rightarrow$ default `"followup_history"`
* **Client Isolation:** Multi-tenancy is handled at the dedicated database level (no redundant `organization_id` on every table).
* **Target Consistency:** Targets align with `FieldVisit` entity patterns (`target_type`, `target_name`, `target_identifier`).
* **Territory Scoping:** Territory aligns with `Employee.territory`.

---

### 6.1 Table 1: `leads` (Commercial Opportunities)

| Column Name | Type | Nullable | Description & Invariants |
|---|---|---|---|
| `id` | `UUID` | No | Primary Key (`uuid_generate_v4()`). |
| `target_type` | `VARCHAR(50)` | No | `DOCTOR`, `CLINIC`, `HOSPITAL`, `CHEMIST`, `FARMER`, `DEALER`, `FACILITY`. |
| `target_name` | `VARCHAR(200)` | No | Name of Doctor, Clinic, Hospital, or Facility. |
| `target_identifier`| `VARCHAR(100)` | Yes | Registration code, Doctor code, or Facility ID. |
| `territory` | `VARCHAR(150)` | Yes | Geographical area / sales beat (inherits from rep if omitted). |
| `title` | `VARCHAR(255)` | No | Opportunity title (e.g., "Diagnostic Partnership - Cardiac"). |
| `lead_type` | `VARCHAR(100)` | No | `HOSPITAL_SERVICE`, `MEDICINE_SUPPLY`, `EQUIPMENT`, `PARTNERSHIP`. |
| `source` | `VARCHAR(50)` | No | `FIELD_VISIT`, `ASHA_ENCOUNTER`, `REFERRAL`, `INBOUND`, `DIRECT`, `MANUAL`. |
| `stage` | `VARCHAR(50)` | No | `NEW`, `CONTACTED`, `INTERESTED`, `QUALIFIED`, `CONVERTED`, `LOST`. |
| `priority` | `VARCHAR(20)` | No | `LOW`, `MEDIUM`, `HIGH`. Default: `MEDIUM`. |
| `assigned_to_id` | `UUID` | No | FK $\rightarrow$ `employees.id`. Current responsible employee. |
| `created_by_id` | `UUID` | No | FK $\rightarrow$ `employees.id`. Original creator. |
| `related_visit_id`| `UUID` | Yes | FK $\rightarrow$ `field_visits.id`. Pre-filled if spawned from a visit. |
| `expected_value` | `NUMERIC(14,2)`| Yes | Estimated potential opportunity value (INR). |
| `actual_value` | `NUMERIC(14,2)`| Yes | Confirmed realized value (mandatory on `CONVERTED`). |
| `expected_close_date` | `DATE` | Yes | Target closure date. |
| `conversion_outcome` | `TEXT` | Yes | Mandatory when stage transitions to `CONVERTED`. |
| `loss_reason` | `TEXT` | Yes | Mandatory when stage transitions to `LOST`. |
| `notes` | `TEXT` | Yes | Discussion notes and commercial context. |
| `custom_fields` | `JSONB` | Yes | Multi-vertical extensible attributes. |
| `is_active` | `BOOLEAN` | No | Soft-delete flag (Default: `TRUE`). |
| `created_at` | `TIMESTAMPTZ`| No | UTC creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| No | UTC last update timestamp. |

**Indexes:**
* `ix_leads_assigned_stage`: Composite index on `(assigned_to_id, stage)` for instant dashboard loading.
* `ix_leads_territory`: Index on `territory` for regional reporting.
* `ix_leads_target_name`: B-Tree index on `target_name` for autocomplete.

---

### 6.2 Table 2: `followups` (Actionable Next Steps)

| Column Name | Type | Nullable | Description & Constraints |
|---|---|---|---|
| `id` | `UUID` | No | Primary Key (`uuid_generate_v4()`). |
| `lead_id` | `UUID` | **Yes** | FK $\rightarrow$ `leads.id`. **Nullable!** (Populated if linked to a lead). |
| `target_type` | `VARCHAR(50)` | Yes | `DOCTOR`, `CLINIC`, `HOSPITAL`, etc. |
| `target_name` | `VARCHAR(200)` | No | Name of Target Clinic / Doctor / Facility. |
| `target_identifier`| `VARCHAR(100)` | Yes | Doctor Code / Registration ID. |
| `territory` | `VARCHAR(150)` | Yes | Operational territory. |
| `related_visit_id`| `UUID` | Yes | FK $\rightarrow$ `field_visits.id`. If created after a visit. |
| `action_type` | `VARCHAR(50)` | No | `CALL`, `REVISIT`, `QUOTATION`, `DEMO`, `DOCUMENTS`, `PAYMENT`, `OTHER`. |
| `action_title` | `VARCHAR(255)` | No | What needs to be done (e.g., "Submit revised pricing proposal"). |
| `due_at` | `TIMESTAMPTZ`| No | Due date and time in UTC (displayed in user's local timezone). |
| `status` | `VARCHAR(50)` | No | `PENDING`, `COMPLETED`, `CANCELLED`. *(Overdue is derived at runtime)*. |
| `priority` | `VARCHAR(20)` | No | `LOW`, `MEDIUM`, `HIGH`. Default: `MEDIUM`. |
| `assigned_to_id` | `UUID` | No | FK $\rightarrow$ `employees.id`. Person responsible for completing action. |
| `created_by_id` | `UUID` | No | FK $\rightarrow$ `employees.id`. Person who scheduled the action. |
| `outcome_notes` | `TEXT` | Yes | Required upon marking `COMPLETED`. |
| `cancel_reason` | `TEXT` | Yes | Required upon marking `CANCELLED`. |
| `completed_at` | `TIMESTAMPTZ`| Yes | UTC timestamp when marked completed. |
| `created_at` | `TIMESTAMPTZ`| No | UTC creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| No | UTC last update timestamp. |

**Key Invariant:** Every `followup` record must have **at least one valid context**: either `lead_id` IS NOT NULL, or `target_name` / `related_visit_id` IS NOT NULL. No orphan tasks.

---

### 6.3 Tables 3 & 4: Immutable Audit Ledgers

#### `lead_history`
Appends a snapshot on every lead event:
* `lead_id`, `actor_id`, `event_type` (`CREATED`, `STAGE_CHANGED`, `REASSIGNED`, `CONVERTED`, `LOST`, `REOPENED`).
* `from_stage`, `to_stage`, `from_assignee_id`, `to_assignee_id`, `reason`, `created_at`.

#### `followup_history`
Appends a snapshot on every follow-up change:
* `followup_id`, `actor_id`, `event_type` (`CREATED`, `RESCHEDULED`, `COMPLETED`, `CANCELLED`, `REASSIGNED`).
* `old_due_at`, `new_due_at`, `reschedule_reason`, `outcome_notes`, `created_at`.

---

## 7. Security & Role Scoping (Universal RBAC)

Both Leads and Follow-ups enforce server-side downward tree filtering using the existing recursive CTE in [HierarchyService](file:///c:/Users/vardh/Downloads/FSM-CORE/backend/app/services/hierarchy_service.py):

| Role | Leads Visible | Follow-ups Visible | Allowed Actions |
|---|---|---|---|
| **MR / Field Executive** | Assigned to self or created by self. | Assigned to self or created by self. | Create, edit, complete follow-ups, change stages. Cannot reassign to others. |
| **RSM / Team Lead** | Leads within downward team. | Follow-ups within downward team. | View team pipeline, coach reps, manage overdue, reassign within team. |
| **ZSM / Area Manager** | Leads within assigned territory. | Follow-ups within assigned territory. | Territory pipeline oversight, reassign across teams, monitor conversion. |
| **GM / Senior Ops** | Regional & multi-territory scope. | Regional & multi-territory scope. | Regional comparison, high-value lead oversight. |
| **ADMIN** | All records across client database. | All records across client database. | Global analytics, organizational pipeline audits. |

---

## 8. Unified REST API Contracts

### 8.1 Lead Endpoints (`/api/leads`)
* `GET /api/leads` — List leads with role-based scoping, search, stage, and priority filters.
* `POST /api/leads` — Create lead (with optional `related_visit_id` pre-fill).
* `GET /api/leads/{id}` — Lead details with dynamic `next_follow_up` and full timeline.
* `PATCH /api/leads/{id}` — Update editable fields (`title`, `expected_value`, `notes`).
* `POST /api/leads/{id}/stage` — Change stage (enforces outcome on `CONVERTED` / reason on `LOST`).
* `POST /api/leads/{id}/assign` — Manager reassigns lead to another representative.
* `GET /api/leads/summary` — Pipeline KPI metrics (total open, stage counts, expected vs actual value).

### 8.2 Follow-up Endpoints (`/api/followups`)
* `GET /api/followups` — List follow-ups with filter tabs:
  * `tab`: `"due_today"`, `"overdue"`, `"upcoming"`, `"completed"`, `"all"`.
  * `scope`: `"MY_ACTIONS"` or `"TEAM_ACTIONS"`.
  * `lead_id`: (Optional) Filter follow-ups linked to a specific lead.
* `POST /api/followups` — Create follow-up (supports `lead_id` OR standalone `target_name`/`visit_id`).
* `POST /api/followups/{id}/complete` — Mark action completed (requires `outcome_notes`).
* `POST /api/followups/{id}/reschedule` — Change due date/time (requires `new_due_at`, optional `reason`).
* `POST /api/followups/{id}/cancel` — Cancel action (requires `cancel_reason`).
* `POST /api/followups/{id}/assign` — Reassign follow-up to another representative.
* `GET /api/followups/summary` — Quick counts for dashboard (`due_today_count`, `overdue_count`, `upcoming_count`).

---

## 9. Frontend User Experience (One Unified Tab)

### 9.1 Single Navigation Item
In [NavigationDrawer.tsx](file:///c:/Users/vardh/Downloads/FSM-CORE/frontend/src/components/NavigationDrawer.tsx):
* **Tab ID:** `'sales'`
* **Label:** `'Sales Pipeline'`
* **Icon:** `Briefcase` or `TrendingUp` from `lucide-react`
* **Route in `App.tsx`:** `<SalesPipelinePage />`

---

### 9.2 Screen Layout: `SalesPipelinePage.tsx`

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  💼 Sales Pipeline                                         [ + New Lead ] [ + Action ] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Top Sub-Tabs:                                                                         │
│  [ 💼 Opportunities (14) ]          [ ⏰ Follow-ups (5 Due Today / 1 Overdue) ]        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  IF [ Opportunities ] IS ACTIVE:                                                       │
│  ├── KPI Strip: [ Total Pipeline: ₹12.5L ] [ Open: 14 ] [ Qualified: 5 ] [ Won: 3 ]    │
│  ├── Filter Bar: [ Search... ] [ View: Kanban | Table ] [ Scope: My Leads | Team ]     │
│  └── View: Kanban Board Columns (NEW -> CONTACTED -> INTERESTED -> QUALIFIED -> WON)  │
│                                                                                        │
│  IF [ Follow-ups ] IS ACTIVE:                                                          │
│  ├── Action Tabs: [ Due Today (5) ] [ Overdue (1) ] [ Upcoming (8) ] [ Completed ]     │
│  ├── Action Cards:                                                                     │
│  │   ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │   │ 🔴 OVERDUE • Due Yesterday 4:00 PM                         [ Call Doctor ]   │  │
│  │   │ Dr. Kumar's Clinic • Send diagnostic service quotation                       │  │
│  │   │ 🏷️ Linked Deal: Diagnostic Partnership (Cardiology)                           │  │
│  │   │ [ Mark Done ]  [ Reschedule ]                                                │  │
│  │   └──────────────────────────────────────────────────────────────────────────────┘  │
│  │   ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │   │ 🟡 DUE TODAY • 11:30 AM                                    [ Collect Docs ]  │  │
│  │   │ City Medical Centre • Collect updated registration certificate               │  │
│  │   │ 🏥 Customer Task (No Sales Deal Required)                                    │  │
│  │   │ [ Mark Done ]  [ Reschedule ]                                                │  │
│  │   └──────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Practical Step-by-Step Build Order

1. **Phase 1: Database & Model Layer (Backend)**
   * Add `TABLE_LEADS`, `TABLE_FOLLOWUPS`, `TABLE_LEAD_HISTORY`, `TABLE_FOLLOWUP_HISTORY` to `TableRegistry` in [backend/app/config.py](file:///c:/Users/vardh/Downloads/FSM-CORE/backend/app/config.py).
   * Create `backend/app/models/lead.py`, `lead_history.py`, `followup.py`, `followup_history.py`.
   * Register all in `backend/app/models/__init__.py`.
2. **Phase 2: Schemas & Services (Backend)**
   * Create `backend/app/schemas/lead.py` and `followup.py`.
   * Create `backend/app/services/lead_service.py` and `followup_service.py` with downward hierarchy scoping.
3. **Phase 3: REST API Routers (Backend)**
   * Create `backend/app/routers/leads.py` and `followups.py`.
   * Mount both routers in [backend/app/main.py](file:///c:/Users/vardh/Downloads/FSM-CORE/backend/app/main.py).
4. **Phase 4: Frontend State & API Client (Frontend)**
   * Define TypeScript interfaces in `frontend/src/types/sales.ts`.
   * Add typed API methods to [frontend/src/api/client.ts](file:///c:/Users/vardh/Downloads/FSM-CORE/frontend/src/api/client.ts) (with mock demo support).
   * Create `frontend/src/store/salesStore.ts` using Zustand.
5. **Phase 5: Unified Frontend Page & Components (Frontend)**
   * Create `frontend/src/pages/SalesPipelinePage.tsx` with the dual sub-tab switcher.
   * Build child views: `OpportunitiesView.tsx`, `FollowUpsView.tsx`, `LeadDetailDrawer.tsx`, modals.
   * Register `'sales'` in [NavigationDrawer.tsx](file:///c:/Users/vardh/Downloads/FSM-CORE/frontend/src/components/NavigationDrawer.tsx) and [App.tsx](file:///c:/Users/vardh/Downloads/FSM-CORE/frontend/src/App.tsx).
   * Add quick actions into [VisitsPage.tsx](file:///c:/Users/vardh/Downloads/FSM-CORE/frontend/src/pages/VisitsPage.tsx).

---

## 11. Definition of Done Checklist

* [ ] Only **ONE** clean tab ("Sales Pipeline") appears in the navigation drawer.
* [ ] Switching between "Opportunities" and "Follow-ups" happens instantly without reloading the page.
* [ ] A representative can create a lead from a doctor visit with known info pre-filled.
* [ ] A representative can schedule a follow-up for a doctor **without** being forced to create a lead.
* [ ] A lead card displays its earliest pending follow-up date.
* [ ] Overdue items visibly show as **Overdue** without corrupting the saved database status.
* [ ] Completing a follow-up requires capturing an outcome note and does **not** auto-convert the lead.
* [ ] Converting a lead requires capturing the confirmed outcome and value.
* [ ] All stage changes, reassignments, completions, and reschedules appear in chronological audit timelines.
* [ ] Field representatives cannot see another representative's records; managers see their full downward team.
