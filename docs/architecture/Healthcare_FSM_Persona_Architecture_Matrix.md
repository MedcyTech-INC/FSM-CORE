# Healthcare FSM — 4×4 Stakeholder Architecture Matrix
## Lead Management (Opportunities) & Follow-ups (Field Commitments)

---

### Executive Overview & Alignment

This architectural blueprint maps the four horizontal layers of the **FSM Master Core** platform against the four cardinal stakeholder personas in healthcare and pharmaceutical commercial operations: **Providers**, **Advisors**, **Marketers**, and **Influencers**.

Every single intersection in this matrix directly maps to **live code, database tables, business rules, and UI components** present in our codebase:
* **Backend:** FastAPI REST APIs (`/api/leads`, `/api/followups`, `/api/employees/hierarchy`), PostgreSQL schemas with immutable audit ledgers (`lead_history`, `followup_history`), and recursive Common Table Expression (CTE) authorization scoping (`HierarchyService`).
* **Frontend:** React 18 single-page architecture styled with the **Medcy Royal Purple** design system (`#6B52B6`), featuring a full-page Opportunity Workspace, an interactive Stage Stepper (`StageProgressBar`), and React Portal overlays (`createPortal`) that guarantee zero flicker and zero layout clipping.

---

### The 4×4 Master Architecture Matrix

```
┌───────────────────┬─────────────────────┬─────────────────────┬─────────────────────┬─────────────────────┐
│ LAYER             │ PROVIDERS           │ ADVISORS            │ MARKETERS           │ INFLUENCERS         │
│                   │ (Clinics/Hospitals) │ (Managers/Directors)│ (Medical Reps / FSE)│ (KOLs / Committess) │
├───────────────────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤
│ 1. Functionality  │ Reliable Proposals, │ Team Pipeline Radar,│ Rapid Visit Lead    │ Clinical Device     │
│                   │ Clinical Trials &   │ Bottleneck Radar &  │ Capture (< 30s) &   │ Demonstrations &    │
│                   │ Standalone Service  │ Subordinate Reassign│ Daily Due Radar     │ Protocol Sign-offs  │
├───────────────────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤
│ 2. UI / UX        │ Native Click-to-Call│ Desktop Multi-Column│ Mobile-First Cards, │ Clinical Demand &   │
│                   │ Triggers, Territory │ High-Density View & │ Pipeline Stepper &  │ Response Badges &   │
│                   │ & Consultation Time │ Reassignment Search │ Portal Modals       │ Priority Tagging    │
├───────────────────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤
│ 3. Application    │ 1-Customer-Many-Lead│ Recursive Tree CTE  │ Dynamic Overdue calc│ Stage-Gating Rules, │
│                   │ & Safe Closure      │ & Mandatory Closure │ & Action Outcome    │ Sentiment & History │
│                   │ Alerts (No Orphans) │ Gates (Won vs Lost) │ Enforcement         │ Transfer            │
├───────────────────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤
│ 4. Data Layer     │ `lead_customers` /  │ Subtree Visibility, │ `leads` &           │ `interested_product`│
│                   │ `target_name`,      │ `lead_history` &    │ `followups` Tables  │ & Qualitative Demo  │
│                   │ `target_type`       │ `followup_history`  │ with `assigned_to`  │ Records in History  │
└───────────────────┴─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┘
```

---

### Layer 1: Functionality Layer (What Features They Need)

#### 1. Providers (Healthcare Providers, Hospital Accounts, Clinic Doctors)
* **Time-Bound Commitment Delivery:** Healthcare providers (doctors, clinical directors, hospital administrators) require that commitments made by visiting sales representatives (quotation sheets, reagent pricing slabs, equipment lease terms) are fulfilled on time.
* **Routine Administrative Customer Care Without Pipeline Distortion:** Over 40% of representative visits involve non-sales customer service (collecting renewal forms, updated registration documents, delivering sample brochures). The system provides **standalone follow-ups** directly attached to a doctor or clinic account without forcing reps to create fake sales opportunities that artificially inflate open pipeline numbers.
* **Account Continuity Across Turnover:** If a sales territory representative resigns or transitions, the incoming representative has complete historical context so the doctor never has to re-explain their clinical requirements.

#### 2. Advisors (Branch Managers, Regional Sales Managers, Zonal Heads, Directors)
* **Unified Pipeline Coaching & Scope Filtering:** Advisors toggle between **My Scope** (direct opportunities) and **Team Scope** (all downward subordinates) to review territory pipeline health.
* **Bottleneck Radar (`⚠️ Needs Attention`):** Instant identification of stalled deals—highlighting opportunities that have remained in `INTERESTED` or `QUALIFIED` stages without a scheduled next action, or deals untouched for over 7 days.
* **Subordinate Reassignment:** Advisors can reassign deal ownership to any available representative in their downward hierarchy with a mandatory audit rationale (e.g., when a rep is on sick leave or territories are re-aligned).
* **Revenue Realization Verification:** Direct visibility into confirmed contract closures versus potential pipeline estimates.

#### 3. Marketers (Field Medical Representatives / Field Sales Officers)
* **Rapid Opportunity Capture from Beats:** Reps capture new opportunities during clinic visits in $< 30$ seconds. When concluding a visit, tapping *"Create Lead from Visit"* automatically pre-fills doctor name, clinic address, and visit cross-reference.
* **Structured Follow-up Scheduling:** Ability to commit to specific healthcare action categories:
  * `CALL` (Scheduled phone consultation)
  * `REVISIT` (Follow-up clinic meeting)
  * `QUOTATION` (Pricing sheets and contract terms)
  * `DEMO` (Clinical device demonstration)
  * `DOCUMENTS` (Regulatory and registration papers)
  * `PAYMENT` (Payment collection reminders)
* **Daily Execution Radar:** Reps prioritize their morning work list using the **Due Today** checklist and resolve high-risk items using the **Overdue** alert tab.
* **Mandatory Action Outcome Documentation:** Tapping *"Mark Done"* enforces entering an outcome description (e.g., *"Doctor approved cardiac holter pricing; requested hospital purchase meeting"*).

#### 4. Influencers (Key Opinion Leaders, Department Heads, Purchase Committees)
* **Clinical Protocol & Demonstration Tracking:** Features to schedule and document multi-stakeholder evaluations, technical product demonstrations, and clinical trial sample reviews.
* **Formal Pricing & Lease Approval Cycles:** Capturing hospital formulary review requirements and multi-tier pricing terms approved by leadership.

---

### Layer 2: UI/UX Layer (Interface & Interaction Design)

#### 1. Providers
* **Instant Communication Triggers:** Direct click-to-call links (`tel:+91...`) embedded on contact cards, allowing reps to initiate clinic calls with a single tap on mobile devices.
* **Territory & Location Badging:** Prominent badges indicating city, district, and territory ensuring accurate routing across sales beats.

#### 2. Advisors
* **High-Density Desktop Pipeline View:** Multi-column responsive layout displaying deal values formatted in standard Indian currency (`₹1,50,000`), priority chips, stage chips, and stage filter pills (`All Pipeline`, `New`, `Contacted`, `Interested`, `Qualified`, `Converted`, `Lost`, and `⚠️ Needs Attention`).
* **Interactive Directory Reassignment Search:** A searchable directory modal allowing managers to find active team members by name or role and reassign deals in two clicks.
* **Chronological Audit Timeline (`LeadTimeline`):** A dedicated, immutable activity stream displaying the full history of stage movements, ownership transfers, and notes with timestamps and user names.

#### 3. Marketers
* **Full-Page Opportunity Workspace:** Completely replaces cramped slide-out drawers with an uncluttered, full-width workspace featuring a prominent `← Back to Opportunities Pipeline` button that preserves active filters and search queries.
* **Interactive Visual Stage Stepper (`StageProgressBar`):** A horizontal progress bar guiding reps through the 5 lifecycle phases:
  $$\text{1. New Lead} \longrightarrow \text{2. Contacted} \longrightarrow \text{3. Interested} \longrightarrow \text{4. Qualified} \longrightarrow \text{5. Converted}$$
  Completed stages display brand purple checkmarks; the active stage is highlighted with subtle glow; clicking any stage triggers the Stage Change modal.
* **Flicker-Free React Portal Dialogs:** Modals (`CompleteFollowupModal`, `RescheduleModal`, `StageChangeModal`, `AssignLeadModal`) are teleported directly to `document.body` via `createPortal` with `z-[9999]`. This completely eliminates CSS `transform: translateY(-2px)` stacking context traps on card hover, preventing screen strobing.
* **Standardized Medcy Purple Theme:** Unified branding across buttons, stage chips, selection rings, and navigation icons using Medcy Royal Purple (`#6B52B6`).

#### 4. Influencers
* **Clinical Demand & Response Containers:** High-contrast callout boxes highlighting *"Interested Product / Service"* (in soft brand purple) and *"Customer Response / Demand"* (in high-contrast italicized typography).
* **Urgency Tagging:** High-priority opportunities display a distinct `HIGH PRIORITY` badge in rose tones, alerting reps to urgent committee requirements.

---

### Layer 3: Application Layer (Logic, Rules & Workflows)

#### 1. Providers
* **One Customer $\rightarrow$ Many Concurrent Opportunities:** The relational architecture allows a single doctor or hospital account to support multiple active opportunities concurrently (e.g., an equipment supply contract and a diagnostic service agreement) without creating duplicate customer accounts.
* **Closure Safety Guards:** When a lead transitions to `CONVERTED` or `LOST`, the application evaluates open follow-up actions and displays a warning banner to ensure doctor commitments are resolved.

#### 2. Advisors
* **Recursive Hierarchy Scoping (`HierarchyService`):** Role-based access control uses a server-side recursive CTE query that dynamically resolves the organizational reporting tree:
  * **MR / Field Executive:** Assigned to self or created by self.
  * **RSM / Team Lead:** Downward reporting team visibility.
  * **ZSM / Area Manager:** Territory pipeline visibility.
  * **GM / Director / Admin:** Multi-territory and global visibility.
* **Strict Closure Gating Rules:**
  * Transitioning to **`CONVERTED`** strictly requires `conversion_outcome` (confirmed terms) and `actual_value` (realized revenue).
  * Transitioning to **`LOST`** strictly requires `loss_reason` (e.g., competitor pricing, budget cancelled).
* **Reassignment Validation:** The service layer blocks reassigning a deal to oneself or to an inactive employee, and mandates an audited transfer reason.

#### 3. Marketers
* **Runtime Overdue Engine:** Scheduled follow-ups store `due_at` in UTC. The engine compares `due_at < NOW()` dynamically at runtime, ensuring tasks automatically transition from Upcoming to Due Today and Overdue based on the user's local timezone.
* **Action Outcome Enforcement:** Marking an action complete strictly requires non-empty `outcome_notes` before database persistence.
* **Pre-fill Bridge (`Visits` $\rightarrow$ `Leads`):** Linking a lead to an active `field_visit_id` copies the doctor's name, territory, and identifier, ensuring zero duplicate data entry.

#### 4. Influencers
* **Context Preservation:** All discussions, objections, and product configuration notes logged against an opportunity are appended to the immutable history ledger, ensuring no commercial context is lost during sales beat rotations.

---

### Layer 4: Data Layer (Entities, Attributes & Storage)

#### 1. Providers
* **Customer Entity Data (`lead_customers` / `target_name`):**
  * `target_name`: Doctor name or Hospital title.
  * `target_type`: `DOCTOR`, `CLINIC`, `HOSPITAL`, `FACILITY`.
  * `target_identifier`: Medical Council registration code or facility ID.
  * `location_city`, `territory`, `phone`, `is_active`.

#### 2. Advisors
* **Immutable Audit Tables:**
  * **`lead_history`:** Stores `lead_id`, `actor_id`, `event_type` (`CREATED`, `STAGE_CHANGED`, `REASSIGNED`, `CONVERTED`, `LOST`), `from_stage`, `to_stage`, `from_assignee_id`, `to_assignee_id`, `reason`, and `created_at`.
  * **`followup_history`:** Stores `followup_id`, `actor_id`, `event_type` (`CREATED`, `RESCHEDULED`, `COMPLETED`, `CANCELLED`), `old_due_at`, `new_due_at`, `reschedule_reason`, `outcome_notes`, and `created_at`.
* **Aggregated Pipeline Metrics:** Real-time SQL aggregations for total pipeline value, stage conversion counts, and average closure velocity.

#### 3. Marketers
* **Commercial Opportunity Table (`leads`):**
  * Primary Key: `id` (UUID).
  * Attributes: `title`, `lead_type`, `stage` (`NEW`, `CONTACTED`, `INTERESTED`, `QUALIFIED`, `CONVERTED`, `LOST`), `priority` (`LOW`, `MEDIUM`, `HIGH`).
  * Commercial Values: `expected_value`, `actual_value`, `expected_close_date`.
  * Ownership: `assigned_to_id`, `created_by_id`, `related_visit_id`.
* **Actionable Next Steps Table (`followups`):**
  * Primary Key: `id` (UUID).
  * Foreign Keys: `lead_id` (Nullable! Supports standalone tasks), `related_visit_id`, `assigned_to_id`, `created_by_id`.
  * Operational Attributes: `action_type`, `action_title`, `due_at` (TIMESTAMPTZ), `status` (`PENDING`, `COMPLETED`, `CANCELLED`).
  * Outcomes: `outcome_notes`, `cancel_reason`, `completed_at`.

#### 4. Influencers
* **Qualitative Demand & Configuration Fields:**
  * `interested_product_service`: Specific medical equipment model, lab assay, or pharmaceutical supply SKU.
  * `customer_response`: Direct qualitative demand, evaluation feedback, or pricing objections.
  * `custom_fields`: JSONB column allowing extensible multi-department specifications.

---

### Verification and Codebase Cross-Reference

| Codebase File / Module | Direct Architectural Connection |
|---|---|
| `backend/app/lead_management/` | Houses the `Lead` model, stage validation state machine, and `/api/leads` routers. |
| `backend/app/followups/` | Houses the `Followup` model, overdue calculation engine, and `/api/followups` routers. |
| `backend/app/services/hierarchy_service.py` | Executes recursive CTE queries for downward team RBAC scoping across all roles. |
| `frontend/src/lead_management/pages/LeadDetailPage.tsx` | Implements the full-width workspace, 2-column layout, and contact cards. |
| `frontend/src/lead_management/components/StageProgressBar.tsx` | Implements the visual pipeline stepper from `New` to `Converted`. |
| `frontend/src/followups/components/CompleteFollowupModal.tsx` | Implements React Portal (`createPortal`) modal mounting directly to `document.body`. |
| `frontend/src/config/branding.ts` & `tailwind.config.js` | Enforces the Medcy Royal Purple design system (`#6B52B6`). |

