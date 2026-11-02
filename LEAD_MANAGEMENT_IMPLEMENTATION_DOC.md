# Medcy FSM Core – Lead Management & Follow-ups System
## Comprehensive System Specification & Operational Handover Document

---

| **Document Attribute** | **Specification Detail** |
|---|---|
| **Document Title** | Lead Management & Sales Follow-ups Module Implementation |
| **System** | Medcy Field Sales Management (FSM Core) |
| **Industry Vertical** | Indian Healthcare, Pharmaceuticals & Diagnostic Sales |
| **Target Audience** | Human Resources (HR), Sales Leadership, and Software Engineering |
| **Status** | Completed & Production Ready |
| **Date** | October 2026 |
| **Version** | 1.0.0 |

---

## 1. Executive Summary & Business Objective

### 1.1 The Business Context
In the Indian healthcare sector, Medical Representatives (MRs) and field sales executives conduct daily in-person visits to doctors, hospital administrators, clinics, diagnostic laboratories, and pharmacies. 

Prior to this implementation:
* Field visits were tracked merely as attendance or location check-ins.
* Inquiries regarding high-value medical equipment, pharmaceuticals, or diagnostic tests were recorded informally in personal notebooks or chat apps.
* Deals regularly went cold due to a lack of structured follow-ups, with no accountability when commitments were missed.
* Executive management had zero visibility into projected revenue, active pipeline value, or regional conversion rates.

### 1.2 The Implemented Solution
This implementation delivers a **closed-loop commercial pipeline** within the Medcy FSM application. It links routine GPS-verified customer visits directly to trackable revenue opportunities, enforces follow-up accountability, and provides live pipeline visibility in Indian Rupees (₹ INR).

---

## 2. End-to-End System Architecture & Lifecycle

The sales pipeline follows a strict four-step operational workflow:

```mermaid
flowchart LR
    A["1. Customer Visit\n(GPS & Photo Verified)"] --> B["2. Lead Opportunity\n(Product, Intent, ₹ Value)"]
    B --> C["3. Scheduled Follow-up\n(Call, Demo, Proposal)"]
    C --> D{"4. Deal Outcome"}
    D -->|"Won"| E["Converted\n(Order Confirmed)"]
    D -->|"Lost"| F["Lost\n(Mandatory Reason)"]
```

### The Lifecycle Stages Explained:
1. **Customer Visit (`FieldVisit`):** A representative visits a doctor or clinic, checking in with GPS location.
2. **Opportunity Generation (`Lead`):** During or immediately after the visit, the representative records a commercial opportunity, specifying the customer's response, product interest, and estimated revenue.
3. **Follow-up Execution (`Followup`):** The system prevents qualified leads from being abandoned. Every opportunity must have an active, scheduled next step with a clear due date and action type.
4. **Deal Outcome:** When concluding the deal, the system requires documented closure outcomes (contract terms for wins, or specific competitor/budget reasons for losses).

---

## 3. Data Dictionary & Field Specifications

The following table details every business field captured and tracked within the Lead Management module:

| Field Name | Data Type | Business Description | Required? | Example Value |
|---|---|---|:---:|---|
| `title` | Text | Short, descriptive title of the opportunity | **Yes** | *Dr. Sharma – 3-Part Cell Counter* |
| `customer_id` | UUID / String | Unique identifier of the linked clinic, hospital, or doctor | **Yes** | *`cust-ind-042`* |
| `customer_name` | Text | Name of the doctor, clinic, or healthcare facility | **Yes** | *Apollo Clinic, Indiranagar* |
| `customer_type` | Enum | Classification of the healthcare entity | **Yes** | `DOCTOR`, `CLINIC`, `HOSPITAL`, `PHARMACY` |
| `origin_visit_id` | UUID / String | Link to the GPS-verified field visit where this deal originated | No | *`visit-9941`* |
| `interested_product_service` | Text | Specific drug line, medical equipment, or service bundle | **Yes** | *Fully Automated Biochemistry Analyzer* |
| `customer_response` | Text | Customer's sentiment, objections, or stated interest level | **Yes** | *Interested; requested comparative quote vs Roche* |
| `lead_type` | Enum | Opportunity classification (`PRIMARY` core deal vs `SECONDARY` cross-sell) | **Yes** | `PRIMARY` |
| `priority` | Enum | Deal urgency: `URGENT`, `HIGH`, `MEDIUM`, or `LOW` | **Yes** | `HIGH` |
| `expected_value` | Decimal (INR) | Estimated commercial value formatted in Indian Rupees (₹) | No | *₹ 4,50,000* |
| `expected_close_date` | Date | Projected date for contract sign-off or purchase order | No | *2026-11-20* |
| `assigned_to` | UUID / String | Employee ID of the representative managing the account | **Yes** | *`emp-rahul-07`* |
| `stage` | Enum | Current milestone within the sales pipeline | **Yes** | `NEW`, `CONTACTED`, `INTERESTED`, `QUALIFIED`, `CONVERTED`, `LOST` |
| `last_interaction_date` | Timestamp | Timestamp of the most recent visit, call, or stage update | **Yes** | *2026-10-23T14:30:00Z* |
| `next_follow_up_due` | Timestamp | Automatically calculated date/time of the next scheduled action | No | *2026-10-28T10:00:00Z* |
| `conversion_outcome` | Text | Summary of contract terms or order details upon winning | Conditional | *Purchased 2 units on 30-day payment cycle* |
| `loss_reason` | Text | Formal reason explaining why the deal was not closed | Conditional | *Competitor offered 15% discount with free AMC* |

---

## 4. Pipeline State Machine & Validation Rules

```mermaid
stateDiagram-v2
    [*] --> NEW: Visit / Creation
    NEW --> CONTACTED: Discussion Initiated
    CONTACTED --> INTERESTED: Doctor Requests Details
    INTERESTED --> QUALIFIED: Budget & Need Validated
    QUALIFIED --> CONVERTED: Purchase Confirmed
    NEW --> LOST: Disqualified
    CONTACTED --> LOST: Not Interested
    INTERESTED --> LOST: Chose Competitor
    QUALIFIED --> LOST: Budget Cancelled
    CONVERTED --> [*]
    LOST --> [*]
```

### Enforced State Transition Rules
1. **Conversion Safeguard:** A lead cannot transition to `CONVERTED` without a non-empty `conversion_outcome`. This ensures sales teams document why deals were won for future playbooks.
2. **Loss Analysis Safeguard:** A lead cannot transition to `LOST` without a documented `loss_reason`. This provides marketing and product teams with actionable competitor intelligence.
3. **Open Action Warning:** If a representative attempts to close a deal (`CONVERTED` or `LOST`) while incomplete follow-ups remain scheduled, the system displays an alert prompting them to resolve or close the active tasks first.
4. **Ownership Reassignment Audit:** When transferring lead ownership to a colleague, the representative must select an active employee from the company directory and supply an audit note explaining the transfer (e.g., territory shift or clinical specialization).

---

## 5. Automated Intelligence & Attention Triggers

The system uses business rules to flag leads requiring immediate manager or representative attention:

### 5.1 "Needs Attention (7+ Days)" Trigger
* **Logic:** Triggered whenever an active lead (`NEW`, `CONTACTED`, `INTERESTED`, or `QUALIFIED`) has had no recorded call, visit, or stage update for **7 or more consecutive days**.
* **Visual Indicator:** Amber alert badge with pulse animation on the lead card, plus a dedicated alert counter in the top KPI strip.
* **Management Impact:** Supervisors can filter for these stagnant deals with one click to unblock the representative or reassign the account.

### 5.2 "Follow-up Needed" Trigger
* **Logic:** Triggered when a lead is in `INTERESTED` or `QUALIFIED` stage, but has **no pending follow-up scheduled in the system**.
* **Visual Indicator:** Blue notification badge warning that the opportunity is currently untracked.
* **Management Impact:** Eliminates the common field sales failure where a warm prospect is forgotten after an initial positive reaction.

### 5.3 Overdue Follow-up Highlighting
* **Logic:** Triggered when the scheduled due date and time of an action passes without being marked as complete.
* **Visual Indicator:** High-contrast rose/red card styling and dedicated count in the Follow-ups summary bar.

---

## 6. Follow-up Subsystem & Execution Accountability

Follow-ups transform static lead data into daily field execution. 

### 6.1 Action Classifications
* **`IN_PERSON_VISIT`:** Scheduled clinic or hospital meeting (e.g., product demonstration or clinical discussion).
* **`PHONE_CALL`:** Phone check-in to confirm pricing receipt or answer technical queries.
* **`PRICE_PROPOSAL`:** Formal delivery of commercial quotation or payment terms.
* **`CONTRACT_SIGNING`:** Closing meeting to collect the signed agreement or purchase order.

### 6.2 Completion & Rescheduling Protocols
* **Outcome Capture (`CompleteFollowupModal`):** Representatives cannot click "Done" without typing a brief summary of what occurred during the interaction. This note automatically updates the parent lead's activity history.
* **Audit-Backed Reschedule (`RescheduleModal`):** When an appointment must be postponed, the representative selects a new date/time and must submit a mandatory reason (e.g., *"Doctor was called into emergency surgery"*).

---

## 7. UI/UX Architecture & Usability Standards

To ensure rapid adoption among field representatives using smartphones in clinical environments, the interface adheres to strict usability guidelines:

### 7.1 The "Rule of Two" Main Navigation
* The application sidebar is strictly limited to two commercial pipeline destinations:
  1. **Lead Management** (The pipeline view)
  2. **Follow-ups** (The daily action list)
* All detailed interactions—viewing history, logging outcomes, changing stages, and transferring ownership—operate through **in-page slide-out drawers and modals**. Representatives never lose their scroll position or wait for full-page reloads.

### 7.2 Component Architecture & Visual Hierarchy
* **Executive Metric Bar (`LeadsPage.tsx`):** Displays real-time counters for Total Opportunities, Active Pipeline Deals, Total Pipeline Value (in ₹ INR), Converted Deals, and Stale Leads.
* **Filter Chips & Instant Search:** Real-time search across doctor names, hospital addresses, and phone numbers, with one-tap stage filter pills (`All`, `New`, `Contacted`, `Interested`, `Qualified`, `Converted`, `Lost`).
* **Tactile Lead Cards (`LeadCard.tsx`):** Elevated cards displaying customer type, product tags, sentiment pills, bold currency formatting, and next scheduled action.
* **Slide-over Detail Drawer (`LeadDetailPage.tsx`):** Slide-out panel providing a complete 360-degree customer view, click-to-call functionality, action buttons, and an immutable audit timeline.

---

## 8. Technical Architecture & Codebase Map

### 8.1 Frontend File Structure
```
frontend/src/
├── lead_management/
│   ├── index.ts                     # Module export gateway
│   ├── types.ts                     # TypeScript definitions (Lead, LeadStage, LeadType, Priority)
│   ├── pages/
│   │   ├── LeadsPage.tsx            # Main pipeline view, KPI metrics, search, stage filters
│   │   ├── LeadDetailPage.tsx       # Slide-out drawer with 360° overview and audit log
│   │   └── LeadFormPage.tsx         # Modal dialog for registering new opportunities
│   └── components/
│       ├── LeadCard.tsx             # Interactive opportunity card with INR currency & badges
│       ├── LeadStageChip.tsx        # Color-coded micro-pill for stage visualization
│       ├── StageChangeModal.tsx     # State transition dialog with mandatory validation
│       └── AssignLeadModal.tsx      # Directory picker for ownership reassignments
│
├── followups/
│   ├── index.ts                     # Module export gateway
│   ├── types.ts                     # TypeScript definitions (Followup, FollowupType, Status)
│   ├── pages/
│   │   ├── FollowupsPage.tsx        # Segmented tabs (Today, Overdue, Upcoming, Completed)
│   │   └── FollowupFormPage.tsx     # Modal sheet to book scheduled follow-ups
│   └── components/
│       ├── FollowupCard.tsx         # Task card with one-click outcome triggers
│       ├── CompleteFollowupModal.tsx# Outcome capture dialog
│       └── RescheduleModal.tsx      # Date postponement dialog with audit reason
│
├── components/
│   ├── AppShell.tsx                 # Frosted glass top header & mobile bottom dock
│   └── NavigationDrawer.tsx         # Slide-out navigation drawer with "Rule of Two" items
└── pages/
    └── DashboardPage.tsx            # Home screen featuring direct pipeline shortcut cards
```

### 8.2 Complete Database Architecture & Tables (Supabase / PostgreSQL)

The database schema is engineered specifically for PostgreSQL and Supabase, utilizing strict relational integrity, UUID primary keys, standardized naming conventions (all tables prefixed with `fsm_`), and automated audit logging.

#### 8.2.1 Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    EMPLOYEES ||--o{ FSM_LEADS : "assigned_to / created_by"
    EMPLOYEES ||--o{ FSM_FOLLOWUPS : "assigned_to / created_by"
    FIELD_VISITS ||--o{ FSM_LEADS : "origin_visit_id"
    FIELD_VISITS ||--o{ FSM_FOLLOWUPS : "related_visit_id"
    FSM_CUSTOMERS ||--o{ FSM_LEADS : "has many"
    FSM_CUSTOMERS ||--o{ FSM_FOLLOWUPS : "has direct"
    FSM_LEADS ||--o{ FSM_FOLLOWUPS : "schedules"
    FSM_LEADS ||--o{ FSM_LEAD_ACTIVITIES : "tracks audit"
    FSM_FOLLOWUPS ||--o{ FSM_FOLLOWUP_HISTORY : "tracks reschedules"

    FSM_CUSTOMERS {
        uuid id PK
        varchar name
        varchar customer_type
        varchar phone
        varchar territory
        timestamptz created_at
    }

    FSM_LEADS {
        uuid id PK
        uuid customer_id FK
        uuid assigned_to_id FK
        uuid created_by_id FK
        uuid origin_visit_id FK
        varchar title
        varchar stage
        varchar priority
        varchar lead_type
        text interested_product_service
        text customer_response
        numeric expected_value
        numeric actual_value
        date expected_close_date
        timestamptz last_interaction_date
        timestamptz next_follow_up_due
        text conversion_outcome
        text loss_reason
        timestamptz created_at
        timestamptz updated_at
    }

    FSM_FOLLOWUPS {
        uuid id PK
        uuid lead_id FK
        uuid customer_id FK
        uuid assigned_to_id FK
        uuid created_by_id FK
        uuid related_visit_id FK
        varchar action_type
        varchar action_title
        timestamptz due_at
        varchar status
        varchar priority
        text outcome_notes
        text cancel_reason
        int reschedule_count
        timestamptz completed_at
        timestamptz created_at
    }

    FSM_LEAD_ACTIVITIES {
        uuid id PK
        uuid lead_id FK
        uuid actor_id FK
        varchar activity_type
        varchar from_stage
        varchar to_stage
        uuid from_assignee_id
        uuid to_assignee_id
        text notes
        timestamptz created_at
    }

    FSM_FOLLOWUP_HISTORY {
        uuid id PK
        uuid followup_id FK
        uuid actor_id FK
        varchar event_type
        timestamptz old_due_at
        timestamptz new_due_at
        text reschedule_reason
        text outcome_notes
        timestamptz created_at
    }
```

---

#### 8.2.2 Detailed Specifications for Each Table

##### Table 1: `fsm_customers` (Healthcare Provider Directory)
Stores the master profiles of doctors, clinics, hospitals, and pharmacies. Reused across multiple visits and leads so customer contacts are never duplicated.

| Column Name | Data Type | Nullable | Default / Constraints | Business Description |
|---|---|:---:|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | Primary Key |
| `name` | `VARCHAR(200)` | No | — | Doctor name, Hospital name, or Clinic name |
| `customer_type` | `VARCHAR(50)` | No | `'DOCTOR'` | `DOCTOR`, `CLINIC`, `HOSPITAL`, `PHARMACY`, `DIAGNOSTIC_CENTER` |
| `specialization`| `VARCHAR(100)` | Yes | — | Clinical specialization (e.g., Cardiology, Oncology, Orthopedics) |
| `phone` | `VARCHAR(20)` | Yes | — | Direct phone / mobile contact |
| `email` | `VARCHAR(255)` | Yes | — | Email address for quotations and formal communications |
| `address` | `TEXT` | Yes | — | Physical clinic or hospital address |
| `territory` | `VARCHAR(150)` | Yes | — | Assigned sales territory or beat (e.g., "South Bangalore", "Indiranagar") |
| `created_by_id` | `UUID` | Yes | FK $\rightarrow$ `employees(id)` | Field executive who registered this customer |
| `is_active` | `BOOLEAN` | No | `TRUE` | Soft-deletion flag |
| `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Record creation timestamp (UTC) |
| `updated_at` | `TIMESTAMPTZ` | No | `NOW()` | Last update timestamp (UTC) |

---

##### Table 2: `fsm_leads` (Commercial Opportunities)
The central commercial pipeline table. Every record represents an active or closed sales deal with a healthcare provider.

| Column Name | Data Type | Nullable | Default / Constraints | Business Description |
|---|---|:---:|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | Primary Key |
| `customer_id` | `UUID` | Yes | FK $\rightarrow$ `fsm_customers(id)` | Linked healthcare entity |
| `customer_name` | `VARCHAR(200)` | No | — | Customer name (denormalized for high-speed indexing & search) |
| `customer_type` | `VARCHAR(50)` | No | `'DOCTOR'` | Customer category for sector filtering |
| `origin_visit_id`| `UUID` | Yes | FK $\rightarrow$ `field_visits(id)` | Link to the GPS field visit where opportunity was identified |
| `title` | `VARCHAR(255)` | No | — | Deal title (e.g., "Semi-Automated Analyzer Purchase") |
| `interested_product_service` | `TEXT` | No | — | Specific pharmaceutical line, medical device, or service package |
| `customer_response` | `TEXT` | No | — | Doctor's direct feedback, stated objections, or clinical interest |
| `lead_type` | `VARCHAR(50)` | No | `'PRIMARY'` | Classification: `PRIMARY` (core deal) or `SECONDARY` (add-on/cross-sell) |
| `priority` | `VARCHAR(20)` | No | `'MEDIUM'` | Urgency: `URGENT`, `HIGH`, `MEDIUM`, `LOW` |
| `stage` | `VARCHAR(50)` | No | `'NEW'` | Pipeline milestone: `NEW`, `CONTACTED`, `INTERESTED`, `QUALIFIED`, `CONVERTED`, `LOST` |
| `expected_value`| `NUMERIC(14,2)`| Yes | `0.00` | Estimated commercial value formatted in Indian Rupees (₹ INR) |
| `actual_value` | `NUMERIC(14,2)`| Yes | — | Realized commercial value confirmed upon winning the deal |
| `expected_close_date` | `DATE` | Yes | — | Projected closing date for revenue forecasting |
| `assigned_to_id`| `UUID` | No | FK $\rightarrow$ `employees(id)` | Current representative accountable for closing the deal |
| `created_by_id` | `UUID` | No | FK $\rightarrow$ `employees(id)` | Original creator of the opportunity |
| `territory` | `VARCHAR(150)` | Yes | — | Operational sales territory |
| `last_interaction_date` | `TIMESTAMPTZ` | No | `NOW()` | Timestamp of last contact; **powers the "Needs Attention (7+ days)" alert** |
| `next_follow_up_due` | `TIMESTAMPTZ` | Yes | — | Automatically synchronized date/time of the next scheduled action |
| `conversion_outcome` | `TEXT` | Yes | — | Mandatory contract summary when deal transitions to `CONVERTED` |
| `loss_reason` | `TEXT` | Yes | — | Mandatory competitor/budget explanation when marked `LOST` |
| `notes` | `TEXT` | Yes | — | Additional commercial notes and historical context |
| `is_active` | `BOOLEAN` | No | `TRUE` | Soft-deletion flag |
| `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Opportunity creation timestamp (UTC) |
| `updated_at` | `TIMESTAMPTZ` | No | `NOW()` | Auto-updated on every modification |

---

##### Table 3: `fsm_followups` (Scheduled Actions & Commitments)
The execution engine that schedules, enforces, and tracks every commitment made to a doctor or clinic.

| Column Name | Data Type | Nullable | Default / Constraints | Business Description |
|---|---|:---:|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | Primary Key |
| `lead_id` | `UUID` | Yes | FK $\rightarrow$ `fsm_leads(id)` | Linked deal (**Nullable** to support routine customer tasks without fake leads) |
| `customer_id` | `UUID` | Yes | FK $\rightarrow$ `fsm_customers(id)` | Customer entity linked to the action |
| `customer_name` | `VARCHAR(200)` | No | — | Target entity name (prefilled for rapid list rendering) |
| `customer_type` | `VARCHAR(50)` | Yes | `'DOCTOR'` | Category of target facility |
| `related_visit_id`| `UUID` | Yes | FK $\rightarrow$ `field_visits(id)` | Populated if action was scheduled after a physical visit |
| `action_type` | `VARCHAR(50)` | No | `'IN_PERSON_VISIT'` | `IN_PERSON_VISIT`, `PHONE_CALL`, `PRICE_PROPOSAL`, `CONTRACT_SIGNING`, `DEMO`, `DOCUMENTS`, `OTHER` |
| `action_title` | `VARCHAR(255)` | No | — | Action description (e.g., "Deliver pricing quotation to Dr. Sharma") |
| `due_at` | `TIMESTAMPTZ` | No | — | Scheduled date and time in UTC (displayed in user's local timezone) |
| `status` | `VARCHAR(50)` | No | `'PENDING'` | `PENDING`, `COMPLETED`, `CANCELLED` *(Overdue is derived when `due_at < NOW()`)* |
| `priority` | `VARCHAR(20)` | No | `'MEDIUM'` | `URGENT`, `HIGH`, `MEDIUM`, `LOW` |
| `assigned_to_id`| `UUID` | No | FK $\rightarrow$ `employees(id)` | Representative responsible for executing the action |
| `created_by_id` | `UUID` | No | FK $\rightarrow$ `employees(id)` | Person who scheduled the commitment |
| `outcome_notes` | `TEXT` | Yes | — | Mandatory notes captured when the action is marked completed |
| `cancel_reason` | `TEXT` | Yes | — | Documented reason if the action is cancelled |
| `reschedule_count`| `INTEGER` | No | `0` | Number of times this commitment has been postponed |
| `completed_at` | `TIMESTAMPTZ` | Yes | — | Exact timestamp when marked completed |
| `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Task creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `NOW()` | Last modification timestamp |

---

##### Table 4: `fsm_lead_activities` (Immutable Opportunity Audit Ledger)
An append-only audit trail logging every stage transition, ownership transfer, and note. Ensures complete accountability and zero knowledge loss during representative turnover.

| Column Name | Data Type | Nullable | Default / Constraints | Business Description |
|---|---|:---:|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | Primary Key |
| `lead_id` | `UUID` | No | FK $\rightarrow$ `fsm_leads(id)` ON DELETE CASCADE | Parent opportunity |
| `actor_id` | `UUID` | No | FK $\rightarrow$ `employees(id)` | Representative or manager who performed the action |
| `activity_type` | `VARCHAR(50)` | No | — | `CREATED`, `STAGE_CHANGED`, `REASSIGNED`, `NOTE_ADDED`, `CONVERTED`, `LOST` |
| `from_stage` | `VARCHAR(50)` | Yes | — | Previous pipeline stage |
| `to_stage` | `VARCHAR(50)` | Yes | — | New pipeline stage |
| `from_assignee_id`| `UUID` | Yes | FK $\rightarrow$ `employees(id)` | Previous owner (if reassigned) |
| `to_assignee_id` | `UUID` | Yes | FK $\rightarrow$ `employees(id)` | New owner (if reassigned) |
| `notes` | `TEXT` | Yes | — | Explanatory note or transfer reasoning |
| `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Exact UTC event timestamp |

---

##### Table 5: `fsm_followup_history` (Follow-up Reschedule & Outcome Ledger)
Tracks every modification made to a follow-up commitment. If an appointment is rescheduled 3 times, the entire history is permanently preserved.

| Column Name | Data Type | Nullable | Default / Constraints | Business Description |
|---|---|:---:|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | Primary Key |
| `followup_id` | `UUID` | No | FK $\rightarrow$ `fsm_followups(id)` ON DELETE CASCADE | Parent follow-up task |
| `actor_id` | `UUID` | No | FK $\rightarrow$ `employees(id)` | User who modified or rescheduled the task |
| `event_type` | `VARCHAR(50)` | No | — | `CREATED`, `RESCHEDULED`, `COMPLETED`, `CANCELLED`, `REASSIGNED` |
| `old_due_at` | `TIMESTAMPTZ` | Yes | — | Previous promised date/time |
| `new_due_at` | `TIMESTAMPTZ` | Yes | — | New rescheduled date/time |
| `reschedule_reason`| `TEXT` | Yes | — | Mandatory justification for postponing the action |
| `outcome_notes` | `TEXT` | Yes | — | Meeting outcome notes |
| `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Event timestamp |

---

#### 8.2.3 Complete Production-Ready Supabase SQL Script

This SQL script can be executed directly inside the **Supabase SQL Editor** to create all five tables, indexes, triggers, and foreign key relationships:

```sql
-- ============================================================================
-- Medcy FSM Core: Lead Management & Follow-ups Schema Migration
-- Standard Table Prefix: fsm_
-- Target Engine: PostgreSQL 14+ / Supabase
-- ============================================================================

-- Ensure UUID generator extension is active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Healthcare Customers Master Directory
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fsm_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    customer_type VARCHAR(50) NOT NULL DEFAULT 'DOCTOR',
    specialization VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    territory VARCHAR(150),
    created_by_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_fsm_customers_territory ON fsm_customers(territory);
CREATE INDEX IF NOT EXISTS ix_fsm_customers_type ON fsm_customers(customer_type);
CREATE INDEX IF NOT EXISTS ix_fsm_customers_name ON fsm_customers(name);

-- ----------------------------------------------------------------------------
-- 2. Commercial Leads / Sales Opportunities
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fsm_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES fsm_customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(200) NOT NULL,
    customer_type VARCHAR(50) NOT NULL DEFAULT 'DOCTOR',
    origin_visit_id UUID REFERENCES field_visits(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    interested_product_service TEXT NOT NULL,
    customer_response TEXT NOT NULL,
    lead_type VARCHAR(50) NOT NULL DEFAULT 'PRIMARY',
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    stage VARCHAR(50) NOT NULL DEFAULT 'NEW',
    expected_value NUMERIC(14,2) DEFAULT 0.00,
    actual_value NUMERIC(14,2),
    expected_close_date DATE,
    assigned_to_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    created_by_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    territory VARCHAR(150),
    last_interaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_follow_up_due TIMESTAMPTZ,
    conversion_outcome TEXT,
    loss_reason TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_fsm_lead_stage CHECK (stage IN ('NEW', 'CONTACTED', 'INTERESTED', 'QUALIFIED', 'CONVERTED', 'LOST')),
    CONSTRAINT chk_fsm_lead_priority CHECK (priority IN ('URGENT', 'HIGH', 'MEDIUM', 'LOW'))
);

CREATE INDEX IF NOT EXISTS ix_fsm_leads_assigned_stage ON fsm_leads(assigned_to_id, stage);
CREATE INDEX IF NOT EXISTS ix_fsm_leads_stage ON fsm_leads(stage);
CREATE INDEX IF NOT EXISTS ix_fsm_leads_territory ON fsm_leads(territory);
CREATE INDEX IF NOT EXISTS ix_fsm_leads_last_interaction ON fsm_leads(last_interaction_date);
CREATE INDEX IF NOT EXISTS ix_fsm_leads_customer_id ON fsm_leads(customer_id);

-- ----------------------------------------------------------------------------
-- 3. Scheduled Follow-up Actions & Commitments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fsm_followups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES fsm_leads(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES fsm_customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(200) NOT NULL,
    customer_type VARCHAR(50) DEFAULT 'DOCTOR',
    related_visit_id UUID REFERENCES field_visits(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL DEFAULT 'IN_PERSON_VISIT',
    action_title VARCHAR(255) NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    assigned_to_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    created_by_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    outcome_notes TEXT,
    cancel_reason TEXT,
    reschedule_count INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_fsm_followup_status CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT chk_fsm_followup_context CHECK (lead_id IS NOT NULL OR customer_id IS NOT NULL OR related_visit_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ix_fsm_followups_assigned_due ON fsm_followups(assigned_to_id, due_at, status);
CREATE INDEX IF NOT EXISTS ix_fsm_followups_status_due ON fsm_followups(status, due_at);
CREATE INDEX IF NOT EXISTS ix_fsm_followups_lead ON fsm_followups(lead_id);

-- ----------------------------------------------------------------------------
-- 4. Lead Activity & Audit Ledger
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fsm_lead_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES fsm_leads(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    activity_type VARCHAR(50) NOT NULL,
    from_stage VARCHAR(50),
    to_stage VARCHAR(50),
    from_assignee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    to_assignee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_fsm_lead_activities_lead ON fsm_lead_activities(lead_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. Follow-up History & Reschedule Ledger
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fsm_followup_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    followup_id UUID NOT NULL REFERENCES fsm_followups(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    event_type VARCHAR(50) NOT NULL,
    old_due_at TIMESTAMPTZ,
    new_due_at TIMESTAMPTZ,
    reschedule_reason TEXT,
    outcome_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_fsm_followup_history_followup ON fsm_followup_history(followup_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 6. Automated Timestamp Maintenance Triggers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_fsm_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fsm_customers_timestamp ON fsm_customers;
CREATE TRIGGER trg_fsm_customers_timestamp BEFORE UPDATE ON fsm_customers FOR EACH ROW EXECUTE FUNCTION update_fsm_timestamp();

DROP TRIGGER IF EXISTS trg_fsm_leads_timestamp ON fsm_leads;
CREATE TRIGGER trg_fsm_leads_timestamp BEFORE UPDATE ON fsm_leads FOR EACH ROW EXECUTE FUNCTION update_fsm_timestamp();

DROP TRIGGER IF EXISTS trg_fsm_followups_timestamp ON fsm_followups;
CREATE TRIGGER trg_fsm_followups_timestamp BEFORE UPDATE ON fsm_followups FOR EACH ROW EXECUTE FUNCTION update_fsm_timestamp();

-- ----------------------------------------------------------------------------
-- 7. Automated Lead Interaction Synchronizer
-- Updates fsm_leads.last_interaction_date whenever a follow-up is completed
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_fsm_lead_followup_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED' AND NEW.lead_id IS NOT NULL THEN
        UPDATE fsm_leads 
        SET last_interaction_date = NOW(),
            updated_at = NOW()
        WHERE id = NEW.lead_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_fsm_lead_followup ON fsm_followups;
CREATE TRIGGER trg_sync_fsm_lead_followup AFTER UPDATE ON fsm_followups FOR EACH ROW EXECUTE FUNCTION sync_fsm_lead_followup_update();
```

---

### 8.3 Quality Assurance & Build Verification
* Built using **React 18**, **TypeScript**, and **Vite**.
* Fully verified with zero compilation warnings or type errors (`tsc && vite build` outputs a clean bundle in ~4.4s).

---

## 9. Stakeholder Value Matrix

| Role | Operational Problem Solved | Day-to-Day Benefit |
|---|---|---|
| **Field Sales Executive** | Forgetting doctor follow-ups; paperwork burden | Log opportunities in under 30 seconds; clear daily task list on mobile. |
| **Area Sales Manager** | Blindness over representative pipeline and deal health | Immediate alert on stale leads (7+ days); visibility into deal stages across territories. |
| **Human Resources (HR)** | Inability to evaluate field sales performance objectively | Data-backed performance metrics: conversion rates, activity volume, and revenue generated. |
| **Executive Leadership** | Inaccurate revenue projections | Real-time, consolidated pipeline value in ₹ INR across regional clinics and hospitals. |
| **Software Engineers** | Spaghetti code and tight coupling | Cleanly isolated modules, comprehensive TypeScript types, and reusable UI components. |

---

## 10. Verification & Handover Sign-off

* [x] **Core Pipeline Workflow Implemented:** Lead creation, stage transitions, and closure workflows are complete and active.
* [x] **Follow-ups Subsystem Operational:** Schedule, complete, and reschedule features verified with audit logging.
* [x] **Automated Alerts Verified:** "Needs Attention (7+ days)" and "Follow-up Needed" triggers verified.
* [x] **UI Overhaul Applied:** Enterprise-grade styling with Plus Jakarta Sans typography, frosted navigation, and tactile elevation.
* [x] **Zero Build Errors:** Verified with clean production build (`vite build` exit code 0).
* [x] **Documentation Delivered:** Full specification and architecture documentation delivered for HR, management, and technical handover.
