# FSM Architecture Spec: Monthly Target & Revenue Leakage

This document specifies the requirements and technical design for two new modules of the Enterprise Healthcare HRMS & Field Operations platform, built on a Python (FastAPI, SQLAlchemy, PostgreSQL) backend.

**Revision 2, 19 October 2026.** Updated after the engineering design review of Revenue Leakage Detection: alerts are now operational warnings rather than loss figures, and the alert lifecycle, history and scan reliability are specified. Monthly Target needed no changes. Section 10.2 lists every change.

**Revision 4, 22 October 2026.** Database changes now use plain SQL scripts that the product owner runs by hand in the Supabase SQL editor, so Alembic is removed. Frontend and UI/UX are added (section 4): the new screens must match the existing React app. Every feature keeps all its files in its own folder, and shared files such as `.env` stay outside. Tables, business rules, APIs and events are unchanged.

**Revision 3, 22 October 2026.** Brought level with the two implementation plans. The critic fixes and the six engineering clarifications are folded in. New tables and columns are in 5.5, archive and retention in 6.8, and API and contract additions in 7.5. For column-by-column definitions, build order and tests, use the plans: the Monthly Target plan (`Implementation_Plan_Monthly_Target.md`) and the Revenue Leakage plan (`Implementation_Plan_Revenue_Leakage_Detection.md`). Where the two documents differ on a build detail, the plans are newer.

## 1. Purpose and scope

Monthly Target ties daily field activity to business goals; Revenue Leakage Detection flags warning signs that may point to lost revenue. Monthly Target is built first; Leakage follows once enough data exists.

|  | Monthly Target | Revenue Leakage Detection |
| --- | --- | --- |
| Goal | Show reps and managers the gap to target while there is still time to close it | Flag operational warnings, such as an unvisited key customer or a stalled lead, so managers can investigate before revenue is affected |
| Priority | Phase 1 (build now) | Later phase (needs 6 to 12 months of history) |
| Main users | Managers assign; field officers view progress | Branch Managers and RSMs review and act on alerts |
| Feeds | AI Daily Sales Plan, Analytics, Leakage | AI Daily Sales Plan, Analytics, manager tasks |

**In scope:** database design, backend services, APIs, events and integration contracts for both modules. **Out of scope:** the AI Daily Sales Plan, Lead Management, Follow-ups, Analytics and Expense modules, which other teams own and which only integrate with these two.

**Platform context:** a mobile-first PWA (React frontend) with a 5-tier hierarchy: Executive Director, Senior Manager, Branch Manager, Team Lead/RSM, Field Officer. The backend for these modules is custom Python (FastAPI). Supabase is used only as the hosted PostgreSQL database on the team's own server, with no Edge Functions or other backend-as-a-service features. The database is changed only by numbered SQL scripts run by hand in the Supabase SQL editor; no migration tool such as Alembic is used. The frontend is the existing React app, and the new screens reuse its components and theme.

## 2. Requirements phase

Progress must update the moment a field action happens, and leakage scanning must never slow daytime traffic. Requirements below are numbered so tests and tickets can reference them.

### 2.1 Monthly Target: functional

| ID | Requirement |
| --- | --- |
| MT-F1 | A manager can create a target with a title, metric type, target value, start date and end date. |
| MT-F2 | A target can be assigned to a representative, team, territory, customer or product (one or many assignees). |
| MT-F3 | Supported metrics: revenue, doctor visits, new leads, conversions, collections. Counts are whole numbers; revenue and collections are decimals. |
| MT-F4 | Progress updates automatically when a qualifying event occurs (visit completed, lead created or converted, order closed, payment collected). |
| MT-F5 | A representative sees progress, remaining gap, days left and required daily run rate for each active target. |
| MT-F6 | Managers see progress for everyone in their scope. |
| MT-F7 | A read endpoint returns gap and run rate in a fixed format for the AI Daily Sales Plan. |

### 2.2 Revenue Leakage: functional

| ID | Requirement |
| --- | --- |
| RL-F1 | Detect five conditions as operational warnings: unvisited high-value customer, abandoned lead, declining purchase frequency, inactive opportunity, underperforming territory. Each alert states what was observed, not a conclusion about lost revenue. |
| RL-F2 | Thresholds (days, value) are configurable per rule and rules can be switched on or off. |
| RL-F3 | Each alert has a classification (operational warning in this release) and an attention priority of low, medium or high, with the reason shown. |
| RL-F4 | A money amount appears on an alert only when its source and basis can be stated; otherwise the alert shows the actual deviation. Amounts are never added together across alerts. |
| RL-F5 | At most one unresolved alert (active or acknowledged) exists per rule and entity; a re-scan updates it. The database enforces this. |
| RL-F6 | Each alert keeps its first-detected time, last-observed time, changes in evidence and every manager action. |
| RL-F7 | When a resolved condition returns, the alert follows an agreed recurrence rule and earlier history is kept. |
| RL-F8 | Managers can acknowledge, resolve or dismiss an alert with an outcome (normal variation, investigation needed, corrective action taken, or commercial outcome evidenced) and notes. |
| RL-F9 | A lead or opportunity is marked Lost only when the customer outcome is documented; inactivity alone never does this. |
| RL-F10 | Alerts can feed the AI Daily Sales Plan and optionally create a task for the rep. |

### 2.3 Non-functional

| ID | Requirement |
| --- | --- |
| NF-1 | Progress reads come from a stored state table, never from summing history on each request. |
| NF-2 | Progress increments are atomic in the database so simultaneous events never lose a count. |
| NF-3 | Leakage scans run as a scheduled background job outside business hours; a nightly scan is enough if daily freshness is acceptable. |
| NF-4 | Every endpoint enforces role and hierarchy scope on the server. |
| NF-5 | Every lead, visit and status change carries a timestamp so leakage rules have history to read. |
| NF-6 | Event handling is idempotent: a repeated event must not double-count progress. |
| NF-7 | Two scans of the same rule never run at once, a failed scan can be retried, and a partial failure leaves no duplicate alerts or repeated notifications. |
| NF-8 | Managers are notified when an alert is created or its priority rises, not on every scan. |

### 2.4 Role access

| Capability | Exec Director | Senior Manager | Branch Manager | Team Lead / RSM | Field Officer |
| --- | --- | --- | --- | --- | --- |
| Create and assign targets | All | Hospital network | Branch | Direct team | No |
| View target progress | All | Hospital network | Branch | Direct team | Own only |
| View leakage alerts | All | Hospital network | Branch | Team | No |
| Act on leakage alerts (acknowledge, resolve, dismiss) | Yes | Yes | Yes | Yes | No |
| Configure leakage rules | Yes | Yes | No | No | No |

Scope for each tier follows the product's existing hierarchy rules. The leakage rule-configuration row is a proposed default; see the open questions in section 10.

## 3. Architecture

&#91;embedded content: system architecture · 2 modules, 4 sources, 4 consumers\]

Target progress is written when events arrive and read directly; leakage warnings are computed overnight from history. Both modules store results in their own tables and expose them through their own routers.

## 4. Code structure

Each feature owns its own folder with everything inside it (feature-based, or vertical-slice, layout): code, SQL scripts, tests and screens. Shared infrastructure lives in `core`, and cross-feature event payloads live in `shared_contracts`. Files that serve the whole project, such as `.env` and the shared foundation SQL script, stay outside the feature folders.

| Path | Responsibility |
| --- | --- |
| `app/core/` | Config, async database session, authentication and role checks, event bus |
| `app/features/monthly_target/models.py` | Target, TargetAssignment, TargetProgress tables |
| `app/features/monthly_target/schemas.py` | Request and response validation, AI gap contract |
| `app/features/monthly_target/crud.py` | Database queries, including the atomic progress increment |
| `app/features/monthly_target/service.py` | Gap, days-left and run-rate calculations |
| `app/features/monthly_target/router.py` | REST endpoints and role checks |
| `app/features/monthly_target/handlers.py` | Subscribers for visit, lead and order events (to be added) |
| `app/features/revenue_leakage/models.py` | LeakageRule, LeakageAlert, AlertAction, AlertObservation, ScanRun tables |
| `app/features/revenue_leakage/schemas.py` | Alert, rule-update and manager-action payloads |
| `app/features/revenue_leakage/crud.py` | Rule reads, alert upsert, alert queries, resolution |
| `app/features/revenue_leakage/service.py` | One scanner per rule, attention priority, alert history |
| `app/features/revenue_leakage/router.py` | Manager dashboard endpoints |
| `app/features/revenue_leakage/tasks.py` | Scheduled nightly scan with overlap lock and run log |
| `app/shared_contracts/` | `VisitCompletedEvent`, `OrderClosedEvent`, `LeadConvertedEvent`, target contract |
| `app/features/monthly_target/sql/` | Numbered SQL scripts and rollback scripts for the target tables, run by hand in Supabase |
| `app/features/revenue_leakage/sql/` | Numbered SQL scripts and rollback scripts for the leakage tables, run by hand in Supabase |
| `sql/00_foundation.sql` (project root) | Shared, run once first: schema `fsm_app`, app role, grants, row-level security, `holidays` |
| `.env`, `app/main.py` (project root) | Settings and secrets; registers each feature's router |
| `src/features/monthly_target/` | React screens, components and API calls for targets, matching the existing UI |
| `src/features/revenue_leakage/` | React screens, components and API calls for alerts, rules and scan runs, matching the existing UI |

Layer rule: routers call services, services call repositories, repositories talk to the database. Routers never hold queries; models never hold HTTP logic.

### Frontend and UI/UX

The screens live in the existing React PWA. They reuse its layout, navigation, theme, components, loading and error states, and its way of calling the API; no new UI library, colours or fonts. They work at 360 px width. Roles only hide what they cannot use, and the server enforces every rule. The Revenue Leakage screens never use the words loss, lost revenue or leakage amount and never show a total across alerts. Section 12 of each plan lists the states, error handling and build tasks.

| Module | Screens | Who |
| --- | --- | --- |
| Monthly Target | My targets and detail | Everyone, own data |
| Monthly Target | Targets list, target detail with change history, edit and cancel, create target | RSM and above |
| Revenue Leakage | Alert dashboard, alert detail, action dialog | RSM and above |
| Revenue Leakage | Rules, scan runs | Senior Manager and above |

## 5. Data model

Nine tables: four for targets and five for leakage. Targets use a polymorphic assignment (`entity_type` plus `entity_id`), so a new kind of assignee needs no schema change.

### 5.1 Monthly Target tables

| Table | Key columns | Constraints and indexes |
| --- | --- | --- |
| `targets` | id, title, metric\_type, target\_value (numeric 15,2), start\_date, end\_date, created\_by, created\_at, updated\_at | Index on (start\_date, end\_date) and on metric\_type |
| `target_assignments` | id, target\_id (FK, cascade), entity\_type, entity\_id, assigned\_at | Unique (target\_id, entity\_type, entity\_id); index on (entity\_type, entity\_id) |
| `target_progress` | id, assignment\_id (FK, cascade, unique), current\_value (numeric 15,2), last\_updated\_at | One row per assignment, created at value 0 when the target is created |

Enumerations: metric type is revenue, doctor visits, new leads, conversions or collections. Entity type is representative, team, territory, customer or product.

event\_outbox (added with 6.1): id, event\_type, payload (JSON), created\_at, processed\_at (null until handled), attempts. Index on processed\_at where null, so the sweeper finds pending rows quickly.

Added after the second engineering review (21 October 2026), see 6.7: target\_progress\_entries (id, assignment\_id, source\_event\_id, entry\_type contribution or reversal, delta numeric 15,2, occurred\_at, excluded flag; unique on assignment\_id + source\_event\_id + entry\_type), where target\_progress.current\_value is the maintained sum of its entries; target\_changes (id, target\_id, version, changed\_by, changed\_at, field, old\_value, new\_value, reason); and org\_membership\_history (employee\_id, team\_id, territory\_id, branch\_id, effective\_from, effective\_to as timestamps). targets gain status (active, closed, cancelled) and version; target\_assignments gain ended\_at.

### 5.2 Revenue Leakage tables

| Table | Key columns | Constraints and indexes |
| --- | --- | --- |
| `leakage_rules` | id, rule\_code (unique), rule\_name, description, threshold\_days, threshold\_value, medium\_priority\_ratio, high\_priority\_ratio, is\_active | One row per rule; scanner reads active rows only |
| `leakage_alerts` | id, rule\_id (FK), entity\_type, entity\_id, classification, attention\_priority, priority\_reason, observation, exposure\_amount, exposure\_basis, status, occurrence\_no, previous\_alert\_id, first\_detected\_at, last\_observed\_at, last\_notified\_at, resolved\_at | Partial unique index on (rule\_id, entity\_type, entity\_id) for unresolved alerts; index on (status, attention\_priority); index on (entity\_type, entity\_id) |
| `alert_observations` | id, alert\_id (FK, cascade), observed\_at, observation, attention\_priority | Written only when evidence or priority changes; index on (alert\_id, observed\_at) |
| `alert_actions` | id, alert\_id (FK, cascade), action\_type, outcome, action\_taken, evidence\_reference, action\_by, notes, created\_at | Audit trail; index on alert\_id |
| `scan_runs` | id, rule\_code, started\_at, finished\_at, status, rows\_evaluated, alerts\_created, alerts\_updated, error\_message | Index on (rule\_code, started\_at) |

Rule codes: unvisited high-value client, abandoned lead, declining purchase frequency, inactive opportunity, underperforming territory. Classification: operational warning in this release; potential exposure is reserved for later (section 6.4). Attention priority: low, medium, high. Alert status: active, acknowledged, resolved, dismissed; active and acknowledged together are called unresolved. Action type: acknowledged, resolved, dismissed, note. Outcome: normal variation, investigation needed, corrective action taken, commercial outcome evidenced. Scan run status: running, succeeded, failed, partial.

Added to leakage\_rules for recurrence and history (6.3, 6.5): change\_ratio (default 0.10), cooldown\_days (default 7, after a normal-variation resolution) and dismiss\_days (default 30, after a dismissal).

### 5.3 Relationships

| From | To | Cardinality |
| --- | --- | --- |
| targets | target\_assignments | one to many |
| target\_assignments | target\_progress | one to one |
| leakage\_rules | leakage\_alerts | one to many |
| leakage\_alerts | alert\_observations | one to many |
| leakage\_alerts | alert\_actions | one to many |
| leakage\_alerts (previous\_alert\_id) | leakage\_alerts | one to one; links a recurrence to its earlier occurrence |

Leakage also reads tables owned by other teams: visit logs, leads, sales orders, follow-ups and the employee directory. These are read-only dependencies.

### 5.4 Column definitions

PK = primary key, FK = foreign key. All IDs are UUIDs; all timestamps are timezone-aware.

**`targets`**

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| id | UUID | No | generated | PK |
| title | varchar(255) | No |  | 3 to 255 characters |
| metric\_type | enum | No |  | revenue, doctor\_visits, new\_leads, conversions, collections |
| target\_value | numeric(15,2) | No |  | Zero or more |
| start\_date | date | No |  |  |
| end\_date | date | No |  | Must be after start\_date |
| created\_by | UUID | No |  | The manager; refers to the employee directory |
| created\_at | timestamptz | No | now |  |
| updated\_at | timestamptz | No | now | Refreshed on every update |

**`target_assignments`**

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| id | UUID | No | generated | PK |
| target\_id | UUID | No |  | FK to targets, delete cascades |
| entity\_type | enum | No |  | representative, team, territory, customer, product |
| entity\_id | UUID | No |  | Points to the employee, team, territory, customer or product |
| assigned\_at | timestamptz | No | now |  |

**`target_progress`**

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| id | UUID | No | generated | PK |
| assignment\_id | UUID | No |  | FK to target\_assignments, unique, delete cascades |
| current\_value | numeric(15,2) | No | 0 | Only changed by atomic increment |
| last\_updated\_at | timestamptz | No | now |  |

**`processed_events`** (new, supports idempotent event handling)

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| event\_id | UUID | No |  | PK; the ID of the visit, order or lead event already counted |
| event\_type | varchar(50) | No |  | Visit, lead, order or collection |
| processed\_at | timestamptz | No | now |  |

**`leakage_rules`**

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| id | UUID | No | generated | PK |
| rule\_code | enum | No |  | Unique |
| rule\_name | varchar(255) | No |  |  |
| description | varchar(500) | Yes |  |  |
| threshold\_days | integer | No | 30 | At least 1 |
| threshold\_value | numeric(15,2) | No | 0 | Baseline value the rule compares against |
| medium\_priority\_ratio | numeric(5,2) | No |  | Observed value divided by threshold at which priority becomes medium; value to be agreed |
| high\_priority\_ratio | numeric(5,2) | No |  | Same for high; must exceed the medium ratio; value to be agreed |
| is\_active | boolean | No | true |  |
| created\_at | timestamptz | No | now |  |

**`leakage_alerts`**

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| id | UUID | No | generated | PK |
| rule\_id | UUID | No |  | FK to leakage\_rules |
| entity\_type | varchar(50) | No |  | customer, lead or territory |
| entity\_id | UUID | No |  |  |
| classification | enum | No | operational\_warning | potential\_exposure is reserved for a later release |
| attention\_priority | enum | No |  | low, medium or high, derived from the rule's ratios |
| priority\_reason | varchar(500) | No |  | Plain-words reason built from the observation |
| observation | JSON | No |  | Observed value, threshold, observation date and the suggested check |
| exposure\_amount | numeric(15,2) | Yes |  | Only when a reliable source exists |
| exposure\_basis | varchar(500) | Yes |  | Source, basis and limits of the amount; required when exposure\_amount is set |
| status | enum | No | active | active, acknowledged, resolved, dismissed |
| occurrence\_no | integer | No | 1 | Increases when a resolved condition returns |
| previous\_alert\_id | UUID | Yes |  | FK to leakage\_alerts; the earlier occurrence |
| first\_detected\_at | timestamptz | No | now |  |
| last\_observed\_at | timestamptz | No | now | Updated on every scan that still sees the condition |
| last\_notified\_at | timestamptz | Yes |  | Set when a notification goes out |
| resolved\_at | timestamptz | Yes |  |  |

A partial unique index on (rule\_id, entity\_type, entity\_id) where status is active or acknowledged enforces one unresolved alert per entity and rule at database level, so the scanner's insert-or-update cannot create a duplicate even when two scans overlap. A check rule requires exposure\_basis whenever exposure\_amount is set.

**`alert_actions`**

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| id | UUID | No | generated | PK |
| alert\_id | UUID | No |  | FK to leakage\_alerts, delete cascades |
| action\_type | enum | No |  | acknowledged, resolved, dismissed, note |
| outcome | enum | Yes |  | Required for resolved and dismissed: normal variation, investigation needed, corrective action taken, commercial outcome evidenced |
| action\_taken | varchar(255) | No |  | At least 5 characters |
| evidence\_reference | varchar(255) | Yes |  | Required when the outcome is commercial outcome evidenced; points to the documented record |
| action\_by | UUID | No |  | The manager |
| notes | varchar(1000) | Yes |  |  |
| created\_at | timestamptz | No | now |  |

**`alert_observations`** (new)

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| id | UUID | No | generated | PK |
| alert\_id | UUID | No |  | FK to leakage\_alerts, delete cascades |
| observed\_at | timestamptz | No | now |  |
| observation | JSON | No |  | Evidence at that moment |
| attention\_priority | enum | No |  | Priority at that moment |

A row is added only when the evidence or priority changes, not on every scan.

**`scan_runs`** (new)

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| id | UUID | No | generated | PK |
| rule\_code | enum | No |  | Which rule was scanned |
| started\_at | timestamptz | No | now |  |
| finished\_at | timestamptz | Yes |  | Empty while running |
| status | enum | No | running | running, succeeded, failed, partial |
| rows\_evaluated | integer | Yes |  |  |
| alerts\_created | integer | No | 0 |  |
| alerts\_updated | integer | No | 0 |  |
| error\_message | varchar(1000) | Yes |  | Set on failure |

`processed_events` is an addition from the first revision (gap 3 in section 10). The leakage table changes, including `alert_observations`, `scan_runs` and the unresolved-alert index, come from the engineering design review of 19 October 2026 (section 10.2).

### 5.5 Additions since revision 2

All application tables live in a schema that the Supabase API does not expose (`fsm_app`), with grants revoked from `anon` and `authenticated` and row-level security on. Archived data lives in `fsm_archive`, isolated the same way. The plans give every column, type and constraint.

**Monthly Target**

| Table | Change |
| --- | --- |
| targets | Status gains backfilling. New columns: final\_value, closed\_at, adjusted\_at, cancel\_reason, idempotency\_key, archived\_at |
| target\_assignments | Entity type gains branch. The link to targets is on delete restrict, so history is never deleted |
| target\_progress\_entries | Also holds source\_event\_type, contributor\_id, business\_date and excluded\_reason (see 6.7) |
| archived\_totals (new) | Stored count and sum of archived ledger entries per assignment (6.8) |
| event\_outbox (new) | Events written in the producer's transaction and handled right after commit, with a sweeper for retries |
| failed\_events (new) | Unknown versions, invalid payloads and events that ran out of retries |
| metric\_definitions (new) | What each metric counts, its date field and its dedupe rule |
| holidays (new) | Non-working days for the run rate |
| reconciliation\_runs, reconciliation\_drifts (new) | Results of the nightly ledger check |

**Revenue Leakage**

| Table | Change |
| --- | --- |
| leakage\_rules | New columns: change\_ratio, cooldown\_days, dismiss\_days, autoclear\_scans, escalation\_days, min\_history\_months, params, required\_sources |
| rule\_changes (new) | Old and new value, reason and editor for every rule edit |
| leakage\_alerts | New columns: version, clear\_streak, suppressed\_until, escalation\_level, escalated\_at. previous\_alert\_id has no foreign key, so archived alerts can still be referenced |
| alert\_actions | New columns: idempotency\_key. New action types: escalated, auto\_cleared. New system-only outcome: condition\_cleared |
| alert\_observations | New column: reason (created, priority\_changed, value\_changed, resolved, suppressed\_recurrence) |
| scan\_runs | New columns: mode (baseline or normal), heartbeat\_at, alerts\_cleared, skipped\_not\_synced, attempt. New status: skipped\_source\_missing |
| alert\_chains (new) | Occurrence number and suppression per rule and entity, so archiving never resets them (6.8) |
| alert\_notifications (new) | One row per message, unique so a rerun cannot send twice |
| alert\_views (new) | Audit of who viewed or exported alert evidence |
| source\_availability, user\_sync\_state (new) | Whether each source is ready, and when each rep last synced |
| holidays (new) | Shared with Monthly Target |

## 6. Business logic

The service layer holds all calculation rules so they can change without touching queries or endpoints.

### 6.1 Target progress and run rate

- Progress update: on a qualifying event, find every active target whose metric matches, whose date range contains the event's completed\_at date (in the business timezone), and whose assignment matches the person or the person's team, territory or branch at that time. For each one, insert one entry into target\_progress\_entries and add its delta to current\_value in the same transaction. Section 6.7 gives the rules for several targets, reversals, transfers and changes.
- **Gap:** target value minus current value, never below zero.
- Days left: working days from today (or the start date, if later) to the end date. Working days are Monday to Saturday, minus holidays and the rep's approved leave (decision D4). Zero once the target has ended; when none remain the screen says 'no working days left' instead of dividing.
- Required daily run rate: gap divided by days left, rounded to 2 decimals. It is recalculated on every read, so it moves each day with performance.

  Which targets a rep sees: my-progress returns the rep's individual targets plus every active team, territory and branch target the rep belongs to today. Each carries a scope label and the rep's own contribution (the sum of the rep's entries). Managers see the targets of everyone in their scope, and the AI payload uses the same resolution.

  Starting in the past: when a target is created with a start date before today, or its start date moves earlier, entries are backfilled from source records through the same entry code, so progress starts correct instead of at zero.

  Reliable delivery: each visit, order, lead or collection writes a row to event\_outbox in the same transaction as the record itself. The target handler runs right after commit and marks the row done, and a sweeper retries pending rows every minute. With the nightly reconciliation in 6.7, a failed handler cannot silently lose progress.

```latex
\text{run rate} = \frac{\max(0,\ \text{target} - \text{current})}{\text{days left}}
```

### 6.2 Leakage rules

| Rule | Triggers when | Reads | The alert shows |
| --- | --- | --- | --- |
| Unvisited high-value client | Average monthly revenue is at or above the value threshold and the last visit is older than the day threshold | Sales orders, visit logs | Last verified visit, expected visit cadence, days overdue |
| Abandoned lead | A lead has no follow-up status after the day threshold | Leads, follow-ups | Lead stage, last follow-up date, days since |
| Declining purchase frequency | Recent order volume falls well below the customer's own baseline for consecutive months | Sales orders | The percentage fall against baseline; no loss amount is claimed |
| Inactive opportunity | A deal sits in one pipeline stage past the day threshold with no visit or call logged | Leads, visit logs | Stage, days in stage, last activity; the deal is not marked Lost |
| Underperforming territory | Territory revenue is far below its own history or neighbouring territories | Sales orders, targets | Achievement against target as a percentage; a gap in achievement, not a money loss |

### 6.3 Attention priority, de-duplication and history

- Attention priority is low, medium or high. It compares the observed value with the rule's threshold: at or above the rule's medium ratio is medium, at or above its high ratio is high, anything below is low. Both ratios are editable per rule, and the reason is stored in plain words.
- No 0 to 100 financial score is used in this release. A scoring model can be validated against real outcomes later.
- A money amount is shown only when its source and basis can be stated. Otherwise the alert shows the actual deviation, such as the percentage fall in orders. Amounts on different alerts are never added together, because several alerts can describe the same customer.
- The scanner inserts or updates against unresolved alerts on (rule, entity type, entity ID). An existing unresolved alert gets its last-observed time and evidence updated; manager actions stay untouched.
- A row is added to `alert_observations` only when the evidence or priority changes.

Observation frequency: a scan that sees the same issue again does not write a row; it only updates last\_observed\_at on the alert, which proves the issue was present on that scan day. A row is written to alert\_observations in four cases: when the alert is created; when its attention priority changes; when the main observed value has moved by at least the rule's change\_ratio (default 10%) since the last stored observation; and when the alert is resolved or auto-cleared. A year of daily scans on an unchanged issue therefore stores two rows, not 365.

### 6.4 Alert classification

The review separates warnings from losses. This release produces only the first level.

| Level | Meaning | This release | Example |
| --- | --- | --- | --- |
| Operational warning | Observed deviation; commercial harm unproven | Yes | Doctor not visited for 30 days |
| Potential commercial exposure | A confirmed commitment faces a credible adverse event | No, reserved | Customer threatens to cancel a confirmed order |
| Confirmed commercial loss | Documented lost order or opportunity | No | Customer formally cancels a confirmed order |
| Verified financial loss | Finance-checked discrepancy or write-off | No | Approved write-off |

A warning is never labelled a loss. Opportunity values, order values, unpaid receivables and write-offs are never added into one lost-revenue total. A later level needs its own evidence: a documented customer rejection and closure reason for a lost opportunity, a confirmed order and verified cancellation for a cancelled order, and a finance decision for a write-off.

### 6.5 Alert lifecycle

| What happens | Stored behaviour |
| --- | --- |
| First scan sees the condition | A new unresolved alert is created with its first-detected time. |
| Next scan sees the same condition | The same alert's last-observed time and evidence are updated; manager actions stay. |
| Manager acknowledges | The alert stays unresolved; later scans do not create a replacement. |
| Condition disappears | The alert is auto-cleared after two scans without the condition, and the reason is recorded (see the auto-clear rule below). |
| Condition returns after resolution | A new alert with the next occurrence number, linked to the earlier one, so old history is untouched. Decided: see the recurrence rule below. |
| Scan reruns, crashes or runs twice | The unresolved-alert index and insert-or-update prevent duplicate alerts and repeated notifications. |

Recurrence: a resolved alert is never reopened. If the same condition returns for the same rule and entity, the scanner creates a new alert with occurrence\_no one higher and previous\_alert\_id pointing to the closed one. Each episode keeps its own actions and observations, and the chain of occurrences gives the full history. The partial unique index allows this because resolved alerts fall outside it, so there is still at most one unresolved alert per rule and entity. The new occurrence sends a notification and the screen shows 'Occurrence 2' with a link to the earlier ones.

Suppression after closure: when a manager resolves with the outcome normal variation, a returning condition inside cooldown\_days (default 7) is recorded as an observation on the closed alert and raises nothing new. A dismissal works the same way with dismiss\_days (default 30) and needs a reason. Every other outcome has no cool-down, because the issue was real or acted on.

Auto-clear: when the condition is absent on two consecutive scans, the scanner resolves the alert itself with the outcome condition cleared, writes a final observation and records the system user as the actor. Two scans, not one, so a single late data load does not close and re-open alerts.

### 6.6 Scan reliability

- Each rule's scan first takes a PostgreSQL advisory lock, so two scans of the same rule never run together.
- Every scan writes a `scan_runs` row at the start and updates it at the end, so failures are visible.
- Rules are scanned and committed one at a time. If one rule fails, the others stand and only the failed rule is retried. Because writes are insert-or-update, a retry cannot duplicate alerts.
- Notifications go out when an alert is created or its priority rises, tracked with `last_notified_at`, not on every scan.
- A nightly scan suits time-based rules such as no visit for a set number of days, and is enough if daily freshness is acceptable. Event-triggered checks can be added later for faster updates but do not replace the time-based scan.

### 6.7 Target contributions, reversals, transfers and changes

Added after the second engineering review (21 October 2026), which raised four Monthly Target issues. One rule sits behind all four: progress is a ledger of facts in target\_progress\_entries, and every other number (current value, gap, run rate) is derived from it. Entries are only ever added, never edited or deleted.

| Issue | Decision | How it works |
| --- | --- | --- |
| One event, several targets | Every applicable target gets exactly one contribution | The handler finds the rep's team, territory and branch as they were at the event time (see transfers below), then every active assignment that matches the metric and date range. It inserts one entry per assignment in the same transaction as the event's processed\_events row. The unique key on assignment\_id + source\_event\_id + entry\_type means a replayed or duplicated event cannot count twice for the same assignment. One visit counts once toward the rep's target, once toward the team's and once toward the territory's. Those are different goals, so this is not double counting. A team target is its own goal fed by all members, not the sum of their individual targets (decision D3 to confirm). |
| Corrections and reversals | Reverse with a negative entry, never edit | A cancellation event (7.3) posts one reversal entry, with the negative amount, for each entry the original event created. It looks them up by source\_event\_id and does not re-resolve membership, so it hits exactly the targets that were credited, even if the rep has since moved. A repeated cancellation does nothing because of the unique key. A reversal that arrives after the period closed still posts and marks the closed result as adjusted, with the date. Displayed progress never goes below zero. A nightly job recomputes each active target from its entries and from source records and reports any drift. |
| Transfers between territories or teams | Past contributions stay, new ones move | Membership is kept in org\_membership\_history with timestamps. An event is matched to the membership at its completed\_at time, so an offline visit synced late still lands correctly. Earlier entries stay with the original team and territory, and activity after the transfer goes to the new ones. The rep's individual target follows the rep. The old group's target keeps what it earned and is flagged for the manager, because it lost a contributor. |
| Target changes after progress begins | Allowed, versioned, with a reason | See the rules below. |

Change rules for an existing target:

- Target value: can be changed. Progress is unaffected; gap and run rate recalculate on the next read.
- End date: can be extended or shortened, but not to before today. Entries dated after a shortened end are marked excluded, not deleted, so restoring the date brings them back.
- Start date: moving it earlier backfills from source records through the same entry code; moving it later marks earlier entries as excluded.
- Metric type: cannot be changed. Cancel the target and create a new one.
- Assignments: a new assignee counts from today by default, with an option to backfill from the start date. A removed assignee's assignment is ended (ended\_at); their entries stay in history and other assignees are unaffected.
- Who can change: the creator, or anyone above them in the hierarchy within scope, with a reason required. A target that has ended can only be changed by a Senior Manager or above.
- Audit and conflicts: every change writes a target\_changes row and raises the target's version. PATCH carries the version the manager saw; a mismatch returns 409, so two managers cannot overwrite each other.
- Cancelling sets status to cancelled, keeps all progress for audit and removes the target from the rep's view.

### 6.8 Archive and retention

Added after the data-growth gap (critic gap P-16). Nothing business-critical is deleted without being archived first.

| Data | Stays live | Then |
| --- | --- | --- |
| Ledger entries of a target | Until the target has been closed or cancelled for 24 months | Moved to the archive with a stored total per assignment. Reconciliation adds the stored total to live rows |
| Closed alerts with their actions and history | 12 months after resolution | Moved to the archive as a whole chain. A small alert\_chains table keeps occurrence numbers and suppression |
| Alert observations of open alerts, alert views | 24 months | Archived, then deleted from the live table |
| Processed events, processed outbox rows, resolved failed events, reconciliation results, scan runs, sent notifications | 30 days to 12 months, by table | Deleted |
| Archive tables | 7 years | Deleted by a yearly job after sign-off |

The periods are defaults held in configuration. They are decision D12 and need sign-off from the business, Finance and legal.

## 7. API and integration contracts

Base path is `/api/v1`. All endpoints require a signed-in user; role checks run on the server.

### 7.1 Endpoints

| Method and path | Purpose | Allowed roles |
| --- | --- | --- |
| POST `/targets` | Create a target with assignments | RSM, Branch Manager, Senior Manager, Executive Director |
| GET `/targets/my-progress` | Rep's active targets with gap, days left, run rate | Any signed-in user, own data |
| GET `/targets/ai-metrics/{user_id}` | Gap and run rate for the AI Daily Sales Plan | Internal service, and managers within scope |
| GET `/revenue-leakage/alerts` | Unresolved alerts, filtered by attention priority, rule and status | RSM, Branch Manager and above |
| GET `/revenue-leakage/alerts/{alert_id}` | One alert with its observation history and manager actions | RSM, Branch Manager and above |
| POST `/revenue-leakage/alerts/{alert_id}/actions` | Acknowledge, resolve or dismiss with an outcome and notes | RSM, Branch Manager and above |
| PATCH `/revenue-leakage/rules/{rule_id}` | Change thresholds and priority ratios, or switch a rule on or off | Senior Manager and above (proposed) |

`/targets/my-progress` and the rules endpoint are added in this spec; the earlier design described them but did not include them in the endpoint code.

The single resolve endpoint from the first revision is replaced by `/actions`, so acknowledging, resolving and dismissing share one route and one audit record.

Added for target changes (6.7): GET /targets (RSM and above; filters for period, metric and assignee; paginated; scoped to the caller), GET /targets/{target\_id}, PATCH /targets/{target\_id} (body carries the expected version and a reason; 409 on a version mismatch) and POST /targets/{target\_id}/cancel. Changes and cancels are allowed for the creator or anyone above them in scope.

### 7.2 AI Daily Sales Plan payload

One object per active target for the rep:

| Field | Meaning |
| --- | --- |
| entity\_id | The representative |
| metric\_type | Which metric this target tracks |
| target\_value | Total goal |
| current\_value | Achieved so far |
| gap\_remaining | Goal minus achieved, never below zero |
| days\_left | Days until the target ends |
| required\_daily\_run\_rate | Gap divided by days left |

This shape should be frozen early so the AI team can build against it.

### 7.3 Events consumed by Monthly Target

| Event | Raised by | Updates |
| --- | --- | --- |
| VisitCompletedEvent (visit, rep, doctor, time, geofence-valid flag) | Geotagged visit logging | Doctor visits |
| LeadCreatedEvent / LeadConvertedEvent | Lead Management | New leads, conversions |
| OrderClosedEvent (order, rep, customer, value, time) | Sales or billing | Revenue |
| CollectionRecordedEvent | Sales or billing | Collections |

LeadCreatedEvent and CollectionRecordedEvent are new in this spec; the earlier design listed only the visit, order and lead-converted events.

Reversal events, added in 6.7: VisitRejectedEvent or VisitCancelledEvent, OrderCancelledEvent, LeadConversionRevertedEvent and CollectionBouncedEvent. Each carries the id of the original event so the handler can find the entries to reverse. Whether a visit counts at submission or only after RSM approval is decision D1; the design supports both, because approval-only simply means counting on a visit-approved event instead.

### 7.4 Request and response schemas

Field-level contracts for the API. Validation runs at the boundary, before anything reaches the database.

**Create target (request, POST `/targets`)**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| title | string | Yes | 3 to 255 characters |
| metric\_type | enum | Yes | One of the five metric types |
| target\_value | number | Yes | Zero or more |
| start\_date | date | Yes |  |
| end\_date | date | Yes | Strictly after start\_date |
| assignments | list | Yes | At least one item |
| assignments\[\].entity\_type | enum | Yes | representative, team, territory, customer, product |
| assignments\[\].entity\_id | UUID | Yes | Must be inside the caller's hierarchy scope |

**Target (response)**

| Field | Type | Notes |
| --- | --- | --- |
| id, title, metric\_type, target\_value, start\_date, end\_date | as above |  |
| created\_by, created\_at | UUID, timestamp |  |
| assignments\[\].id, entity\_type, entity\_id |  |  |
| assignments\[\].progress.current\_value | number |  |
| assignments\[\].progress.last\_updated\_at | timestamp |  |

**My progress (response, GET `/targets/my-progress`)** uses the same fields as the AI payload in 7.2, plus `title`, `start_date`, `end_date` and `percent_complete` (current value divided by target value, 0 to 100) for the rep's dashboard.

**Leakage alert (response)**

| Field | Type | Notes |
| --- | --- | --- |
| id | UUID |  |
| rule\_code | enum | Which rule fired |
| entity\_type, entity\_id | string, UUID | Customer, lead or territory |
| classification | enum | Operational warning in this release |
| attention\_priority | enum | low, medium or high |
| priority\_reason | string | Plain-words reason |
| observation | object | Observed value, threshold, observation date and suggested check |
| exposure\_amount, exposure\_basis | number, string | Present only when a reliable source exists |
| status | enum | active, acknowledged, resolved, dismissed |
| occurrence\_no | integer | 1 for the first occurrence |
| first\_detected\_at, last\_observed\_at | timestamps |  |

**Rule update (request, PATCH `/revenue-leakage/rules/{rule_id}`)**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| threshold\_days | integer | No | At least 1 |
| threshold\_value | number | No | Zero or more |
| medium\_priority\_ratio | number | No | Above zero and below high\_priority\_ratio |
| high\_priority\_ratio | number | No | Above medium\_priority\_ratio |
| is\_active | boolean | No |  |

**Alert action (request, POST `/revenue-leakage/alerts/{alert_id}/actions`)**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| action\_type | enum | Yes | acknowledged, resolved, dismissed or note |
| outcome | enum | For resolved and dismissed | normal variation, investigation needed, corrective action taken, commercial outcome evidenced |
| action\_taken | string | Yes | At least 5 characters |
| evidence\_reference | string | When the outcome is commercial outcome evidenced | Points to the documented record, up to 255 characters |
| notes | string | No | Up to 1,000 characters |

**Event payloads (internal)**

| Event | Fields |
| --- | --- |
| VisitCompletedEvent | visit\_id, representative\_id, doctor\_id, completed\_at, is\_valid\_geofence |
| LeadCreatedEvent | lead\_id, representative\_id, created\_at |
| LeadConvertedEvent | lead\_id, representative\_id, converted\_at |
| OrderClosedEvent | order\_id, representative\_id, customer\_id, order\_value, closed\_at |
| CollectionRecordedEvent | payment\_id, representative\_id, customer\_id, amount, recorded\_at |

The ID in each event is stored in `processed_events` so a repeated delivery is ignored. The three new event shapes (lead created, lead converted, collection recorded) are proposed here and need agreement with the owning teams.

### 7.5 Additions since revision 2

- **New endpoints:** GET /revenue-leakage/rules and GET /revenue-leakage/scan-runs (Senior Manager and above), so the rule and scan screens work.
- **Alert actions:** the request carries expected\_version (409 on a mismatch) and an optional Idempotency-Key. Resolved and dismissed need an outcome; condition\_cleared is rejected from users.
- **Rule edits:** the request carries a reason, and accepts the new settings (change\_ratio, cool-down, dismissal days, auto-clear scans, escalation days, history months, params).
- **Targets:** POST /targets accepts an Idempotency-Key. Creating, changing and cancelling follow the error format in the Monthly Target plan (401, 403, 404, 409 for overlap and version conflict, 422). Customer and product assignments return 422 until their data exists.
- **My progress and the AI payload:** frozen at payload\_version 1. Each object adds target\_id, scope, own\_contribution, percent\_complete, state (upcoming, active, achieved, ended\_short) and adjusted. It includes team, territory and branch targets the person belongs to.
- **Events:** every event carries event\_id, event\_version and occurred\_at. VisitApprovedEvent is added for approval mode. A producer writes its event to the outbox in its own transaction.
- **Decisions:** D1 to D12 and their defaults are listed in section 2 of each plan. D12 (retention periods) is new.

## 8. Runtime flow

&#91;embedded content: visit logged to progress updated · 4 participants, 6 steps\]

The rep's app gets the new progress in the same response that confirms the visit. Lead, order and collection events follow the same pattern with their own handlers.

## 9. Dependencies and ownership

Monthly Target needs events from three teams and serves three consumers; Leakage reads from all of them. Agree event shapes and IDs with each team before coding.

| Team / module | You need from them | They need from you | When |
| --- | --- | --- | --- |
| Core visit logging | VisitCompletedEvent on every valid submission, with timestamps | Updated progress in the submit response (optional) | Before Monthly Target ships |
| Lead Management | Lead created and converted events; stage-change timestamps and a documented reason when a lead is closed as Lost | Conversion and lead progress; leakage reads their stages | Before Monthly Target ships |
| Follow-ups | Follow-up status and due dates | Leakage flags overdue follow-ups on high-value customers | Before Leakage |
| Sales / billing | OrderClosedEvent, collection events, order history | Revenue progress | Before Monthly Target ships |
| AI Daily Sales Plan | Nothing for Phase 1 | Gap and run-rate payload; later, leakage flags | Freeze payload early |
| Analytics | Nothing | Read access to targets, progress and alerts | After both modules |
| Employee directory | `reportingTo` and team, branch and territory membership | Nothing | Needed for role scope and team roll-up |

**Work split:** one backend developer owns the target tables, event handlers and endpoints; one frontend developer owns the manager target form and the rep progress view. Leakage needs a data-focused backend developer and a manager dashboard, started later.

## 10. Design gaps, risks and rollout

The earlier design is a sound base but has gaps that should be fixed before implementation. The first two would give wrong numbers in production.

### 10.1 Gaps to fix

| # | Gap | Fix |
| --- | --- | --- |
| 1 | Team, territory and branch targets never update: the progress query matches the rep's own ID only | On each event, resolve the rep's team, territory and branch, and increment every matching assignment |
| 2 | Days left counts calendar days although it is described as business days | Decide the rule (exclude Sundays and holidays?) and implement it once in the service |
| 3 | Repeated events can double-count | Store processed event IDs and skip repeats |
| 4 | Visits flagged outside the geofence may still count | Count only geofence-valid visits, or agree the rule with the product owner |
| 5 | The AI metrics endpoint lets any signed-in user read any user's gap | Restrict to the internal service and managers within hierarchy scope |
| 6 | Alert details are stored as a short string | Use a JSON column |
| 7 | The leakage scanner currently uses mock data | Replace with real queries once visit, order and lead tables are agreed |

### 10.2 Changes from the engineering design review (19 October 2026)

The engineering team found the Revenue Leakage architecture feasible for implementation planning, conditional on the changes below. Monthly Target needed no changes.

| Review concern | Change in this spec | Sections |
| --- | --- | --- |
| Wording implied lost revenue | Alerts are operational warnings; money amounts are optional and never summed | 1, 2.2, 5.4, 6.4 |
| Placeholder 0 to 100 risk score | Replaced by a configurable attention priority with a stated reason | 5.4, 6.3 |
| Unsupported amount at risk | exposure\_amount is optional and needs exposure\_basis | 5.4, 7.4 |
| Inactive lead treated as lost | Lost only with a documented outcome | 2.2, 9 |
| Repeated alerts on every scan | One unresolved alert per rule and entity, covering active and acknowledged, enforced by the database | 5.4, 6.5 |
| Historical evidence | First-detected and last-observed times, observation log, manager actions | 5.2, 5.4 |
| Recurring conditions | Occurrence number and link to the earlier alert (decided in 6.5) | 5.4, 6.5 |
| Alert resolution | Set outcomes and an evidence reference | 5.4, 7.4 |
| Duplicate financial exposure | No totals across alerts | 6.3, 6.4 |
| Job overlap and failure | Advisory lock, run log, per-rule retry | 6.6 |
| Data availability | Confirmed loss deferred until reliable records and approvals exist | 6.4, 10.3 |

Second review round (21 October 2026): the engineering team raised two Revenue Leakage clarifications (recurrence after resolution, observation frequency) and four Monthly Target issues (one event feeding several targets, reversals, transfers, changes after progress begins). They are settled in 5.1, 5.2, 6.3, 6.5, 6.7, 7.1 and 7.3. This changes the first review's verdict that Monthly Target needed no changes: it now has a progress ledger, membership history and versioned edits.

### 10.3 Rollout phases

| Phase | Content | Exit check |
| --- | --- | --- |
| 1 | Target tables, create and assign, visit event handler, rep progress view | A logged visit moves the rep's progress bar |
| 2 | Lead, order and collection events; team roll-up; manager progress view; AI payload | AI team consumes the payload in staging |
| 3 | Leakage rules as operational warnings, locked nightly scanner with run log, alert lifecycle and history, manager alert dashboard | Alerts match a manual check on a sample branch, and a repeated scan creates no duplicates |
| 4 | Task creation from alerts, leakage flags into AI plan, Analytics views | Managers act on alerts from the dashboard |
| Later | Potential exposure, confirmed loss and billing-gap categories | Reliable order, billing and finance records and approvals exist |

## 11. Critic review: gaps, edge cases and fixes

An adversarial read of sections 1 to 10 found 46 gaps, 8 of them critical. A gap is critical when it gives wrong numbers, loses data or exposes data. High gaps break common cases; medium gaps are rough edges or later risks. The fixes are proposals: they are not yet applied to sections 2 to 9, and the decisions they need are in 11.4.

### 11.1 Monthly Target

| ID | Severity | Gap or edge case | Fix |
| --- | --- | --- | --- |
| MT-1 | Critical | Targets created mid-period or backdated start at zero. Progress rows are created at 0, so a target created on the 10th with a start date of the 1st ignores the first nine days. | On creation, backfill by replaying source records from the start date through the same ledger code as live events (MT-3), or reject start dates in the past. |
| MT-2 | Critical | Team, territory and branch targets are written but never read. `my-progress` and the AI payload match assignments on the rep's own ID, so a rep never sees a team target. | At read time resolve the rep's team, territory and branch, and return every applicable assignment with a `scope` field and the rep's own contribution. |
| MT-3 | Critical | Progress only goes up and cannot be audited. Visits rejected by an RSM, cancelled orders, reverted conversions and bounced payments are never subtracted, and `processed_events` cannot say which assignments an event touched. | Add a ledger table `target_progress_entries` (assignment\_id, event\_id, delta, occurred\_at), unique on (assignment\_id, event\_id). `current_value` becomes the maintained sum. Rejections and cancellations post negative entries. Which visits count is decision D1. |
| MT-4 | Critical | Increments can be lost silently. The visit is saved, then the target handler runs; if it fails or the process dies in between, progress never moves. | Write an outbox row in the same transaction as the visit. A handler runs right after commit and a sweeper retries pending rows. A nightly reconciliation recomputes each active target from source records and reports drift. |
| MT-5 | High | Timezone. `date.today()` uses the server's zone. Activity near midnight in India (UTC+5:30) can fall on the wrong day or month, and days left can be off by one. | Set one business timezone in config (Asia/Kolkata assumed, decision D8), convert event times to it before matching dates, and compute days left in it. |
| MT-6 | High | Offline and late events. The PWA works offline, so a visit made on the last day may sync after the period ends. Matching on arrival time credits the wrong period. | Match on the event's `completed_at`. Accept late events within a grace window, and record anything later as an adjustment to the closed target. |
| MT-7 | High | Targets cannot be edited, cancelled or closed. The API is create-only, so a wrong value, a rep leaving or a changed plan has no path, and a cascade delete would erase history. | Add `status` (active, closed, cancelled), PATCH and cancel endpoints, and a `target_changes` history (who, when, old and new value). Never hard-delete. A closing job freezes the final result at the end date for Analytics. |
| MT-8 | High | Overlapping targets. Two active individual targets for the same rep, metric and dates both increment, and the dashboard cannot tell which one counts. | Reject a second active individual target with the same metric and overlapping dates (409), or make the new one supersede the old. |
| MT-9 | High | No manager read endpoints. MT-F6 says managers see progress for everyone in scope, but the API has no list, detail or roll-up endpoint. | Add GET `/targets` (filters for period, metric and entity; paginated), GET `/targets/{id}` and a progress view per assignee, all scoped to the caller. |
| MT-10 | High | Metric rules are undefined. Is a doctor visit counted once per doctor per day or per submission? Are conversions dated at creation or at conversion? Is revenue gross or net of tax, discounts and returns? | Add a metric-definition table (source event, what counts, dedupe rule, date used) agreed with the business (D2). Validate count metrics as whole numbers by metric type and add a check constraint. |
| MT-11 | High | Product and customer targets cannot be computed. `OrderClosedEvent` has only an order total, and visits carry a doctor, not a customer. | Add order lines (product, quantity, value) to the order event and a doctor-to-customer mapping, or leave product and customer targets out of phase 1. |
| MT-12 | High | Run rate ignores leave and holidays. Days left counts calendar days, but the visit planner schedules Monday to Saturday and reps take approved leave, so the daily rate is understated. | Working days are Monday to Saturday, minus holidays and the rep's approved leave from the Leave module (D4). When none remain, show 'no working days left' instead of dividing by one. |
| MT-13 | High | Membership changes mid-month. A rep moves team or territory, or leaves. Which group keeps the earlier visits, and what happens to their individual targets? | The ledger records which assignments each event hit, so earlier activity stays with the group at the time. When a rep leaves, close or reassign their individual targets and flag the team target for review. |
| MT-14 | Medium | Edge states of the math. Future targets, ended targets with a gap, achieved targets and a target value of zero (division in percent complete) have no defined output. | Return a `state` (upcoming, active, achieved, ended short). Show over-achievement uncapped. Percent complete is empty when the target is zero. |
| MT-15 | Medium | Money as floating point. The service converts numeric values to float, so revenue and collections can drift by paise. | Use Decimal end to end, round only for display, and state the single currency (INR assumed). |
| MT-16 | Medium | Polymorphic IDs have no foreign keys. Deleted employees, teams or customers leave orphan assignments. | Validate IDs when assigning, soft-delete master records and run a weekly orphan check. Alternative: one nullable foreign key per type, with a check that exactly one is set. |
| MT-17 | Medium | Double submit. A double tap on Create makes two identical targets. | Accept an idempotency key on POST `/targets` and store it with the target. |

Status after the second engineering review (21 October 2026): MT-1, MT-2, MT-3, MT-4, MT-7, MT-12 and MT-13 are now designed in 6.1 and 6.7 (ledger, reversals, membership history, versioned changes, read path, backfill, outbox, working days). The remaining gaps in this section are proposals to apply as the build reaches them.

### 11.2 Revenue Leakage

| ID | Severity | Gap or edge case | Fix |
| --- | --- | --- | --- |
| RL-1 | Critical | A dismissed alert closes, so the next scan sees the same condition and creates it again. Managers would dismiss the same alert every day. | Dismissal needs a reason and starts a suppression period (dismiss\_days, default 30). Designed in 6.5. |
| RL-2 | Critical | Alerts and rule thresholds are not scoped. An RSM could read alerts outside their hierarchy, and anyone with a manager role could change a threshold for the whole company. | Filter every alert query by the caller's hierarchy on the server. Only Senior Manager and above edit rules, and every edit is logged with old and new value. |
| RL-3 | High | A client who has never been visited has no last visit date, so the unvisited-client rule skips exactly the worst case. | Treat a missing last visit as the date the client became high-value or was assigned, whichever is later. |
| RL-4 | High | New clients and leads have no history, so the declining-frequency rule fires on a young account or divides by zero. | Require a minimum history (for example 3 full months) before a rule can fire, and skip entities younger than that. |
| RL-5 | High | Seasonality. Orders fall every monsoon or festival month, and the rule would raise the same warning every year. | Compare with a 3-month average, and with the same month last year once a year of data exists. State the baseline used on the alert. |
| RL-6 | High | A client is reassigned to another rep or territory. Open alerts stay with the old owner and the new owner never sees them. | The alert owner is resolved from the current assignment at read time. Actions and history stay with the alert. |
| RL-7 | High | Nobody is defined as the alert recipient. Territory-level alerts have no single owner. | Route a client or lead alert to the rep's RSM, a territory alert to the Branch Manager, and escalate one level when it stays unacknowledged for a set number of days (decision D5). |
| RL-8 | Medium | Day thresholds count calendar days, so 30 days with no visit includes Sundays, holidays and approved leave. | Count working days (Monday to Saturday, minus holidays and the rep's approved leave), matching MT-12. |
| RL-9 | Medium | First scan floods managers. Hundreds of alerts appear on day one with notifications for each. | A first-run baseline mode creates alerts silently and sends one summary per manager. |
| RL-10 | Medium | Notification fatigue. A notification per alert, even only on create or priority rise, is too much at scale. | Send one daily digest per manager. Send an immediate message only for a new high-priority alert. |
| RL-11 | Medium | Two managers act on the same alert at once and one action overwrites the other. | Add a version column on the alert. An action carries the version it saw and a mismatch returns 409. |
| RL-12 | Medium | Changing a threshold changes what old alerts mean, and the history can no longer be explained. | Store the threshold and ratios used in each observation. |
| RL-13 | Medium | Late offline sync. The scan runs at night before a rep's offline visits reach the server, and raises a false unvisited warning. | Record the last sync time per rep. Skip or delay evaluating a rep who has not synced within a grace period, and show the reason. |
| RL-14 | Medium | Missing source data. If the lead or order tables are not ready, the scan fails or silently finds nothing. | A rule runs only when its sources are registered as available. Otherwise it stays inactive and the scan run records 'skipped, source missing'. |

### 11.3 Platform and cross-cutting

| ID | Severity | Gap or edge case | Fix |
| --- | --- | --- | --- |
| P-1 | Critical | Data exposure. Supabase exposes tables in the public schema through its automatic API, and without row-level security any role with a grant can read or write them. Targets, alerts and visit data would be reachable outside the FastAPI role checks. | Create the application tables in a separate schema that the API does not expose, or enable row-level security on every table with no public policy. Revoke grants from the anon and authenticated roles. The app connects with its own database role. |
| P-2 | Critical | Advisory locks and the pooler. On the transaction-mode pooler (port 6543) a session lock can be lost between transactions, and prepared statements are not supported, so the scan lock in 6.6 may not hold and queries may fail. | Run the scanner on the direct connection (5432) or session mode. If the app uses the transaction pooler, set the asyncpg statement cache size to 0. As a second guard, treat an unexpired running row in scan\_runs as the lock. |
| P-3 | High | Several API workers each start their own scheduler, so the nightly scan runs several times. | Run the scheduler in one dedicated worker or an external cron. The lock in P-2 stays as the backstop. |
| P-4 | High | Scan queries over visit logs, orders and leads with no matching indexes will slow the database for field users. | Index the source columns the rules filter on (employee, client, visited\_at, order date). Scan in batches with keyset pagination, set a statement timeout and run off-peak. |
| P-5 | High | The partial unique index, new tables and backfills need ordered, repeatable database changes. | Use numbered SQL scripts with rollback scripts, run by hand in Supabase after a backup and first on a test project. Create the unique index in the same script as its table, before the first scan runs, and backfill in batches. |
| P-6 | High | Event contracts are unversioned, so a change by the visit, lead or order team silently breaks the target handler. | Add a version field to each event, validate on receipt and route unknown versions to a failed-events table with an alert. |
| P-7 | High | Repeated taps and offline retries from the PWA create duplicate actions on alerts, not only on targets. | Accept an idempotency key on POST /targets and on alert actions, and store it with the record. |
| P-8 | Medium | No operational visibility. Failed scans, handler errors and ledger drift go unnoticed. | Expose scan\_runs status, failed-events count and nightly drift as metrics, and alert the engineering team on failure. |
| P-9 | Medium | Mixed time zones. Timestamps stored without a zone are read differently by the server and the database. | Store every timestamp as timestamptz in UTC, convert to the business timezone only for date matching and display (MT-5). |
| P-10 | Medium | Alerts show client and doctor details and keep them forever. | Define a retention period for observations and actions, show only the fields a role needs, and log who viewed or exported alert evidence. |
| P-11 | Medium | List endpoints without limits will time out as data grows. | Paginate every list, cap page size and add rate limits. |
| P-12 | Medium | Ledger corruption or a bad deploy leaves progress numbers wrong. | The ledger can rebuild current\_value at any time. Take database backups before each SQL script is run and rehearse a restore. |
| P-13 | Medium | The numbers in this design are easy to get subtly wrong and hard to notice. | Write test cases for run rate edge states, duplicate and replayed events, reversal after close, transfers, late offline events, scan reruns, and recurrence with cool-down. |
| P-14 | Medium | Source tables and column names owned by other teams are not confirmed (decision D7). | Agree a read-only contract per source (table, columns, owner) before phase 2 and test it in CI. |
| P-15 | Medium | The AI payload changes shape as targets gain state, scope and adjusted flags, and the AI team builds against the old one. | Freeze the payload with scope, state and adjusted fields now, and version it. |

### 11.4 Decisions needed

| ID | Decision | Default assumed in this spec | Owner |
| --- | --- | --- | --- |
| D1 | Which visits count toward targets: on submission with a valid geofence, or only after RSM approval | On submission, reversed if the RSM rejects | Product and the core visit team |
| D2 | Metric definitions: revenue gross or net of tax and returns, which date a lead or order is counted on | Net of returns, dated at close | Business and Finance |
| D3 | Team and territory targets: a shared goal fed by all members, or the sum of members' targets | Shared goal | Product and sales managers |
| D4 | Working days, holiday list and where approved leave comes from | Monday to Saturday, holidays and leave from the Leave module | HR and the Leave module team |
| D5 | Recurrence and escalation settings: cool-down 7 days, dismissal 30 days, auto-clear after 2 scans, escalation delay | As listed | Business, with engineering to confirm |
| D6 | Medium and high priority ratios for each rule | Set at first deployment, editable | Sales leadership |
| D7 | Source tables, columns and owners for visits, leads, orders and collections | Not confirmed | Owners of each module |
| D8 | Business timezone and currency | Asia/Kolkata and INR | Product |
| D9 | Notification channel and digest time | In-app, daily digest | Product and frontend |
| D10 | Who may edit rule thresholds | Senior Manager and Executive Director, logged | Product |
| D11 | Grace window for late offline events after a period ends | 3 days | Business |

### 11.5 Must fix before build

The eight critical gaps decide whether the numbers are right and the data is safe. In order of when they are needed:

1. P-1: put the tables behind the right schema or row-level security before the first table script is run. This is the cheapest to fix at the start and the most costly to discover later.
2. MT-3: the progress ledger, which also covers the engineers' items on multiple targets and reversals. Designed in 6.7.
3. MT-2: team, territory and branch targets on the read path, so reps see the targets that apply to them. Designed in 6.1.
4. MT-4: outbox and nightly reconciliation, so a failed handler cannot lose progress. Designed in 6.1 and 6.7.
5. MT-1: backfill when a target is created or its start date moves. Designed in 6.1.
6. RL-1: suppression after dismissal. Designed in 6.5.
7. RL-2: server-side scoping of alerts and restricted rule editing.
8. P-2: run the scanner on a connection that keeps session locks.

**Status, 22 October 2026.** Every critical and high gap in 11.1 to 11.3, and the medium ones, is now designed in the implementation plans. Section 9 of each plan lists each gap with its fix and build task. The business decisions D1 to D12 still need sign-off. D12 (retention periods) was added with the archive design in 6.8.

The remaining 38 gaps can be scheduled by phase: the high ones in the phase that ships their feature, the medium ones before general release.

Sources: [Supabase, connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres); [Supabase discussion 28239, disabling prepared statements](https://github.com/orgs/supabase/discussions/28239); [Supabase, row level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
