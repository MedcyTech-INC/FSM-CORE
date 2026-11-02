# Implementation Plan: Revenue Leakage Detection

Oct 22, 2026 · @AI Engineer

## 1. Goal, scope and how to use this plan

Build Revenue Leakage Detection as a scanner that raises operational warnings, never loss figures: five configurable rules run nightly, each unresolved issue is one alert, and managers act on it with a recorded outcome. This plan is self-contained. It folds the architecture spec (revision 4), the two engineering reviews and every accepted fix from the critic review into one build sequence.

- **Stack:** Python, FastAPI, SQLAlchemy 2.0 async (queries only), asyncpg, Pydantic v2, PostgreSQL. There is no Alembic: the database is changed only by plain SQL scripts that the product owner runs by hand in the Supabase SQL editor. Supabase is only the hosted database on our own server, not an API layer, auth service or edge-function host.
- **In scope:** SQL scripts for the tables, five rules, scanner, alert lifecycle, notifications, endpoints, the React screens (section 12), tests.
- **Out of scope:** a financial-loss ledger, recovery engine, AI scoring, and the visit, lead, order, leave and org tables, which other teams own.
- **Language rule:** alerts state what was observed. Never use the words loss, lost revenue or leakage amount in a label, field name or message. Money appears only when its source and basis can be stated, and amounts on different alerts are never added.
- **Rules for the builder:**
  1. Follow section 8 in order and pass each phase's acceptance checks before starting the next.
  2. Where a DECISION appears, build the stated default and keep it in configuration or the rule row, so it can change without a schema change.
  3. A resolved alert is never reopened or edited. A returning issue creates a new occurrence.
  4. Where an input table is owned by another team and not yet confirmed (decision D7), code against the interface in `ports.py` and use a fake implementation in tests.
  5. Monthly Target ships first. Only the territory rule depends on it; build that rule last.
  6. Database changes are SQL scripts only (section 3). Do not add Alembic and do not let SQLAlchemy create or alter tables.
  7. The frontend must look and behave like the existing app (section 12). Reuse its components, theme and patterns; add no new UI library.
  8. Keep every file of the feature inside its own folder, backend and frontend. Shared files stay outside (section 3).

## 2. Locked decisions and defaults

The business has not confirmed every decision. Build each default below, store it in the rule row or configuration, and do not wait. Changing a default later must not need a schema change.

| ID | Decision | Default to build | Where it lives | Owner |
| --- | --- | --- | --- | --- |
| D4 | Working days | Monday to Saturday, minus holidays and the rep's approved leave. All day thresholds count working days. | Table `holidays`; port `LeaveProvider` | HR, Leave module team |
| D5 | Recurrence and escalation | Cool-down 7 days after resolving as normal variation. Dismissal suppression 30 days. Auto-clear after 2 scans without the condition. Escalate one level after 3 working days unacknowledged. | Columns on `leakage_rules` | Business, engineering |
| D6 | Priority ratios | Medium at 1.5 times the threshold, high at 2.0 times. These are placeholders for first deployment and are editable. | `leakage_rules` | Sales leadership |
| D7 | Source tables and columns | Not confirmed. Code against the ports in `ports.py`. | Port implementations | Each module owner |
| D8 | Timezone and currency | Asia/Kolkata and INR. | `BUSINESS_TZ` | Product |
| D9 | Notification channel and digest time | In-app notification, one daily digest at 08:30 Asia/Kolkata. | `digest_time`, `notification_channel` | Product, frontend |
| D10 | Who edits thresholds | Senior Manager and Executive Director. Every edit is logged. | Role check in the service | Product |

**Rules the engineering review already agreed** (not open for debate):

- All five rules produce operational warnings only. The other three classification levels are reserved in the enum and never produced in this release.
- Attention priority (low, medium, high) comes from the observed value divided by the rule's threshold. There is no 0 to 100 score.
- At most one unresolved alert (active or acknowledged) exists per rule and entity. A partial unique index enforces it.
- A resolved alert is never reopened. A returning issue creates a new occurrence linked to the earlier one.
- A scan that sees the same issue again writes no history row unless the evidence changed in one of four defined ways (section 5).
- Scans never overlap, each rule commits on its own, and a retry cannot duplicate alerts or notifications.

**Clarifications this plan adds** to the spec, so the builder does not have to guess:

- Rule-specific settings that do not fit `threshold_days` and `threshold_value` live in a `params` JSON column on `leakage_rules`.
- Auto-clear adds a system-only outcome, `condition_cleared`, to the outcome enum.
- Two read endpoints are added so the rule and scan screens work: `GET /revenue-leakage/rules` and `GET /revenue-leakage/scan-runs`.
- Creating a task for the rep (RL-F10) is built behind a flag, `create_tasks_for_alerts`, default off, through a `TaskCreator` port.

## 3. Folder layout and conventions

Use a feature-based layout. Each request goes router, then service, then crud, then the database. Routers hold no business logic.

Everything that belongs to one feature sits in that feature's folder: code, SQL scripts, tests and screens. Only shared items sit outside: `.env`, `app/main.py`, `app/core/`, `app/shared_contracts/` and the root `sql/00_foundation.sql`.

```text
.env                       # secrets and settings, outside every feature
.env.example
sql/
  00_foundation.sql        # shared, run once: schema, role, grants, row-level security, holidays
  00_foundation.rollback.sql
app/
  main.py                  # registers each feature's router, one line per feature
  core/                    # config (reads .env), db, security, scope (hierarchy), errors
  shared_contracts/        # versioned event models and shared enums
  features/
    revenue_leakage/
      router.py          # HTTP only
      schemas.py         # Pydantic request and response models
      models.py          # SQLAlchemy tables (must match the SQL scripts)
      crud.py            # queries only, including the upsert
      service.py         # alert actions, rule edits, reads
      rules/
        base.py          # Rule interface: evaluate(batch) -> findings
        unvisited_client.py
        abandoned_lead.py
        declining_frequency.py
        inactive_opportunity.py
        underperforming_territory.py
      priority.py        # ratio to low, medium, high, with reason text
      calendar.py        # working-day calculation
      scanner.py         # lock, per-rule run, retry, scan_runs
      lifecycle.py       # upsert, observations, recurrence, suppression, auto-clear
      recipients.py      # who is told, escalation
      notifications.py   # immediate messages and daily digest
      jobs.py            # nightly scan, digest, escalation entry points
      ports.py           # interfaces to visits, orders, leads, leave, org, targets, sync
      sql/
        01_tables.sql            # all tables, partial unique index, checks, seeds
        01_tables.rollback.sql
        02_archive.sql           # archive schema, alert_chains fill (T-22)
        02_archive.rollback.sql
      tests/
src/                       # the existing React app
  features/
    revenue_leakage/
      pages/           # alert dashboard, alert detail, rules, scan runs
      components/      # pieces used only by this feature
      api/             # calls and hooks for this feature's endpoints
      tests/
```

**Conventions**

- **Database isolation:** create every table in a separate schema, `fsm_app`, that the Supabase API does not expose. Revoke all grants on it from `anon` and `authenticated`. Enable row-level security on every table with no public policy. The app connects with its own role, `fsm_app_user` (critic gap P-1).
- **Connections:** run the scanner on the direct connection (port 5432) or session mode, because the scan lock is a session advisory lock. If the API uses the transaction pooler (port 6543), create its asyncpg engine with `statement_cache_size=0` (critic gap P-2).
- **Database scripts (no Alembic):** every database change is a plain SQL file, numbered in run order, in the feature's `sql/` folder, each with a matching `.rollback.sql`. Shared items (schema `fsm_app`, role, grants, row-level security, `holidays`) are in the root `sql/00_foundation.sql`, run once before any feature script. Each script can be run twice without error, holds its own seed data and ends with a check query that shows it worked. The product owner runs them by hand in the Supabase SQL editor, in number order, after a backup and first on a test project. An executed script is never edited; a later change is a new numbered script. SQLAlchemy models only read and write rows and must match the scripts; application code never creates or alters tables. The role password and database URLs live in `.env`, never in a script.
- **Types:** UUID primary keys, `timestamptz` in UTC, `numeric(15,2)` for money, `Decimal` in Python.
- **Dates:** convert timestamps to `BUSINESS_TZ` before taking a date or counting working days.
- **Lists:** every list endpoint paginates, default page size 25, cap 100.
- **Retries:** every POST that creates something accepts an `Idempotency-Key` header and stores it with the record.
- **Single scheduler:** run the nightly scan, digest and escalation in one dedicated worker process or an external cron, never in every API worker (critic gap P-3). The database lock stays as the backstop.
- **Scan queries:** read only through the ports, in batches with keyset pagination, with a statement timeout of 60 seconds per query, and only off-peak.

## 4. Data model

Create all tables in schema `fsm_app` with one SQL script per phase (the shared `holidays` table is in the foundation script), each with a rollback script tested on a test project. Create the partial unique index in the same script as `leakage_alerts`, before any scan can run. Enumerations: `rule_code` = unvisited\_client, abandoned\_lead, declining\_frequency, inactive\_opportunity, underperforming\_territory. `classification` = operational\_warning, potential\_exposure, confirmed\_commercial\_loss, verified\_financial\_discrepancy (only the first is produced). `attention_priority` = low, medium, high. `alert_status` = active, acknowledged, resolved, dismissed. `action_type` = acknowledged, resolved, dismissed, note, escalated, auto\_cleared. `outcome` = normal\_variation, investigation\_needed, corrective\_action\_taken, commercial\_outcome\_evidenced, condition\_cleared (system only).

**leakage\_rules**

| Column | Type | Rules |
| --- | --- | --- |
| id | UUID | PK |
| rule\_code | enum | Unique |
| rule\_name | varchar(255), description varchar(500) | Name not null |
| threshold\_days | integer | Default 30, at least 1. Counted in working days |
| threshold\_value | numeric(15,2) | Default 0, at least 0 |
| medium\_priority\_ratio, high\_priority\_ratio | numeric(5,2) | Not null. Defaults 1.50 and 2.00. High must exceed medium, and medium must be at least 1 |
| change\_ratio | numeric(5,2) | Default 0.10. A move this large in the main value writes an observation |
| cooldown\_days | integer | Default 7 |
| dismiss\_days | integer | Default 30 |
| autoclear\_scans | integer | Default 2 |
| escalation\_days | integer | Default 3, working days |
| min\_history\_months | integer | Default 3 |
| params | JSONB | Rule-specific settings, see section 5 |
| required\_sources | text\[\] | Source keys the rule reads, for example {visits, orders} |
| is\_active | boolean | Default true |
| created\_at, updated\_at | timestamptz | Default now |

**rule\_changes**: id, rule\_id (FK), field, old\_value, new\_value, reason (varchar 500, not null), changed\_by (UUID, not null), changed\_at. Written on every rule edit (critic gap RL-2).

**leakage\_alerts**

| Column | Type | Rules |
| --- | --- | --- |
| id | UUID | PK |
| rule\_id | UUID | FK to leakage\_rules |
| entity\_type | varchar(50) | customer, lead or territory |
| entity\_id | UUID | Not null |
| classification | enum | Default operational\_warning |
| attention\_priority | enum | Not null |
| priority\_reason | varchar(500) | Not null, plain words |
| observation | JSONB | Not null. Current evidence, including the threshold and ratios used (critic gap RL-12) |
| exposure\_amount | numeric(15,2) | Null. Only when a reliable source exists |
| exposure\_basis | varchar(500) | Required when exposure\_amount is set (check constraint) |
| status | enum | Default active |
| version | integer | Default 1, increases on every status change. Used for optimistic locking |
| occurrence\_no | integer | Default 1 |
| previous\_alert\_id | UUID | Null for occurrence 1. No foreign key, so archived alerts can still be referenced; alert\_chains keeps the chain consistent (section 4.1) |
| first\_detected\_at, last\_observed\_at | timestamptz | Default now |
| last\_notified\_at | timestamptz | Null |
| clear\_streak | integer | Default 0. Consecutive scans that did not see the condition |
| suppressed\_until | timestamptz | Null. Set when the alert closes as normal variation or dismissed |
| escalation\_level | integer | Default 0 |
| escalated\_at | timestamptz | Null |
| resolved\_at | timestamptz | Null |

**Partial unique index:** unique on (rule\_id, entity\_type, entity\_id) where status in ('active','acknowledged'). Other indexes: (status, attention\_priority), (entity\_type, entity\_id), (previous\_alert\_id).

**alert\_actions**

| Column | Type | Rules |
| --- | --- | --- |
| id | UUID | PK |
| alert\_id | UUID | FK to leakage\_alerts, on delete restrict |
| action\_type | enum | Not null |
| outcome | enum | Required for resolved and dismissed |
| action\_taken | varchar(255) | Not null, at least 5 characters |
| evidence\_reference | varchar(255) | Required when outcome is commercial\_outcome\_evidenced |
| notes | varchar(1000) | Null |
| action\_by | UUID | Not null. The system user for auto-clear and escalation |
| idempotency\_key | varchar(100) | Null. Unique on (alert\_id, idempotency\_key) where not null |
| created\_at | timestamptz | Default now |

**alert\_observations**: id, alert\_id (FK), observed\_at, observation (JSONB, not null, includes the threshold and baseline used), attention\_priority (enum), reason (enum: created, priority\_changed, value\_changed, resolved, suppressed\_recurrence).

**scan\_runs**: id, rule\_code, mode (baseline or normal), started\_at, heartbeat\_at, finished\_at (null while running), status (running, succeeded, failed, partial, skipped\_source\_missing), rows\_evaluated, alerts\_created, alerts\_updated, alerts\_cleared, skipped\_not\_synced, attempt (integer), error\_message (varchar 1000, null).

**source\_availability**: source\_key (varchar PK: visits, orders, leads, targets, leave, sync), is\_available (boolean), checked\_at, note. A rule runs only when every key in its `required_sources` is available (critic gap RL-14).

**user\_sync\_state**: user\_id (UUID PK), last\_synced\_at (timestamptz). Written when the PWA syncs; read through the `SyncStateProvider` port (critic gap RL-13).

**alert\_notifications**: id, alert\_id (FK), recipient\_id, kind (created, priority\_raised, escalated), attention\_priority (the priority at the time), status (pending, sent), digest\_date (date, null), created\_at, sent\_at. Unique on (alert\_id, recipient\_id, kind, attention\_priority) so a rerun cannot send the same message twice.

**alert\_views**: id, alert\_id, viewer\_id, action (view, export), viewed\_at. Audit of who looked at alert evidence (critic gap P-10).

**holidays** (created once in `sql/00_foundation.sql`, shared with Monthly Target): holiday\_date (date PK), name, region (null).

### 4.1 Archive and retention (critic gap P-16)

Keep the live tables small so alert lists and the scanner's lookups stay fast. Create schema `fsm_archive` with the same isolation as `fsm_app`: no grants to `anon` or `authenticated`, row-level security on. Nothing is deleted without being archived first, except the technical tables listed last.

Add `fsm_app.alert_chains`: rule\_id, entity\_type, entity\_id (together the PK), last\_alert\_id, last\_occurrence\_no, last\_closed\_at, suppressed\_until, updated\_at. The scanner reads this table, not `leakage_alerts`, to number a new occurrence and to check suppression. It is updated in the same transaction as every alert create and close, and the SQL script that creates it fills it from existing alerts. This is why archiving closed alerts can never reset an occurrence number or lose a cool-down.

| Data | Stays live | Then |
| --- | --- | --- |
| Closed alerts (resolved or dismissed) with their alert\_actions and alert\_observations | 12 months after `resolved_at` (`archive_after_months`) | Moved to `fsm_archive` as a whole chain, and only when every alert in the chain is closed. Unresolved alerts never move |
| alert\_observations of open alerts | 24 months | Moved to `fsm_archive`, then deleted from the live table |
| alert\_views | 24 months | Moved to `fsm_archive`, then deleted from the live table |
| rule\_changes | Always | Never moved |
| scan\_runs | 12 months | Deleted |
| alert\_notifications | 90 days after `sent_at` | Deleted |
| fsm\_archive tables | 7 years (placeholder, decision D12) | Deleted by a yearly job after written sign-off |

**Archive job** (monthly, in the single scheduler process, one chain per transaction): copy the chain's alerts, actions and observations to `fsm_archive`, check that the copied row counts equal the live counts, then delete the live rows in the order observations, actions, alerts. If any check fails, roll back that chain.

**Rules that keep the behaviour right**

- The detail endpoint lists archived occurrences in `occurrences[]` with `archived: true` and reads them read-only from the archive.
- Because archived alerts leave the live table, `previous_alert_id` has no foreign key. `alert_chains` keeps the chain consistent.
- A condition that returns for an archived chain creates the next occurrence from `alert_chains`, so numbering continues.
- Retention periods are defaults. The business, Finance and legal must sign them off (D12). The jobs read them from configuration.

## 5. Rules, priority, lifecycle and scanner algorithms

### 5.1 The five rules

Each rule is a class in `rules/` that implements `evaluate(batch)` and returns findings: entity, observed value, threshold, baseline description, reason text. A rule never writes to the database. All day counts are working days (section 2, D4). A finding exists only when the observed value is at least the threshold, which is a ratio of 1.0 or more.

| Rule | Fires when | Observed value | Skip an entity when | Evidence shown |
| --- | --- | --- | --- | --- |
| unvisited\_client | Average monthly order value over the last 3 full months is at least `threshold_value`, and working days since the reference date exceed `threshold_days` | Working days since the reference date | Younger than `min_history_months`; the rep has not synced within the grace period | Last verified visit, expected cadence, working days overdue, the average used |
| abandoned\_lead | An open lead has had no follow-up status change for more than `threshold_days` | Working days since the last follow-up | Lead is Won or Lost; lead is younger than the threshold | Stage, last follow-up date, days since |
| declining\_frequency | For `params.consecutive_months` (default 2) full months in a row, order count falls at least `params.min_fall_percent` (default 30) below the baseline | Fall percent in the latest month | Fewer than `min_history_months` of history; baseline is 0 | Fall percent, the baseline and how it was built, months compared. No money loss is stated |
| inactive\_opportunity | An open opportunity has stayed in one pipeline stage more than `threshold_days` with no visit or call logged in that time | Working days in stage | Stage is closed; the rep has not synced | Stage, days in stage, last activity. The opportunity is not marked Lost |
| underperforming\_territory | Achievement against the territory's active revenue target is behind the share of working days elapsed by more than `threshold_value` percentage points | Shortfall in percentage points | Territory has no active revenue target; fewer than 5 working days elapsed | Achievement percent, expected percent, target id. A gap in achievement, not a money loss |

**Reference date (unvisited\_client, critic gap RL-3):** the last verified visit. If there is none, use the later of the date the client became high-value and the date it was assigned to the current rep. A client who was never visited must still fire.

**Declining frequency baseline (critic gaps RL-4, RL-5):** the average of the 3 full months before the compared months. Once 12 months of data exist, also compare each month with the same month last year and use whichever baseline gives the smaller fall. Store the chosen baseline's name and value in the evidence.

**Territory rule dependency:** it reads Monthly Target progress through the `TargetsProvider` port. Build it last.

### 5.2 Attention priority

`ratio = observed value / threshold`, where the threshold is `threshold_days` for the day-based rules and `threshold_value` or `params.min_fall_percent` for the others. `high` when the ratio is at least `high_priority_ratio`, `medium` when at least `medium_priority_ratio`, otherwise `low`. Store a plain-words reason such as '41 working days since the last verified visit against a threshold of 30 (ratio 1.37).' Store the threshold and both ratios used in the observation, so an old alert can still be explained after a threshold changes (critic gap RL-12).

### 5.3 Upsert, observation and priority rise

For each finding, run one statement through SQLAlchemy's `insert(...).on_conflict_do_update(index_elements=[rule_id, entity_type, entity_id], index_where=status in (active, acknowledged))`. On insert it creates the alert. On conflict it updates `last_observed_at`, `observation`, `attention_priority`, `priority_reason` and sets `clear_streak = 0`, and never touches status, version or manager actions. Use `RETURNING` with `(xmax = 0)` to know whether the row was inserted.

Write a row to `alert_observations` in exactly four cases and no other:

1. The alert is created (reason `created`).
2. Its attention priority changes (`priority_changed`).
3. The main observed value has moved by at least the rule's `change_ratio` since the last stored observation (`value_changed`).
4. The alert is resolved or auto-cleared (`resolved`).

A scan that sees an unchanged issue only updates `last_observed_at`, which proves the issue was present that day. A year of daily scans on an unchanged issue stores two rows, not 365.

### 5.4 Recurrence, suppression and auto-clear

- **Recurrence:** a resolved alert is never reopened. Before inserting, read the alert\_chains row for the same rule and entity (section 4.1). If there is none, `occurrence_no = 1`. If one exists and is not suppressed, insert a new alert with `occurrence_no` one higher and `previous_alert_id` set. Each episode keeps its own actions and observations. The new occurrence sends a notification and the screen shows 'Occurrence 2' linked to the earlier ones.
- **Suppression:** when a manager resolves with `normal_variation`, set `suppressed_until = now + cooldown_days` (default 7) on the closed alert. A dismissal sets it to `now + dismiss_days` (default 30) and needs a reason. While `suppressed_until` is in the future, a returning condition writes an observation with reason `suppressed_recurrence` on the closed alert and raises nothing. Every other outcome has no cool-down (critic gap RL-1).
- **Auto-clear:** after a scan finishes a rule **successfully**, every unresolved alert of that rule that was not seen in this run gets `clear_streak + 1`. At `autoclear_scans` (default 2) the scanner resolves it with outcome `condition_cleared`, writes a final observation, and records the system user. Do not count an entity as absent when it was skipped because its rep had not synced, or when the rule was skipped for a missing source. A failed or partial run changes no streaks.

### 5.5 Alert actions

A request carries `expected_version`. A mismatch returns 409 so two managers cannot overwrite each other (critic gap RL-11). Every successful action raises `version` by 1 and writes an `alert_actions` row.

| action\_type | Status after | Needs |
| --- | --- | --- |
| acknowledged | acknowledged | action\_taken |
| resolved | resolved, `resolved_at` set | outcome, action\_taken; evidence\_reference when the outcome is commercial\_outcome\_evidenced |
| dismissed | dismissed, `resolved_at` set | outcome, action\_taken (the reason) |
| note | unchanged | action\_taken |

A lead or opportunity is never marked Lost by any of this. Only a documented customer outcome does that, in the lead module.

### 5.6 Who owns and who is told

The owner is **resolved at read time** from the current assignment, never copied into the alert, so a reassigned client's open alerts move with it (critic gap RL-6). Recipients: client and lead alerts go to the rep's RSM; territory alerts go to the Branch Manager. If an alert stays `active` for `escalation_days` working days, create an `escalated` notification to the next level up, set `escalation_level` and `escalated_at`, and write an `alert_actions` row of type `escalated` by the system user (critic gap RL-7).

## 6. API contracts and access control

Validate at the boundary with Pydantic. Enforce role and hierarchy scope on the server for every query. Never trust a filter from the client (critic gap RL-2).

### 6.1 Endpoints

| Method and path | Purpose | Allowed roles |
| --- | --- | --- |
| GET /revenue-leakage/alerts | List alerts in the caller's scope. Filters: attention\_priority, rule\_code, status, entity\_type, occurrence. Sort by priority then last\_observed\_at. Paginated | RSM, Branch Manager and above |
| GET /revenue-leakage/alerts/{alert\_id} | One alert with observations, actions, owner and the chain of earlier occurrences. Writes an `alert_views` row | RSM, Branch Manager and above, inside scope |
| POST /revenue-leakage/alerts/{alert\_id}/actions | Acknowledge, resolve, dismiss or add a note. Accepts `Idempotency-Key` | RSM, Branch Manager and above, inside scope |
| GET /revenue-leakage/rules | List rules with their current settings | Senior Manager and above |
| PATCH /revenue-leakage/rules/{rule\_id} | Change thresholds, ratios, settings or switch a rule on or off. Writes `rule_changes` | Senior Manager and above |
| GET /revenue-leakage/scan-runs | Recent scan runs and their status | Senior Manager and above |

The AI Daily Sales Plan reads alerts through `GET /revenue-leakage/alerts` with the internal service role and an `owner_id` filter. No separate route is added.

**Scope:** Executive Director sees all alerts. Senior Manager sees the hospital network. Branch Manager sees the branch. Team Lead or RSM sees the team. Field Officer has no access. Scope is applied in the SQL query, through the owner resolved from the current assignment, so an alert outside scope returns 404, not 403.

### 6.2 Alert (response)

| Field | Type | Notes |
| --- | --- | --- |
| id | UUID |  |
| rule\_code | enum | Which rule fired |
| entity\_type, entity\_id | string, UUID | customer, lead or territory |
| entity\_label | string | Display name resolved through the ports |
| owner\_id | UUID | Resolved at read time |
| classification | enum | operational\_warning in this release |
| attention\_priority | enum | low, medium, high |
| priority\_reason | string | Plain words |
| observation | object | Observed value, threshold, ratios used, baseline, observation date, suggested check |
| exposure\_amount, exposure\_basis | number, string | Present only when a reliable source exists |
| status | enum | active, acknowledged, resolved, dismissed |
| version | integer | Send this back with an action |
| occurrence\_no | integer | 1 for the first |
| previous\_alert\_id | UUID or null | Earlier occurrence |
| first\_detected\_at, last\_observed\_at, resolved\_at | timestamps |  |
| suppressed\_until | timestamp or null |  |

The detail response adds `observations[]` (observed\_at, observation, attention\_priority, reason), `actions[]` (action\_type, outcome, action\_taken, evidence\_reference, notes, action\_by, created\_at) and `occurrences[]` (id, occurrence\_no, status, first\_detected\_at, resolved\_at).

### 6.3 Alert action (POST .../actions)

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| action\_type | enum | Yes | acknowledged, resolved, dismissed, note |
| expected\_version | integer | Yes | Must equal the alert's version, else 409 |
| outcome | enum | For resolved and dismissed | normal\_variation, investigation\_needed, corrective\_action\_taken, commercial\_outcome\_evidenced. condition\_cleared is rejected |
| action\_taken | string | Yes | At least 5 characters, up to 255 |
| evidence\_reference | string | When outcome is commercial\_outcome\_evidenced | Up to 255 characters |
| notes | string | No | Up to 1,000 characters |

Acting on an alert that is already resolved or dismissed returns 409 `alert_closed`. Response 200 returns the updated alert.

### 6.4 Rule update (PATCH .../rules/{rule\_id})

| Field | Type | Rules |
| --- | --- | --- |
| threshold\_days | integer | At least 1 |
| threshold\_value | number | At least 0 |
| medium\_priority\_ratio | number | At least 1 and below high\_priority\_ratio |
| high\_priority\_ratio | number | Above medium\_priority\_ratio |
| change\_ratio | number | Above 0 and at most 1 |
| cooldown\_days, dismiss\_days | integer | At least 0 |
| autoclear\_scans | integer | At least 1 |
| escalation\_days | integer | At least 1 |
| min\_history\_months | integer | At least 1 |
| params | object | Validated per rule |
| is\_active | boolean |  |
| reason | string | Required, 5 to 500 characters |

Every accepted change writes one `rule_changes` row per field with old and new value. A change affects only future scans and never rewrites old alerts.

### 6.5 Errors

Every error returns `{ "error": { "code": string, "message": string, "details": object or null } }`.

| Status | Code | When |
| --- | --- | --- |
| 401 | unauthenticated | Missing or invalid sign-in |
| 403 | forbidden\_role | Role may not call this route, or edit rules |
| 404 | not\_found | Unknown alert, or one outside scope |
| 409 | version\_conflict | `expected_version` does not match. Return the current version |
| 409 | alert\_closed | The alert is already resolved or dismissed |
| 422 | validation\_error | Field rules above |

## 7. Scanner reliability and notifications

### 7.1 Scheduling and locking

1. One dedicated worker process (or external cron) runs `python -m app.features.revenue_leakage.jobs scan` nightly at 01:30 Asia/Kolkata. API workers never schedule it (critic gap P-3).
2. The scanner opens a **direct** database connection (port 5432) or a session-mode connection and calls `pg_try_advisory_lock(hashtext('leakage_scan:' || rule_code))`. If the lock is not granted, log it and skip that rule. The lock is held for the whole rule run on that one connection (critic gap P-2).
3. As a second guard, insert a `scan_runs` row with status `running` and refresh `heartbeat_at` every 30 seconds. A `running` row with a heartbeat newer than 15 minutes counts as a held lock even if the advisory lock was lost. A `running` row older than that is marked `failed` before a new run starts.
4. Rules run and commit **one at a time**. A failure rolls back only that rule. Retry a failed rule up to 3 times with 5 minutes between attempts, then leave it `failed` and alert engineering. Other rules' results stand.
5. Before a rule runs, check `source_availability` for every key in its `required_sources`. If any is unavailable, write a `scan_runs` row with status `skipped_source_missing`, make no changes and count no streaks (critic gap RL-14).
6. Read source data in batches of 1,000 with keyset pagination, set `statement_timeout` to 60 seconds, and keep the scan in the off-peak window. Add indexes on the source columns the rules filter on, through the owning teams (critic gap P-4).

### 7.2 Late sync protection

Before evaluating a rep's clients or leads, read `last_synced_at` through `SyncStateProvider`. If the rep has not synced within 24 hours (setting `sync_grace_hours`), skip that rep, count them in `scan_runs.skipped_not_synced`, and do not advance their `clear_streak` (critic gap RL-13). Show 'not evaluated: no recent sync' on the rep's alerts. If the provider is unavailable, treat every rep as synced and log a warning.

### 7.3 First run

The first successful scan of each rule runs in `baseline` mode: it creates alerts silently with no notifications, then sends **one** summary message per manager ('N alerts created in your scope'). Without this, managers receive hundreds of messages on day one (critic gap RL-9).

### 7.4 Notifications

| Trigger | Message | When sent |
| --- | --- | --- |
| New alert, occurrence or priority rise to **high** | Immediate, one per alert | Right after the rule commits |
| New alert or rise to low or medium | Included in the daily digest | 08:30 Asia/Kolkata, one digest per manager |
| Alert still `active` after `escalation_days` | Immediate message to the next level up | Escalation job, hourly |
| Repeated scan on an unchanged alert | None | Never |

Write a row to `alert_notifications` before sending. Its unique key (alert, recipient, kind, priority) makes a rerun or crash unable to send the same message twice. Set `last_notified_at` on the alert when a message is queued. The channel is in-app (decision D9) behind a `Notifier` interface, so email or push can be added later.

### 7.5 Observability

Expose as metrics and alert engineering on: scan failure, a scan not started by 03:00, rules skipped for missing sources, `skipped_not_synced` above 20 percent of reps, pending notifications older than 1 hour, and unresolved alerts older than 90 days (critic gap P-8). Take a database backup before every SQL script is run and rehearse a restore once before go-live.

## 8. Build order

Nine phases. Finish each phase's acceptance checks before starting the next. Each task id (T-01 and so on) is referenced in section 9.

### Phase 0: Foundations

- **T-01** Use `sql/00_foundation.sql` (shared; written in the Monthly Target plan, or written here if this feature is built first): schema `fsm_app`, role `fsm_app_user` (password set by hand, kept in `.env`), revoke grants from `anon` and `authenticated`, default row-level security with no policy on every table, and the shared `holidays` table. *Accept:* a query as `anon` against any table returns permission denied.
- **T-02** Set up settings read from `.env` (`BUSINESS_TZ`, flags, digest time, grace hours), the async engine (`statement_cache_size=0` when pooled), and the one error format. *Accept:* the app starts from `.env` alone and a health call reaches the database.
- **T-03** Build `scope.py` (hierarchy resolution) and the role dependencies. *Accept:* unit tests for each of the five roles, including an RSM trying to reach another team.
- **T-04** Define the ports (`VisitsProvider`, `OrdersProvider`, `LeadsProvider`, `LeaveProvider`, `OrgProvider`, `TargetsProvider`, `SyncStateProvider`, `TaskCreator`, `Notifier`) with fake implementations. *Accept:* every rule can be tested with fakes only.

### Phase 1: Data model

- **T-05** `01_tables.sql` and `01_tables.rollback.sql` in the feature `sql/` folder for every table in section 4: all constraints, the partial unique index, check constraints (exposure\_basis, high ratio above medium), and seeds for the five rules (defaults in section 2). *Accept:* inserting a second active alert for the same rule and entity fails; an alert with an amount but no basis fails; the rollback works and the script runs twice without error.

### Phase 2: Pure logic

- **T-06** `calendar.py`: working days with holidays and leave. *Accept:* tests for Sundays, a holiday, approved leave, same-day range.
- **T-07** `priority.py`: ratio to level and reason text. *Accept:* ratio 1.37 gives low, 1.5 gives medium, 2.0 gives high, and the reason text names the observed value, the threshold and the ratio.

### Phase 3: Lifecycle core

- **T-08** `lifecycle.py` upsert with `ON CONFLICT` on the partial index, `xmax` insert detection, and observation writing in the four defined cases. *Accept:* 30 identical scans store 2 observation rows; a priority change adds one; a 12 percent value move adds one.
- **T-09** Recurrence and suppression: new occurrence linked to the previous, cool-down and dismissal suppression. *Accept:* resolve as normal variation then re-detect in 3 days writes a `suppressed_recurrence` observation and no alert; re-detect in 8 days creates occurrence 2.
- **T-10** Auto-clear with `clear_streak`. *Accept:* absent on two consecutive successful scans resolves with `condition_cleared`; a failed scan, a skipped rule or a skipped (not synced) rep changes no streak.
- **T-11** Alert actions with `expected_version`, outcome rules and idempotency key. *Accept:* two actions with the same version return 200 then 409; commercial outcome without evidence returns 422; acting on a closed alert returns 409.

### Phase 4: Scanner

- **T-12** `scanner.py`: advisory lock on a direct connection, `scan_runs` with heartbeat, per-rule commit, retry, source-availability check, baseline mode. *Accept:* two parallel runs of one rule produce one set of alerts; killing a run leaves a stale `running` row that the next run clears; a missing source produces `skipped_source_missing`.
- **T-13** Rules 1 to 4 (unvisited client, abandoned lead, declining frequency, inactive opportunity) with fakes. *Accept:* each worked example in section 10 produces exactly the stated alert; a never-visited client fires; a new account with under 3 months of history does not.
- **T-14** Sync-grace skip using `SyncStateProvider`. *Accept:* a rep who has not synced for 30 hours is skipped and counted.

### Phase 5: Access, API and notifications

- **T-15** Alert list and detail endpoints with SQL-level scope, owner resolved at read time, `alert_views` audit, pagination. *Accept:* an RSM never sees another team's alert (404); after reassigning a client, the new RSM sees its open alerts.
- **T-16** Rule list and PATCH with `rule_changes`, role check for Senior Manager and above, validation. *Accept:* a Branch Manager gets 403; every edited field has an old and new value logged.
- **T-17** Recipients, escalation job, immediate messages, daily digest and baseline summary through `Notifier`. *Accept:* 100 alerts for one manager in a baseline run produce one summary; a rerun sends nothing new.
- **T-18** `GET /revenue-leakage/scan-runs` and the metrics in section 7.5. *Accept:* a failed scan appears in the list and triggers the engineering alert.

### Phase 6: Territory rule (after Monthly Target ships)

- **T-19** Rule 5, `underperforming_territory`, through `TargetsProvider`. *Accept:* a territory at 40 percent achievement when 70 percent of working days have passed, with a 15-point threshold, fires with shortfall 30 and ratio 2.0 (high); a territory with no revenue target is skipped with a recorded reason.

### Phase 7: Hardening and handoff

- **T-20** Indexes on source columns (with the owning teams), load test with 100,000 entities per rule inside the off-peak window. *Accept:* a full scan finishes inside 30 minutes and does not raise p95 field API latency by more than 10 percent.
- **T-21** Contract tests for each port against the real tables once confirmed (decision D7). *Accept:* CI fails when a source column changes.
- **T-22** Archive and cleanup jobs (section 4.1), including alert\_chains. *Accept:* a fully closed chain older than 12 months moves to the archive; a returning condition still gets the next occurrence number and honours its cool-down; open alerts never move.
- **T-23** Optional task creation behind `create_tasks_for_alerts` through `TaskCreator`. *Accept:* with the flag off nothing is created; with it on a high-priority alert creates one task, once.
- **T-24** Backup before each SQL script is run, one rehearsed restore, final review against section 11.

### Phase 8: Frontend

Starts once the Phase 5 endpoints exist. Follow section 12. If the Monthly Target UI audit already exists, reuse it and add only what is new.

- **F-01** UI audit (or reuse the Monthly Target one), create `src/features/revenue_leakage/`, add routes and menu entries the way the app already does. *Accept:* the product owner approves the reuse list and the menu label.
- **F-02** API calls and hooks in the feature folder, using the app's existing data layer. *Accept:* every endpoint in section 6 is callable and every error maps as in section 12.
- **F-03** Alert dashboard. *Accept:* filters for priority, rule and status work with pagination; each row shows the priority and its reason; recurring alerts show 'Occurrence N'; a Field Officer has no menu entry.
- **F-04** Alert detail. *Accept:* shows observation, evidence, owner, history in time order and links to earlier occurrences; an amount appears only with its basis; no total exists anywhere.
- **F-05** Action dialog. *Accept:* outcome is required for resolve and dismiss; the evidence field appears only for commercial outcome evidenced; `condition_cleared` is never offered; a double tap records one action; a 409 shows the reload message.
- **F-06** Rules screen and scan runs screen. *Accept:* an edit needs a reason and shows ratio errors beside the field; a Branch Manager sees neither screen; a failed scan is visible in the list.
- **F-07** Notifications: in-app messages and the daily digest open the alert they mention. *Accept:* tapping a digest item opens that alert.
- **F-08** Side-by-side review with two existing screens. *Accept:* the product owner signs off the look; the dependency list has no new UI package.

## 9. Edge cases and gap fixes checklist

Every gap raised by the engineering reviews and the critic review, with where this plan fixes it. Nothing here is optional unless marked.

### 9.1 Engineering review issues (21 October 2026)

| # | Issue | Fix | Section | Task |
| --- | --- | --- | --- | --- |
| 1 | Alert recurrence after resolution | Never reopen. New occurrence linked to the previous; cool-down and dismissal suppression | 5.4 | T-09 |
| 2 | Observation frequency | `last_observed_at` on every scan; a history row only in four defined cases | 5.3 | T-08 |

### 9.2 Critic gaps for Revenue Leakage

| ID | Severity | Fix | Section | Task |
| --- | --- | --- | --- | --- |
| RL-1 | Critical | Dismissal needs a reason and sets `suppressed_until` | 5.4 | T-09 |
| RL-2 | Critical | Scope applied in SQL; only Senior Manager and above edit rules; every edit logged | 6.1, 6.4 | T-15, T-16 |
| RL-3 | High | Never-visited client uses the later of became-high-value and assigned dates | 5.1 | T-13 |
| RL-4 | High | Minimum history before a rule can fire | 5.1 | T-13 |
| RL-5 | High | 3-month baseline, plus same month last year once 12 months exist; baseline stated on the alert | 5.1 | T-13 |
| RL-6 | High | Owner resolved at read time from the current assignment | 5.6, 6.1 | T-15 |
| RL-7 | High | Recipients by entity type; escalation after `escalation_days` | 5.6, 7.4 | T-17 |
| RL-8 | Medium | Day thresholds count working days | 5.1 | T-06 |
| RL-9 | Medium | Baseline mode on the first run with one summary per manager | 7.3 | T-12, T-17 |
| RL-10 | Medium | Daily digest; immediate message only for high priority | 7.4 | T-17 |
| RL-11 | Medium | `version` on the alert and `expected_version` on actions | 5.5 | T-11 |
| RL-12 | Medium | Threshold and ratios stored in every observation | 5.2 | T-08 |
| RL-13 | Medium | Skip reps who have not synced; do not advance their streak | 7.2 | T-14 |
| RL-14 | Medium | A rule runs only when its sources are available; otherwise `skipped_source_missing` | 7.1 | T-12 |

### 9.3 Critic gaps that apply across the platform

| ID | Fix | Section | Task |
| --- | --- | --- | --- |
| P-1 | Separate schema, revoked grants, row-level security, own database role | 3 | T-01 |
| P-2 | Direct or session connection for the scan lock; heartbeat row as second guard; `statement_cache_size=0` on the pooler | 3, 7.1 | T-02, T-12 |
| P-3 | One dedicated scheduler process | 3, 7.1 | T-12 |
| P-4 | Batched keyset reads, statement timeout, source indexes, off-peak | 7.1 | T-20 |
| P-5 | Partial unique index created in the same SQL script as the table, before any scan; tested rollback script | 3, 4 | T-05 |
| P-6 | Versioned event models for the sync and lead sources | 3 | T-04 |
| P-7 | `Idempotency-Key` on alert actions | 4, 6.3 | T-11 |
| P-8 | Scan, notification and age metrics with engineering alerts | 7.5 | T-18 |
| P-9 | `timestamptz` in UTC; business date computed explicitly | 3 | T-06 |
| P-10 | Retention job; `alert_views` audit of who viewed evidence | 4, 6.1 | T-15, T-22 |
| P-11 | Every list paginated and capped | 3, 6.1 | T-15 |
| P-12 | Backup before each SQL script and a rehearsed restore | 7.5 | T-24 |
| P-13 | Test plan in section 10 | 10 | T-24 |
| P-14 | Port contracts and CI contract tests | 3 | T-21 |
| P-15 | Not applicable here: no AI payload is defined for alerts; the AI team reads the alert list | 6.1 | none |

**P-16 (added 22 October 2026): data growth and archive.** Alerts, observations, scan runs and notifications grow forever, and the scanner reads old alerts to number occurrences. Fix: archive whole closed chains, keep `alert_chains` for numbering and suppression, clean the technical tables on a schedule. Section 4.1, task T-22.

### 9.4 Items that still need a business answer

Build the default and keep it configurable. D4 (leave source), D5 (recurrence and escalation numbers), D6 (priority ratios), D7 (source tables), D9 (notification channel and digest time), D10 (who edits thresholds). They are listed with their defaults in section 2.

## 10. Test plan

Write the pure-logic tests first (T-06, T-07) and the rest alongside the code. Use `pytest` with a real PostgreSQL test database, never SQLite, because the partial unique index, `ON CONFLICT` and advisory locks are the point.

### 10.1 Worked examples for the rules

Use the default settings from section 2 and the rule seeds. Today is a Monday for easy counting.

| Rule | Setup | Expected alert |
| --- | --- | --- |
| unvisited\_client | Average monthly orders 120,000, `threshold_value` 100,000, `threshold_days` 30. Last verified visit 41 working days ago | Fires. Ratio 41 / 30 = 1.37, priority low. Reason names 41 days, threshold 30, ratio 1.37 |
| unvisited\_client | Same client, 61 working days ago | Ratio 2.03, priority high |
| unvisited\_client | Client never visited, high-value since 50 working days ago, assigned 20 working days ago | Reference date is the assigned date, 20 days. Does not fire at threshold 30 |
| unvisited\_client | Account 2 months old | Skipped: under `min_history_months` |
| abandoned\_lead | Open lead, last follow-up 45 working days ago, threshold 30 | Fires, ratio 1.5, medium. The lead is not marked Lost |
| declining\_frequency | Baseline 10 orders a month; last two months 6 and 5; `min_fall_percent` 30 | Fires. Latest fall 50 percent, ratio 1.67, medium. No money loss is stated |
| declining\_frequency | Baseline 0 | Skipped |
| inactive\_opportunity | Stage unchanged 70 working days, no visit or call, threshold 30 | Fires, ratio 2.33, high |
| underperforming\_territory | Target 1,000,000; achieved 400,000; 70 percent of working days elapsed; threshold 15 points | Expected 70, achieved 40, shortfall 30, ratio 2.0, high |
| underperforming\_territory | No active revenue target | Skipped with a recorded reason |

### 10.2 Behaviour tests

| Area | Test | Expected |
| --- | --- | --- |
| Dedup | Run the same scan 30 times | One unresolved alert; 2 observation rows |
| Dedup under concurrency | Two scans of one rule started together | One set of alerts; the second run is skipped or blocked |
| Index | Insert a second active alert for the same rule and entity directly | Database rejects it |
| Acknowledge | Acknowledge then re-scan | Same alert, still acknowledged, no replacement |
| Priority change | Ratio moves from 1.3 to 1.6 | Priority medium; one observation with reason `priority_changed`; notification queued |
| Value change | Observed value moves 12 percent, priority unchanged | One observation `value_changed` |
| Small change | Observed value moves 5 percent | No new observation |
| Recurrence | Resolve with `corrective_action_taken`, condition returns next scan | New alert, occurrence 2, `previous_alert_id` set, old alert untouched |
| Cool-down | Resolve as `normal_variation`, condition returns after 3 days | `suppressed_recurrence` observation on the old alert, no new alert |
| After cool-down | Same, condition returns after 8 days | Occurrence 2 created |
| Dismissal | Dismiss with a reason; condition returns after 10 days | Suppressed. After 31 days, occurrence 2 |
| Auto-clear | Condition absent on two consecutive successful scans | Resolved, outcome `condition_cleared`, system user, final observation |
| No auto-clear on failure | Absent once, then a failed scan, then absent once | Streak is 1, alert still open |
| No auto-clear when skipped | Rep not synced for 30 hours | Rep skipped, counted, streak unchanged |
| Action validation | Resolve without an outcome; commercial outcome without evidence; `condition_cleared` from a user | 422 each |
| Version conflict | Two actions with the same `expected_version` | 200 then 409 |
| Closed alert | Act on a resolved alert | 409 `alert_closed` |
| Idempotent action | Same `Idempotency-Key` twice | One action row |
| Scope | RSM requests an alert of another team; Branch Manager PATCHes a rule | 404; 403 |
| Reassignment | Reassign a client to another rep with an open alert | New owner sees it; history stays |
| Source missing | Orders source marked unavailable | Dependent rules write `skipped_source_missing`; no alerts change |
| Baseline run | First scan creates 100 alerts for one manager | Zero immediate messages; one summary |
| Digest | Three medium alerts and one high for a manager | One immediate message for the high one; one digest with the three |
| Rerun notifications | Rerun the same scan | No new notification rows |
| Escalation | Alert active 4 working days with `escalation_days` 3 | One escalated notification to the next level; none on the next run |
| Crash | Kill the scanner mid-rule | That rule rolls back; other rules stand; next run clears the stale `running` row |
| Language | Search all labels, fields and messages | None contain 'loss', 'lost revenue' or 'leakage amount' |
| Isolation | Query a table as `anon` | Permission denied |
| SQL scripts | Run in order, run the rollbacks, run again, on a test Supabase project | Clean each time |

## 11. Definition of done

The feature is done when every box is ticked and the evidence is attached to the pull request.

**Correctness**

- [ ] Every worked example in section 10.1 produces exactly the stated alert, priority and reason.
- [ ] Every behaviour test in section 10.2 passes against a real PostgreSQL database.
- [ ] The database rejects a second unresolved alert for the same rule and entity.
- [ ] 30 identical scans store one alert and two observation rows.
- [ ] A returning issue creates a linked new occurrence, honours cool-down and dismissal suppression, and never reopens an old alert.
- [ ] Auto-clear needs two consecutive successful scans and ignores failed, skipped and not-synced cases.
- [ ] A never-visited client fires; a young account does not.
- [ ] No label, field or message contains 'loss', 'lost revenue' or 'leakage amount', and no amounts are added across alerts.

**Safety and access**

- [ ] No table in `fsm_app` is readable by `anon` or `authenticated`; row-level security is on.
- [ ] Alert scope is enforced in SQL. Out-of-scope alerts return 404. Only Senior Manager and above can edit rules, and every edit is logged.
- [ ] Actions are conflict-safe (`expected_version`) and idempotent.
- [ ] Evidence views are audited and retention is enforced.

**Frontend**

- [ ] Screens use only the existing components, theme and patterns, and add no UI dependency.
- [ ] No label, button, message or empty state uses the words loss, lost revenue or leakage amount, and no screen shows a total across alerts.
- [ ] Every screen has loading, empty, error and retry states, and works at 360 px width.
- [ ] Role visibility is correct and the product owner signed off the look against existing screens.

**Reliability and operations**

- [ ] Two parallel scans of one rule never produce duplicates; a killed scan leaves no partial rule results.
- [ ] A missing source skips its rules with a recorded reason. A rep who has not synced is skipped, not alerted.
- [ ] The first run sends one summary per manager, not one message per alert. Reruns send nothing new.
- [ ] The scan runs in one dedicated worker on a direct or session connection, and finishes inside 30 minutes at 100,000 entities per rule.
- [ ] SQL scripts run clean in order, roll back clean and can be re-run, and a restore from backup was rehearsed.
- [ ] Metrics and engineering alerts from section 7.5 are live.

* [ ] Archive and cleanup jobs run, a returning condition for an archived chain still gets the right occurrence number and cool-down, and the retention periods (D12) are signed off.

**Open items handed back to the business**

- [ ] D4, D5, D6, D7, D9 and D10 are confirmed or their defaults are signed off in writing.
- [ ] Source tables and columns for visits, orders and leads are confirmed (D7) and contract tests pass in CI.
- [ ] The territory rule (T-19) is enabled only after Monthly Target is live in production.

## 12. Frontend and UI/UX

The screens go into the existing React PWA and must look and behave like the rest of the app, as if the same team built them.

**Match the existing UI (hard rule)**

- Before building, read the existing frontend and list what will be reused: layout shell and navigation, theme colours, fonts, spacing, icons, buttons, form fields, cards or tables, modals, toasts, loading, empty and error states, and how routes, sign-in and API calls are done. The list goes in the first pull request for sign-off.
- Reuse those parts as they are. No new UI library, colours, fonts or icon set, and no new way to call the API or guard routes. Priority low, medium and high use the app's existing neutral, warning and danger styles.
- Mobile first: works at 360 px width with the app's own breakpoints, and behaves offline the way the rest of the app does.
- Role visibility follows the role table in the spec. Field Officers see nothing from this feature. Rules and scan runs are for Senior Manager and above. The server enforces every rule; the screen only hides what the role cannot use.
- Language rule applies to the screen: no label, button, message or empty state uses the words loss, lost revenue or leakage amount. The classification reads 'Operational warning'. The menu label is agreed with the product owner.

**Screens**

| Screen | Who | What it shows |
| --- | --- | --- |
| Alert dashboard | RSM and above | Paginated unresolved alerts in the caller's scope; filters for priority, rule and status; each row has the rule, the customer, lead or territory, priority with its reason, occurrence label and last observed date |
| Alert detail | RSM and above | Observation, threshold, suggested check, owner, first detected and last observed, history in time order, manager actions, links to earlier occurrences, and an amount only when its basis is shown |
| Action dialog | RSM and above | Acknowledge, resolve, dismiss or note; outcome for resolve and dismiss; evidence reference when the outcome needs it; notes |
| Rules | Senior Manager and above | Each rule's thresholds, ratios and on or off switch, with a reason box on every edit and the change history |
| Scan runs | Senior Manager and above | Recent runs with status, counts, skipped reasons and errors |

**Behaviour**

- Every screen has loading, empty, error and retry states in the app's style.
- Money, when shown, uses INR in the app's money format with its basis beside it. Amounts are never added across alerts. Dates use the business timezone, never the device's.
- Actions send the alert version that was loaded and one idempotency key per opened dialog, and the button is disabled while sending.
- Errors: 409 version conflict says someone else updated the alert and offers a reload that keeps the typed notes; 422 shows messages beside the fields; 403 and 404 use the app's standard screens.
- Notifications use the app's existing in-app notification style; a daily digest item opens the alert.
