# Implementation Plan: Monthly Target

Oct 22, 2026 · @AI Engineer

## 1. Goal, scope and how to use this plan

Build the Monthly Target backend: managers set a numeric goal for people, teams, territories or branches; field activity feeds an append-only ledger; reps and managers read progress, gap and run rate. This plan is self-contained. It folds the architecture spec (revision 4), the two engineering reviews and every accepted fix from the critic review into one build sequence.

- **Stack:** Python, FastAPI, SQLAlchemy 2.0 async (queries only), asyncpg, Pydantic v2, PostgreSQL. There is no Alembic: the database is changed only by plain SQL scripts that the product owner runs by hand in the Supabase SQL editor. Supabase is only the hosted database on our own server. It is not used as an API layer, auth service or edge-function host.
- **In scope:** SQL scripts for the tables, services, endpoints, event handlers, outbox, closing and reconciliation jobs, the React screens (section 12), tests.
- **Out of scope:** Revenue Leakage (separate plan), the AI Daily Sales Plan service (it only reads one endpoint), and the visit, lead, order, payment, leave and org tables, which other teams own.
- **Rules for the builder:**
  1. Follow section 8 in order and pass each phase's acceptance checks before starting the next.
  2. Where a DECISION appears, build the stated default and keep it in configuration, so it can change without a schema change.
  3. Never edit or delete a ledger row. Corrections are new rows.
  4. Treat the API shapes in section 6 as frozen. The AI team builds against them.
  5. Where an input table is owned by another team and not yet confirmed (decision D7), code against the interface in `ports.py` and use a fake implementation in tests.
  6. Database changes are SQL scripts only (section 3). Do not add Alembic and do not let SQLAlchemy create or alter tables.
  7. The frontend must look and behave like the existing app (section 12). Reuse its components, theme and patterns; add no new UI library.
  8. Keep every file of the feature inside its own folder, backend and frontend. Shared files stay outside (section 3).

## 2. Locked decisions and defaults

The business has not confirmed every decision. Build each default below, read it from configuration, and do not wait. Changing a default later must not need a schema change.

| ID | Decision | Default to build | Config key | Owner |
| --- | --- | --- | --- | --- |
| D1 | Which visits count | Count on submission when the geofence flag is valid. A rejection or cancellation posts a reversal. In approval mode the handler counts on VisitApprovedEvent instead, and the submitted event is ignored. | `visit_counting_mode`: submission or approval | Product, visit team |
| D2 | Metric definitions | revenue = order value net of returns, dated at order close. doctor\_visits = one per visit\_id. new\_leads = dated at lead creation. conversions = dated at conversion. collections = amount recorded, dated at recorded\_at, reversed on bounce. | Table `metric_definitions` | Business, Finance |
| D3 | Team, territory, branch targets | A shared goal fed by every member. It is not the sum of the members' individual targets. | Fixed in code | Product, sales managers |
| D4 | Working days | Monday to Saturday, minus holidays and the rep's approved leave. | Table `holidays`; port `LeaveProvider` | HR, Leave module team |
| D7 | Source tables and columns | Not confirmed. Code against the ports in `ports.py`. | Port implementations | Each module owner |
| D8 | Timezone and currency | Asia/Kolkata and INR. | `BUSINESS_TZ`, `CURRENCY` | Product |
| D11 | Grace window for late offline events | 3 days after end\_date. | `late_event_grace_days` | Business |

**Rules the engineering team already agreed** (not open for debate):

- Progress is a ledger. Every other number is derived from it. Ledger rows are only ever added.
- One event creates one entry per applicable target, and a unique key stops double counting.
- A reversal is a new negative entry on exactly the targets that were credited.
- Past contributions stay with the team and territory the rep belonged to at the event time. A transfer moves only future activity.
- Targets can be changed after progress starts, but every change is versioned with a reason.

**Clarifications this plan adds** to the spec, so the builder does not have to guess:

- `branch` is added to the assignment entity types, because the read path in the spec resolves branch targets.
- Customer and product targets are accepted by the schema but rejected at creation (422) while `enable_customer_product_targets` is false. Order events carry no product lines and visits carry no customer, so they cannot be computed yet (critic gap MT-11).
- Money is `Decimal` end to end and never `float`. Rounding to 2 places happens only at display.

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
    monthly_target/
      router.py        # HTTP only
      schemas.py       # Pydantic request and response models
      models.py        # SQLAlchemy tables (must match the SQL scripts)
      crud.py          # queries only
      service.py       # create, change, cancel, read use cases
      run_rate.py      # pure math: gap, days left, run rate, state
      calendar.py      # working-day calculation
      ledger.py        # insert contribution and reversal entries
      membership.py    # team and territory as of a timestamp
      backfill.py      # replay source records into the ledger
      handlers.py      # event handlers
      outbox.py        # outbox writer and sweeper
      jobs.py          # closing job and nightly reconciliation
      ports.py         # interfaces to visits, orders, leads, leave, org
      sql/
        01_tables.sql            # all tables, constraints, seeds
        01_tables.rollback.sql
        02_archive.sql           # archive schema and tables (T-25)
        02_archive.rollback.sql
      tests/
src/                       # the existing React app
  features/
    monthly_target/
      pages/           # my targets, targets list, target detail, create form
      components/      # pieces used only by this feature
      api/             # calls and hooks for this feature's endpoints
      tests/
```

**Conventions**

- **Database isolation:** create every table in a separate schema, `fsm_app`, that the Supabase API does not expose. Revoke all grants on it from `anon` and `authenticated`. Enable row-level security on every table with no public policy as a second guard. The app connects with its own role, `fsm_app_user` (critic gap P-1).
- **Connections:** if the app uses the transaction pooler (port 6543), create the asyncpg engine with `statement_cache_size=0`. No migration connection is needed, because scripts run in the Supabase SQL editor.
- **Database scripts (no Alembic):** every database change is a plain SQL file, numbered in run order, in the feature's `sql/` folder, each with a matching `.rollback.sql`. Shared items (schema `fsm_app`, role, grants, row-level security, `holidays`) are in the root `sql/00_foundation.sql`, run once before any feature script. Each script can be run twice without error, holds its own seed data and ends with a check query that shows it worked. The product owner runs them by hand in the Supabase SQL editor, in number order, after a backup and first on a test project. An executed script is never edited; a later change is a new numbered script. SQLAlchemy models only read and write rows and must match the scripts; application code never creates or alters tables. The role password and database URLs live in `.env`, never in a script.
- **Types:** UUID primary keys, `timestamptz` stored in UTC, `numeric(15,2)` for money, `Decimal` in Python.
- **Dates:** convert an event's `completed_at` to `BUSINESS_TZ` before taking its date. Never use the server's local date.
- **Lists:** every list endpoint paginates, with a default page size of 25 and a cap of 100.
- **Retries:** a POST that creates something accepts an `Idempotency-Key` header and stores it with the record.
- **Single worker for jobs:** run the sweeper, closing job and reconciliation in one dedicated worker process or an external cron, never in every API worker.

## 4. Data model

Create all tables in schema `fsm_app` with one SQL script per phase (the shared `holidays` table is in the foundation script), each with a rollback script tested on a test project. Enumerations: `metric_type` = revenue, doctor\_visits, new\_leads, conversions, collections. `entity_type` = representative, team, territory, branch, customer, product. `target_status` = active, backfilling, closed, cancelled. A backfilling target is hidden from reads until its backfill finishes and it turns active. `entry_type` = contribution, reversal.

**targets**

| Column | Type | Rules |
| --- | --- | --- |
| id | UUID | PK, generated |
| title | varchar(255) | Not null, 3 to 255 characters |
| metric\_type | enum | Not null |
| target\_value | numeric(15,2) | Not null, at least 0. Whole number when the metric is a count |
| start\_date, end\_date | date | Not null, end\_date strictly after start\_date |
| status | enum | Default active |
| version | integer | Default 1, increases on every change |
| final\_value | numeric(15,2) | Null until the closing job freezes the result |
| closed\_at, adjusted\_at | timestamptz | Null. adjusted\_at is set when an entry posts after the target closed |
| cancel\_reason | varchar(500) | Null |
| idempotency\_key | varchar(100) | Null. Unique on (created\_by, idempotency\_key) where not null |
| created\_by | UUID | Not null, the manager |
| created\_at, updated\_at | timestamptz | Not null, default now |

Indexes: (start\_date, end\_date), (metric\_type), (status).

**target\_assignments**

| Column | Type | Rules |
| --- | --- | --- |
| id | UUID | PK |
| target\_id | UUID | FK to targets, **on delete restrict** (history is never deleted) |
| entity\_type, entity\_id | enum, UUID | Not null. Validate that the id exists when assigning |
| assigned\_at | timestamptz | Default now |
| ended\_at | timestamptz | Null while the assignee is active. Re-adding an ended assignee clears it and writes a target\_changes row |

Unique (target\_id, entity\_type, entity\_id). Index (entity\_type, entity\_id).

**target\_progress** (one row per assignment, created at 0 with the assignment)

| Column | Type | Rules |
| --- | --- | --- |
| id | UUID | PK |
| assignment\_id | UUID | FK to target\_assignments, unique |
| current\_value | numeric(15,2) | Default 0. The maintained sum of non-excluded entries. Changed only by the ledger code |
| last\_updated\_at | timestamptz | Default now |

**target\_progress\_entries** (the ledger; rows are never updated except `excluded`, and never deleted)

| Column | Type | Rules |
| --- | --- | --- |
| id | UUID | PK |
| assignment\_id | UUID | FK to target\_assignments |
| source\_event\_id | UUID | The original visit, order, lead or payment event. A reversal carries the id of the event it reverses |
| source\_event\_type | varchar(50) | For example visit\_completed |
| entry\_type | enum | contribution or reversal |
| delta | numeric(15,2) | Contribution greater than 0, reversal less than 0 |
| contributor\_id | UUID | The rep who did the action. Used for a rep's own share of a team target |
| occurred\_at | timestamptz | The event's own time (completed\_at), not the arrival time |
| business\_date | date | occurred\_at converted to BUSINESS\_TZ |
| excluded | boolean | Default false. True when a date change moves the entry outside the period |
| excluded\_reason | varchar(100) | Null |
| created\_at | timestamptz | Default now |

Unique (assignment\_id, source\_event\_id, entry\_type). Indexes: (assignment\_id, business\_date), (source\_event\_id).

**target\_changes** (audit of every change)

| Column | Type | Rules |
| --- | --- | --- |
| id | UUID | PK |
| target\_id | UUID | FK to targets |
| version | integer | The version created by this change |
| field | varchar(50) | For example target\_value, end\_date, assignment\_added |
| old\_value, new\_value | text | Null when not applicable |
| reason | varchar(500) | Not null |
| changed\_by | UUID | Not null |
| changed\_at | timestamptz | Default now |

**org\_membership\_history** (who belonged where, and when)

| Column | Type | Rules |
| --- | --- | --- |
| id | UUID | PK |
| employee\_id, team\_id, territory\_id, branch\_id | UUID | Not null |
| effective\_from | timestamptz | Not null |
| effective\_to | timestamptz | Null for the current row |

An exclusion constraint (`btree_gist`) forbids overlapping periods for one employee. Seed one row per employee from the current org data with effective\_from at the earliest event the system holds. Keep it current through the `MembershipProvider` port: a transfer closes the old row and opens a new one.

**event\_outbox**

| Column | Type | Rules |
| --- | --- | --- |
| id | UUID | PK. Becomes the event\_id |
| event\_type | varchar(50) | Not null |
| event\_version | integer | Not null |
| payload | JSONB | Not null |
| created\_at, processed\_at | timestamptz | processed\_at is null until handled |
| attempts | integer | Default 0 |
| last\_error | text | Null |

Partial index on (created\_at) where processed\_at is null.

**processed\_events**: event\_id (UUID PK), event\_type (varchar(50)), processed\_at (timestamptz default now).

**failed\_events**: id (UUID PK), event\_type, event\_version, payload (JSONB), reason (varchar(500)), created\_at, resolved\_at (null). Holds unknown versions, invalid payloads and events that exhausted retries.

**metric\_definitions**: metric\_type (enum PK), source\_event\_type, counts\_what (text), date\_field (varchar), dedupe\_rule (text), is\_integer (boolean), is\_active (boolean). Seed with the defaults in section 2.

**holidays** (created once in `sql/00_foundation.sql`, shared with Revenue Leakage): holiday\_date (date PK), name (varchar(100)), region (varchar(50), null).

**reconciliation\_runs**: id, started\_at, finished\_at, status (running, succeeded, failed), targets\_checked, drifts\_found. **reconciliation\_drifts**: id, run\_id (FK), assignment\_id, stored\_value, recomputed\_value, source\_value (null), kind (ledger\_vs\_stored, ledger\_vs\_source), created\_at.

### 4.1 Archive and retention (critic gap P-16)

Keep the live tables small so the target screens and the nightly reconciliation stay fast. Only the ledger grows without limit, so it is the only business data that moves. Create schema `fsm_archive` with the same isolation as `fsm_app`: no grants to `anon` or `authenticated`, row-level security on. Add `archived_at` (timestamptz, null) to `targets`. Add `fsm_app.archived_totals`: assignment\_id (PK), entry\_count, entry\_sum (numeric 15,2, non-excluded entries only), archived\_at.

| Data | Stays live | Then |
| --- | --- | --- |
| target\_progress\_entries | Until its target has been closed or cancelled for `archive_after_months` (default 24) | Moved to `fsm_archive.target_progress_entries` with an `archived_totals` row; the target gets `archived_at` |
| targets, target\_assignments, target\_progress, target\_changes, org\_membership\_history | Always | Never moved. They are small and needed for history |
| processed\_events | 90 days | Deleted. Safe, because the ledger's unique key still blocks double counting |
| event\_outbox (processed rows) | 30 days | Deleted |
| failed\_events | 180 days after `resolved_at`; unresolved rows are kept | Deleted |
| reconciliation\_runs and reconciliation\_drifts | 12 months | Deleted |
| fsm\_archive tables | 7 years (placeholder, decision D12) | Deleted by a yearly job after written sign-off |

**Archive job** (monthly, in the single job worker, one target per transaction):

1. Select targets with status closed or cancelled, `closed_at` older than `archive_after_months`, and `archived_at` null.
2. Write an `archived_totals` row per assignment with the count and sum of its non-excluded entries.
3. Copy the entries to the archive table, check that the copied count equals the live count, then delete the live rows and set `archived_at`. If any check fails, roll back that target.

**Rules that keep the numbers right**

- Reconciliation level 1 for an archived assignment compares `current_value` with `archived_totals.entry_sum` plus the sum of its live non-excluded entries. It skips level 2 for archived targets.
- A late event or reversal for an archived target still posts as a live entry, so the totals stay correct. The target stays archived.
- A change to an archived target returns 409 `target_archived`. Only a Senior Manager or above can restore it, through an admin job that moves the rows back.
- Partitioning the ledger by month is not needed in the first release. Reconsider when the live ledger passes about 50 million rows. If partitioning is added, the unique key must include the partition column.

Decision D12: the retention periods above are defaults. The business, Finance and legal must sign them off. The jobs read them from configuration.

## 5. Business rules and algorithms

### 5.1 Handling one event

The handler runs once per outbox row. Steps 2 to 6 run in **one database transaction**.

1. Validate the event against its versioned model. An unknown version or invalid payload goes to `failed_events` and the outbox row is marked processed.
2. Insert the event id into `processed_events`. If it already exists, stop: the event was handled.
3. Resolve who the event counts for. Find the rep's team, territory and branch **as of the event's `completed_at`** from `org_membership_history`, not as of today.
4. Find every assignment that matches all of these: status of its target is active, metric matches, `business_date` is inside the target's dates (or inside the grace window, see 5.4), assignment has no `ended_at` before the event, and the assignment's entity is the rep, or the rep's team, territory or branch at that time.
5. For each match, insert one ledger entry with `ON CONFLICT (assignment_id, source_event_id, entry_type) DO NOTHING`. Only when a row was inserted, run `UPDATE target_progress SET current_value = current_value + :delta, last_updated_at = now() WHERE assignment_id = :id` in the same statement batch. This is atomic, so simultaneous events never lose a count.
6. Mark the outbox row processed.

One visit therefore counts once toward the rep's target, once toward the team's, once toward the territory's and once toward the branch's. Those are different goals, so this is not double counting.

### 5.2 Delta per metric

| Metric | Source event | Delta |
| --- | --- | --- |
| doctor\_visits | VisitCompletedEvent, or VisitApprovedEvent in approval mode | 1, only when `is_valid_geofence` is true |
| new\_leads | LeadCreatedEvent | 1 |
| conversions | LeadConvertedEvent | 1 |
| revenue | OrderClosedEvent | order\_value, net of returns |
| collections | CollectionRecordedEvent | amount |

Count metrics must be whole numbers; reject a fractional target\_value for them. Customer and product targets stay disabled until the flag in section 2 is on.

### 5.3 Reversals

A reversal event (VisitRejectedEvent, VisitCancelledEvent, OrderCancelledEvent, LeadConversionRevertedEvent, CollectionBouncedEvent) carries the id of the original event. The handler:

1. Finds the original contribution entries with `source_event_id` equal to that id. It does **not** re-resolve membership, so it hits exactly the targets that were credited, even if the rep has since moved.
2. For each, inserts a reversal entry with delta equal to minus the original delta, using the same unique key with `entry_type = reversal`. A repeated cancellation does nothing.
3. Adds the negative delta to `current_value`.
4. If the original has no entries yet (the reversal arrived first), leave the outbox row unprocessed so the sweeper retries it. After 24 hours move it to `failed_events`.

Displayed progress is `max(0, current_value)`. The stored value may dip below zero briefly and is never clamped in storage.

### 5.4 Late and offline events

Match on the event's own time, never arrival time. A target stays `active` until the closing job runs, which is `end_date + late_event_grace_days` (default 3) in business time. Entries that arrive inside that window post normally. Entries that arrive after the target is `closed` still post, update `current_value`, and set `adjusted_at` on the target so every screen can show 'adjusted'. The closed `final_value` is not rewritten.

### 5.5 Gap, days left, run rate and state

All of this is computed on read in `run_rate.py`, as pure functions that take today's date as an argument.

- `gap = max(0, target_value - max(0, current_value))`
- `days_left` = working days from `max(today, start_date)` through `end_date`, inclusive. Working days are Monday to Saturday, minus rows in `holidays` and the rep's approved leave through `LeaveProvider`. For a team, territory or branch target use the base calendar without leave.
- `required_daily_run_rate = round(gap / days_left, 2)` with `ROUND_HALF_UP`. When `days_left` is 0 and `gap` is above 0, return null and the message 'no working days left'. Never divide by zero.
- `percent_complete = current_value / target_value * 100`, not capped, so 120 is valid. When `target_value` is 0 return null.
- `state`: `upcoming` when today is before start\_date; `achieved` when current\_value is at least target\_value; `active` when today is inside the dates; `ended_short` when today is after end\_date and the target was not met.

### 5.6 Creating a target

1. Validate fields (section 6). Reject customer and product assignments while the flag is off.
2. Check that every assignee is inside the caller's hierarchy scope and exists. Return 403 or 422.
3. Take an advisory transaction lock on `(entity_id, metric_type)` for each representative assignee, then reject with 409 if that rep already has an active individual target for the same metric with overlapping dates (critic gap MT-8).
4. If `Idempotency-Key` matches an existing target by this creator, return that target and do not create another.
5. Insert the target, assignments and zero-value progress rows.
6. If `start_date` is before today, **backfill**: replay qualifying source records dated from `start_date` through the same ledger code as live events, by reading through the `SourceRecordsProvider` port. Progress must start correct, not at zero (critic gap MT-1). Run the backfill in the same transaction for up to 5,000 records, otherwise as a background job that marks the target `backfilling` until done.

### 5.7 Changing a target

Every change needs a `reason` and the `version` the manager saw. A mismatch returns 409. Every change writes a `target_changes` row and raises `version` by 1.

| Field | Rule |
| --- | --- |
| target\_value | Allowed. Progress is untouched; gap and run rate recalculate on the next read. |
| end\_date | Allowed, but not before today. Entries dated after a shortened end are marked `excluded`, not deleted. Restoring the date un-excludes them. |
| start\_date | Moving earlier backfills through the same entry code. Moving later marks earlier entries `excluded`. |
| metric\_type | Not allowed. Cancel and create a new target. |
| assignments | A new assignee counts from today by default, with an option to backfill from the start date. A removed assignee gets `ended_at`; their entries stay. |

After any change that excludes or restores entries, recompute `current_value` for the affected assignments as the sum of non-excluded entries, in the same transaction. Who may change: the creator, or anyone above them in the hierarchy within scope. After a target has ended, only a Senior Manager or above. Cancelling sets status to `cancelled`, keeps all progress and removes the target from the rep's view. Nothing is ever hard-deleted.

### 5.8 Transfers

When `MembershipProvider` reports a transfer, close the old `org_membership_history` row and open a new one. Do not touch the ledger. Earlier entries stay with the old team and territory. The rep's individual target follows the rep. The old group's target keeps what it earned and is flagged for its manager (a row in `target_changes` with field `contributor_left`).

### 5.9 Closing and reconciliation jobs

- **Closing job (daily, 02:00 business time):** for every active target whose `end_date + grace` is before today, set `status = closed`, `closed_at`, and `final_value` per assignment.
- **Nightly reconciliation (03:00):** Level 1: recompute each active assignment's sum of non-excluded entries and compare with `current_value`; on mismatch, write `reconciliation_drifts` and fix `current_value`. Level 2: through `SourceRecordsProvider` recompute from source records; on mismatch, write a drift with kind `ledger_vs_source` and alert engineering. Do not auto-fix level 2. Weekly, also check that every assignment's entity id still exists and list any orphans (critic gap MT-16).

## 6. API contracts

Validate at the boundary with Pydantic. Enforce role and hierarchy scope on the server for every route. Never trust a filter from the client.

### 6.1 Endpoints

| Method and path | Purpose | Allowed roles |
| --- | --- | --- |
| POST /targets | Create a target with assignments. Accepts `Idempotency-Key` | RSM, Branch Manager, Senior Manager, Executive Director, inside their scope |
| GET /targets | List targets in the caller's scope. Filters: period, metric\_type, assignee, status. Paginated | RSM and above |
| GET /targets/{target\_id} | One target with assignments, progress and change history | RSM and above, inside scope |
| PATCH /targets/{target\_id} | Change a target (rules in section 5.7). Body carries `version` and `reason` | Creator, or anyone above in scope |
| POST /targets/{target\_id}/cancel | Cancel, keeping all progress. Body carries `version` and `reason` | Creator, or anyone above in scope |
| GET /targets/my-progress | Every active target that applies to the signed-in user | Any signed-in user, own data |
| GET /targets/ai-metrics/{user\_id} | Frozen payload for the AI Daily Sales Plan | Internal service, and managers within scope |

**Role scope for target routes:** Executive Director sees all. Senior Manager sees the hospital network. Branch Manager sees the branch. Team Lead or RSM sees the direct team. Field Officer sees own data only and cannot create or change targets.

### 6.2 Create target (POST /targets)

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| title | string | Yes | 3 to 255 characters |
| metric\_type | enum | Yes | revenue, doctor\_visits, new\_leads, conversions, collections |
| target\_value | number | Yes | At least 0. Whole number for count metrics |
| start\_date | date | Yes | May be in the past (triggers backfill) |
| end\_date | date | Yes | Strictly after start\_date |
| assignments | list | Yes | At least 1 item, at most 500 |
| assignments\[\].entity\_type | enum | Yes | representative, team, territory, branch. customer and product return 422 while the flag is off |
| assignments\[\].entity\_id | UUID | Yes | Must exist and be inside the caller's scope |

Response 201: `id, title, metric_type, target_value, start_date, end_date, status, version, created_by, created_at`, and `assignments[]` with `id, entity_type, entity_id, progress.current_value, progress.last_updated_at`.

### 6.3 Change and cancel

PATCH body: `version` (integer, required), `reason` (string, 5 to 500, required), and any of `target_value`, `start_date`, `end_date`, `add_assignments[]` (each with `backfill` boolean), `remove_assignment_ids[]`. Sending `metric_type` returns 422. Response 200 returns the target with its new `version`. Cancel body: `version`, `reason`.

### 6.4 My progress and the AI payload (frozen)

One object per active target that applies to the user, which includes the user's individual targets and every active team, territory and branch target the user belongs to today (critic gap MT-2). `payload_version` is 1. Add fields only by bumping the version.

| Field | Type | Meaning |
| --- | --- | --- |
| payload\_version | integer | 1 |
| target\_id | UUID | The target |
| title | string | Target title |
| scope | enum | representative, team, territory or branch |
| entity\_id | UUID | The assignee this object describes |
| metric\_type | enum | What is tracked |
| target\_value | number | Total goal |
| current\_value | number | Achieved so far, never below 0 |
| own\_contribution | number | The user's own share. For an individual target it equals current\_value |
| gap\_remaining | number | `max(0, target_value - current_value)` |
| days\_left | integer | Working days left, inclusive |
| required\_daily\_run\_rate | number or null | Null when no working days are left |
| percent\_complete | number or null | Not capped. Null when target\_value is 0 |
| state | enum | upcoming, active, achieved, ended\_short |
| adjusted | boolean | True when entries posted after the target closed |
| start\_date, end\_date | date | Period |

`GET /targets/my-progress` returns this array with pagination. `GET /targets/ai-metrics/{user_id}` returns the same objects without pagination.

### 6.5 Errors

Every error returns `{ "error": { "code": string, "message": string, "details": object or null } }`.

| Status | Code | When |
| --- | --- | --- |
| 401 | unauthenticated | Missing or invalid sign-in |
| 403 | outside\_scope | The assignee or target is outside the caller's hierarchy |
| 404 | not\_found | Unknown id, or a target outside scope (do not reveal existence) |
| 409 | overlapping\_target | Same rep, same metric, overlapping dates |
| 409 | version\_conflict | `version` does not match. Return the current version |
| 422 | validation\_error | Field rules in 6.2 and 6.3 |
| 422 | not\_supported | Customer or product targets while the flag is off |

## 7. Events, outbox and reliability

### 7.1 Event contracts

Define every event as a versioned Pydantic model in `shared_contracts/events.py`. Every event carries `event_id` (UUID), `event_version` (integer, starting at 1) and `occurred_at`. The visit, lead, order and payment teams must publish through one helper, `publish_event(session, event)`, which writes to `event_outbox` inside their own transaction.

| Event | Fields besides the common three | Effect |
| --- | --- | --- |
| VisitCompletedEvent | visit\_id, representative\_id, doctor\_id, completed\_at, is\_valid\_geofence | doctor\_visits +1 (submission mode) |
| VisitApprovedEvent | visit\_id, representative\_id, approved\_at | doctor\_visits +1 (approval mode) |
| LeadCreatedEvent | lead\_id, representative\_id, created\_at | new\_leads +1 |
| LeadConvertedEvent | lead\_id, representative\_id, converted\_at | conversions +1 |
| OrderClosedEvent | order\_id, representative\_id, customer\_id, order\_value, closed\_at | revenue + order\_value |
| CollectionRecordedEvent | payment\_id, representative\_id, customer\_id, amount, recorded\_at | collections + amount |
| VisitRejectedEvent, VisitCancelledEvent | original\_event\_id, visit\_id, reason | Reverses the visit |
| OrderCancelledEvent | original\_event\_id, order\_id, reason | Reverses the revenue |
| LeadConversionRevertedEvent | original\_event\_id, lead\_id, reason | Reverses the conversion |
| CollectionBouncedEvent | original\_event\_id, payment\_id, reason | Reverses the collection |

The lead-created, lead-converted, collection-recorded and all reversal events are new and must be agreed with the owning teams (decision D7). Until then, build the handlers and test them with the fake publisher.

### 7.2 Outbox flow

1. The producing module writes its record and the outbox row in one transaction.
2. After commit, an in-process task calls the handler for that row straight away.
3. The handler marks the row processed when section 5.1 completes.
4. The sweeper, in the single job worker, runs every minute, picks rows where `processed_at` is null and `created_at` is older than 30 seconds, uses `FOR UPDATE SKIP LOCKED` in batches of 100, and retries each one.
5. After 10 failed attempts (exponential backoff, capped at 15 minutes) move the row to `failed_events` with the last error and raise an alert to engineering.

The handler is idempotent twice over: `processed_events` stops a repeated delivery, and the ledger's unique key stops a repeated contribution.

### 7.3 Failure cases the handler must survive

| Case | Required behaviour |
| --- | --- |
| Same event delivered twice | The second delivery stops at `processed_events`. No second entry. |
| Crash between visit save and handler | The outbox row exists, so the sweeper handles it. |
| Handler crashes mid-transaction | Everything rolls back, including `processed_events`. The retry starts clean. |
| Reversal arrives before the original | Left in the outbox and retried. Moved to `failed_events` after 24 hours. |
| Unknown `event_version` or invalid payload | Written to `failed_events`, outbox row marked processed, engineering alerted. |
| No matching active target | Insert `processed_events` only. This is normal. |
| Event for a rep with no membership row | Count for the individual target only and log a warning. |

### 7.4 Observability

Expose these as metrics and alert the engineering team when they breach: outbox rows older than 5 minutes, `failed_events` count, nightly drifts found, closing and reconciliation job failures (critic gap P-8). Take a database backup before every SQL script is run and rehearse a restore once before go-live. The ledger can rebuild `current_value` at any time (critic gap P-12).

## 8. Build order

Nine phases. Finish each phase's acceptance checks before starting the next. Each task id (T-01 and so on) is referenced in section 9.

### Phase 0: Foundations

- **T-01** Write `sql/00_foundation.sql` and its rollback: schema `fsm_app`, role `fsm_app_user` (password set by hand, kept in `.env`), revoke grants from `anon` and `authenticated`, default row-level security with no policy on every table, and the shared `holidays` table. *Accept:* a query as `anon` against any table returns permission denied.
- **T-02** Set up settings read from `.env` (`BUSINESS_TZ`, flags, grace days, `visit_counting_mode`), the async engine (`statement_cache_size=0` when pooled), and the one error format. *Accept:* the app starts from `.env` alone and a health call reaches the database.
- **T-03** Build `scope.py` (hierarchy resolution) and the role dependencies. *Accept:* unit tests for each of the five roles, including an RSM trying to reach another team.
- **T-04** Define the versioned events and `publish_event` in `shared_contracts`. *Accept:* an unknown version is rejected by the model.

### Phase 1: Data model

- **T-05** `01_tables.sql` and `01_tables.rollback.sql` in the feature `sql/` folder for every table in section 4, with constraints, the unique keys, the exclusion constraint on membership, and seeds for `metric_definitions` and `org_membership_history` (holiday rows are seeded in the foundation script). *Accept:* inserting a duplicate ledger entry fails; overlapping membership rows fail; the rollback works and the script runs twice without error.

### Phase 2: Pure logic

- **T-06** `calendar.py`: working days from two dates with holidays and leave. *Accept:* tests for Sundays, a holiday, approved leave, same-day range, end before start.
- **T-07** `run_rate.py`: gap, days left, run rate, percent, state. *Accept:* every row of the numeric table in section 10 passes.
- **T-08** `timezone` helper: event time to business date. *Accept:* 2026-11-30 19:00 UTC maps to 2026-12-01.

### Phase 3: Create and read

- **T-09** `POST /targets` with validation, scope check, overlap lock, idempotency key and the customer/product flag. *Accept:* 409 on overlap; replaying the same key returns the same target.
- **T-10** Backfill through `SourceRecordsProvider` and the ledger code. *Accept:* a target created on the 10th with start date the 1st shows the first nine days of activity.
- **T-11** `GET /targets`, `GET /targets/{id}`, `GET /targets/my-progress`, `GET /targets/ai-metrics/{user_id}` returning team, territory and branch targets with scope and `own_contribution`. *Accept:* a rep in a team with a team target sees both; a manager sees only their scope; the AI payload matches section 6.4 exactly.

### Phase 4: Events

- **T-12** Outbox writer, in-process dispatch, handlers (section 5.1), ledger insert with `ON CONFLICT DO NOTHING`, atomic increment. *Accept:* one visit creates exactly one entry for each of rep, team, territory and branch targets; a replay creates none.
- **T-13** Reversal handler (section 5.3) including reversal-before-original retry. *Accept:* reversal after a transfer hits the original team; repeated reversal is a no-op.
- **T-14** Membership as of time, and transfer handling (section 5.8). *Accept:* visits before a transfer stay with the old territory; after, with the new.
- **T-15** Late-event rules and the grace window (section 5.4). *Accept:* an offline visit synced on day 2 after the end lands in the period; one synced after the grace window posts and sets `adjusted_at`.
- **T-16** Sweeper, retry with backoff, `failed_events`. *Accept:* killing the handler mid-event loses nothing after the sweeper runs.

### Phase 5: Changes and lifecycle

- **T-17** `PATCH /targets/{id}` and `POST .../cancel` with the rules in section 5.7, versioning and `target_changes`. *Accept:* two PATCHes with the same version return 200 then 409; a shortened end excludes entries and restoring it brings them back.
- **T-18** Closing job. *Accept:* targets freeze `final_value` after the grace window.

### Phase 6: Reliability and operations

- **T-19** Nightly reconciliation with both levels. *Accept:* a manually corrupted `current_value` is detected, logged and fixed.
- **T-20** Metrics and alerts (section 7.4). *Accept:* each metric appears on the dashboard and each breach pages engineering in a test.
- **T-21** Indexes review and a load test: 50 concurrent events on one assignment, and a list of 10,000 targets. *Accept:* the sum is exact and list p95 is under 500 ms.

### Phase 7: Hardening and handoff

- **T-22** Contract tests for each port against the real source tables once confirmed (decision D7). *Accept:* CI fails when a source column changes.
- **T-23** Backup before each SQL script is run and one rehearsed restore. *Accept:* a restored copy passes the reconciliation job with zero drifts.
- **T-24** Final review against section 11. *Accept:* every box in the definition of done is ticked.

* **T-25** `02_archive.sql` and rollback for the archive schema and tables, then the archive and cleanup jobs (section 4.1) with `archive_after_months` and the cleanup periods in configuration. *Accept:* archiving a closed target moves its entries and leaves `current_value` unchanged; reconciliation reports zero drift before and after; a late reversal on an archived target still posts; a change to it returns 409; restoring it returns the rows.

### Phase 8: Frontend

Starts once the Phase 3 endpoints exist and can run beside Phases 4 to 7. Follow section 12.

- **F-01** UI audit: list the existing components and patterns that will be reused, create `src/features/monthly_target/`, add routes and menu entries the way the app already does. *Accept:* the product owner approves the list.
- **F-02** API calls and hooks in the feature folder, using the app's existing data layer. *Accept:* every endpoint in section 6 is callable and every error maps as in section 12.
- **F-03** My targets screen and detail. *Accept:* a rep with an individual and a team target sees both with scope labels; all four states render; no sideways scroll at 360 px.
- **F-04** Create target form. *Accept:* a double tap creates one target; an assignee outside the manager's scope cannot be picked; server errors show beside the field.
- **F-05** Targets list, target detail, edit and cancel. *Accept:* when two managers edit the same target the second sees the conflict message and keeps the typed text; a Field Officer sees none of these screens or buttons.
- **F-06** Side-by-side review with two existing screens. *Accept:* the product owner signs off the look; the dependency list has no new UI package.

## 9. Edge cases and gap fixes checklist

Every gap raised by the engineering reviews and the critic review, with where this plan fixes it. Nothing here is optional unless marked.

### 9.1 Engineering review issues (21 October 2026)

| # | Issue | Fix | Section | Task |
| --- | --- | --- | --- | --- |
| 3 | One event feeds several targets | One entry per matching assignment, unique on (assignment, event, entry type), all in one transaction | 5.1 | T-12 |
| 4 | Corrections and reversals | A negative entry on exactly the credited assignments, never an edit | 5.3 | T-13 |
| 5 | Territory or team transfers | Membership history by timestamp; past stays, future moves | 5.8 | T-14 |
| 6 | Changing a target after progress begins | Allowed by field, versioned, with a reason and 409 on conflict | 5.7 | T-17 |

### 9.2 Critic gaps for Monthly Target

| ID | Severity | Fix | Section | Task |
| --- | --- | --- | --- | --- |
| MT-1 | Critical | Backfill from source records when a target starts in the past or its start date moves earlier | 5.6, 5.7 | T-10 |
| MT-2 | Critical | Read path returns team, territory and branch targets with scope and own contribution | 6.4 | T-11 |
| MT-3 | Critical | Append-only ledger, `current_value` is its maintained sum | 4, 5.1 | T-12 |
| MT-4 | Critical | Outbox in the producer's transaction, sweeper, nightly reconciliation | 7.2, 5.9 | T-16, T-19 |
| MT-5 | High | Business timezone for every date match and days-left count | 3, 5.1 | T-08 |
| MT-6 | High | Match on the event's own time, grace window, then `adjusted_at` | 5.4 | T-15 |
| MT-7 | High | Status, PATCH, cancel, `target_changes`, no hard delete, closing job | 5.7, 5.9 | T-17, T-18 |
| MT-8 | High | 409 on an overlapping individual target for the same metric | 5.6 | T-09 |
| MT-9 | High | List and detail endpoints scoped to the caller | 6.1 | T-11 |
| MT-10 | High | `metric_definitions` table seeded with agreed rules; whole numbers for counts | 4, 5.2 | T-05 |
| MT-11 | High | Customer and product targets disabled by flag until order lines and a doctor-to-customer mapping exist | 2, 5.2 | T-09 |
| MT-12 | High | Working days exclude Sundays, holidays and approved leave; no divide by zero | 5.5 | T-06, T-07 |
| MT-13 | High | Ledger and membership history keep past activity with the group at that time; leavers' targets are flagged | 5.8 | T-14 |
| MT-14 | Medium | Explicit `state`; uncapped percent; null when the target is 0 | 5.5 | T-07 |
| MT-15 | Medium | `Decimal` end to end, single currency, rounding at display only | 2, 3 | T-02 |
| MT-16 | Medium | Validate assignee ids at creation; soft-delete master records; weekly orphan check added to reconciliation | 5.6, 5.9 | T-09, T-19 |
| MT-17 | Medium | `Idempotency-Key` on POST /targets | 5.6 | T-09 |

### 9.3 Critic gaps that apply across the platform

| ID | Fix | Section | Task |
| --- | --- | --- | --- |
| P-1 | Separate schema, revoked grants, row-level security, own database role | 3 | T-01 |
| P-2 | `statement_cache_size=0` on the pooler; no migration tool, scripts run in the Supabase editor | 3 | T-02 |
| P-3 | Jobs run in one dedicated worker, never in every API worker | 3, 7.2 | T-16, T-18 |
| P-4 | Indexes on the ledger and source columns the backfill reads; batches | 4, 5.6 | T-21 |
| P-5 | Numbered SQL scripts with rollback scripts, run by hand in order | 3, 4, 8 | T-05 |
| P-6 | Versioned events; unknown versions go to `failed_events` | 7.1, 7.3 | T-04, T-16 |
| P-7 | `Idempotency-Key` on POST /targets | 5.6 | T-09 |
| P-8 | Metrics and engineering alerts | 7.4 | T-20 |
| P-9 | `timestamptz` in UTC, business date computed explicitly | 3, 4 | T-08 |
| P-11 | Every list paginated and capped; rate limit on the API gateway | 3, 6 | T-11 |
| P-12 | Ledger rebuilds `current_value`; backup before each SQL script; restore rehearsal | 7.4 | T-19, T-23 |
| P-13 | Test plan in section 10 | 10 | T-24 |
| P-14 | Port contracts and CI contract tests | 3, 8 | T-22 |
| P-15 | AI payload frozen at version 1 with scope, state and adjusted | 6.4 | T-11 |
| P-10 | Not applicable here: no client or doctor evidence is stored | none | none |

**P-16 (added 22 October 2026): data growth and archive.** The ledger and the technical tables grow forever. Fix: archive ledger entries of long-closed targets with stored totals, clean the technical tables on a schedule, and keep reconciliation correct across the archive. Section 4.1, task T-25.

### 9.4 Items that still need a business answer

Build the default and keep it configurable. D1 (which visits count), D2 (metric definitions), D3 (team targets as a shared goal), D4 (leave source), D7 (source tables and events), D11 (grace window). They are listed with their defaults in section 2.

## 10. Test plan

Write these tests first for the pure logic (T-06 to T-08) and alongside the code for the rest. Use `pytest` with a real PostgreSQL test database, never SQLite, because the unique keys, partial indexes and atomic increments are the point.

### 10.1 Numeric cases for gap, days left and run rate

| Case | target\_value | current\_value | Working days left | gap | run rate | percent | state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | 100 | 40 | 10 | 60 | 6.00 | 40 | active |
| Rounding | 100 | 0 | 3 | 100 | 33.33 | 0 | active |
| Achieved exactly | 100 | 100 | 5 | 0 | 0.00 | 100 | achieved |
| Over-achieved | 100 | 120 | 5 | 0 | 0.00 | 120 | achieved |
| No days left, gap open | 100 | 40 | 0 | 60 | null, 'no working days left' | 40 | ended\_short |
| Zero target | 0 | 0 | 5 | 0 | 0.00 | null | achieved |
| Not started | 100 | 0 | 12 | 100 | 8.33 | 0 | upcoming |
| Stored value dipped below zero | 100 | -5 | 10 | 100 | 10.00 | 0 | active (displayed value 0) |

### 10.2 Behaviour tests

| Area | Test | Expected |
| --- | --- | --- |
| Fan-out | One valid visit by a rep who has an individual, a team, a territory and a branch target for doctor\_visits | Four ledger entries, one per assignment; each current\_value rises by 1 |
| Replay | Deliver the same event id twice | Second delivery changes nothing; one entry per assignment |
| Replay after partial failure | Fail the handler after step 4, retry | Exactly one entry per assignment, no `processed_events` row until commit |
| Concurrency | 50 concurrent events on one assignment | `current_value` equals 50 times the delta exactly |
| Reversal | Original visit then VisitRejectedEvent | A reversal entry of -1 per credited assignment; value returns to the earlier number |
| Reversal replay | Same reversal twice | No second reversal entry |
| Reversal after transfer | Rep moves territory, then an older visit is cancelled | The reversal hits the old territory's target, not the new one |
| Reversal first | Reversal arrives before the original | Stays in outbox; after the original arrives, the next sweep posts both |
| Reversal after close | Reversal arrives after the target closed | Entry posts, `current_value` falls, `adjusted_at` is set, `final_value` is unchanged |
| Transfer | Visit on 5 November in territory A; rep moves to B on 10 November; visit on 12 November | First visit counts for A's target, second for B's; the rep's individual target counts both |
| Offline late | Visit completed on the last day, synced on day 2 of the grace window | Counted in the period |
| Offline too late | Synced after the grace window | Posts and sets `adjusted_at` |
| Timezone | Event at 2026-11-30 19:00 UTC | Business date 2026-12-01; counts for December |
| Backfill | Target created on the 10th with start date the 1st, nine days of qualifying visits exist | Progress starts at the nine days' total |
| Overlap | Second active individual target, same rep, same metric, overlapping dates | 409 `overlapping_target` |
| Idempotent create | Same `Idempotency-Key` twice | Same target id returned, one row |
| Version conflict | Two PATCH calls with the same `version` | 200 then 409 `version_conflict` |
| Shorten end date | End date moved earlier with entries after it | Those entries are `excluded`, `current_value` recomputed; restoring the date un-excludes them |
| Metric change | PATCH with `metric_type` | 422 |
| Cancel | Cancel a target with progress | Status `cancelled`, entries kept, not shown to the rep |
| Customer target | POST with a customer assignment while the flag is off | 422 `not_supported` |
| Visit mode | Switch `visit_counting_mode` to approval | Submitted visits stop counting; approved visits count |
| Scope | RSM assigns a rep from another team; Field Officer calls POST /targets | 403 `outside_scope`; 403 |
| Read path | Rep in a team with a team target | `my-progress` returns both, with `scope` and `own_contribution` |
| Reconciliation | Corrupt one `current_value` by hand | Drift row written, value fixed, run `succeeded` |
| Failed event | Unknown `event_version` | Row in `failed_events`; outbox row processed; alert raised |
| Isolation | Query a table as `anon` | Permission denied |
| SQL scripts | Run in order, run the rollbacks, run again, on a test Supabase project | Clean each time |

## 11. Definition of done

The feature is done when every box is ticked and the evidence is attached to the pull request.

**Correctness**

- [ ] Every number in section 10.1 passes as a unit test.
- [ ] Every behaviour test in section 10.2 passes against a real PostgreSQL database.
- [ ] One event creates exactly one ledger entry per matching target, and a replay creates none.
- [ ] Reversals hit exactly the credited targets, including after a transfer and after close.
- [ ] A target created in the past starts with the correct backfilled progress.
- [ ] Reps see individual, team, territory and branch targets with scope and own contribution.
- [ ] Changes are versioned, reasoned, audited and conflict-safe. Nothing is hard-deleted.

**Safety and reliability**

- [ ] No table in `fsm_app` is readable by `anon` or `authenticated`; row-level security is on.
- [ ] Producers write to the outbox in their own transaction. Killing the handler loses no progress.
- [ ] The nightly reconciliation reports zero drift on the test data and catches a hand-corrupted row.
- [ ] Money uses `Decimal` everywhere and no `float` appears in the feature's code.
- [ ] Every list is paginated and capped. Every create accepts an idempotency key.

**Frontend**

- [ ] Screens use only the existing components, theme and patterns, and add no UI dependency.
- [ ] Every screen has loading, empty, error and retry states, and works at 360 px width.
- [ ] Role visibility is correct and the product owner signed off the look against existing screens.

**Operations**

- [ ] SQL scripts run clean in order, roll back clean and can be re-run, and a restore from backup was rehearsed.
- [ ] Jobs run in one dedicated worker. Metrics and engineering alerts from section 7.4 are live.
- [ ] The AI payload in section 6.4 matches byte for byte and has `payload_version` 1.

* [ ] Archive and cleanup jobs run, reconciliation stays at zero drift across an archive, and the retention periods (D12) are signed off.

**Open items handed back to the business**

- [ ] D1, D2, D3, D4, D7 and D11 are confirmed or their defaults are signed off in writing.
- [ ] Producers for the new and reversal events (section 7.1) are agreed with the visit, lead, order and payment teams, and contract tests pass in CI.

## 12. Frontend and UI/UX

The screens go into the existing React PWA and must look and behave like the rest of the app, as if the same team built them.

**Match the existing UI (hard rule)**

- Before building, read the existing frontend and list what will be reused: layout shell and navigation, theme colours, fonts, spacing, icons, buttons, form fields, cards or tables, modals, toasts, loading, empty and error states, and how routes, sign-in and API calls are done. The list goes in the first pull request for sign-off.
- Reuse those parts as they are. No new UI library, colours, fonts or icon set, and no new way to call the API or guard routes. If a piece is missing, build it from existing parts in the same style and say so in the pull request.
- Mobile first: works at 360 px width with the app's own breakpoints, and behaves offline the way the rest of the app does.
- Role visibility follows the role table in the spec. A Field Officer never sees create, edit or cancel. The server enforces every rule; the screen only hides what the role cannot use.

**Screens**

| Screen | Who | What it shows |
| --- | --- | --- |
| My targets and detail | Everyone, own data | A card per target: title, metric, scope label (own, team, territory or branch), progress bar, current against target, gap, days left, required daily run rate, own contribution on shared targets, state badge, and an adjusted note when set |
| Targets list | RSM and above | Paginated list scoped to the caller, filters for period, metric and assignee, status and progress |
| Target detail | RSM and above | Progress per assignee, change history (who, when, old, new, reason), edit and cancel with a reason box |
| Create target | RSM and above | The fields in section 6.2; the assignee picker lists only people and groups in the caller's scope; customer and product are disabled with a short message until their data exists |

**Behaviour**

- Every screen has loading, empty, error and retry states in the app's style.
- Revenue and collections show in INR using the app's money format; counts are whole numbers; dates use the business timezone, never the device's.
- Show the state (upcoming, active, achieved, ended short). Over-achievement is shown uncapped. Percent complete is blank when the target is zero. When no working days remain, show 'no working days left' instead of a run rate.
- Create sends one idempotency key per opened form and disables the button while sending. Edit and cancel send the version that was loaded and a reason.
- Errors: 409 version conflict shows 'changed by someone else' with a reload button that keeps typed text; 409 overlap shows the server's message; 422 shows messages beside the fields; 403 and 404 use the app's standard screens.
