# MEDCY HRMS

## Lead Management + Follow-ups
### Functional & Technical Architecture Handoff

**Version:** 1.0 | **Date:** 16 October 2026  
**Audience:** Product owner, engineering lead, and AI coding agent  
**Scope:** Add-on 2 (Lead Management) and Add-on 9 (Follow-ups)

> **Main idea:** A **lead** is a possible business opportunity. A **follow-up** is an action someone must take. They work together, but neither one must be created before the other.

## 1. Read this first: what to build

Build **one Lead Management module** and **one Follow-ups module**, sharing customer, visit, employee, and branch information from Medcy HRMS. Both must work for the six existing user roles, with permission-based views. This document is a proposed implementation design; the agent must inspect the actual codebase before deciding final table names, services, and migrations.

**Business outcomes**

- A representative can record an opportunity and keep its full history.
- A representative always knows the next promised action and due date.
- A manager can see assigned opportunities, stalled leads, and overdue work within their team/branch/region.
- Other add-ons can read reliable lead and follow-up data for AI Daily Sales Plan, Analytics, Monthly Target, and later Revenue Leakage Detection.

**Three rules that must never be broken**

1. One customer can have **many separate leads** (different products or needs).
2. One lead can have **zero or many follow-ups**.
3. A follow-up can exist **without a lead** when it concerns an existing customer or a recorded visit. Do not force users to create a fake lead.

**What the source material establishes**

- The HRMS architecture covers hospital staff, medical representatives, doctor visit planning, proof of visits, ASHA outreach, multiple branches, and role-based navigation.
- The more detailed HRMS file defines six roles: Executive Director, Senior Operations Manager, Branch Manager, Team Lead, Field Executive, and In-Hospital Staff.
- The add-on brief defines lead fields/stages and types of follow-up actions. The database, API, rules, and new screens below are **recommended design decisions**, not claims about already-built features.

## 2. The business workflow in simple English

### Flow A: A visit creates a new lead

**Example:** Ravi, a Field Executive, visits Dr. Kumar's Clinic. The clinic asks for a proposal about diagnostic services.

1. **Visit:** Ravi opens an existing Visit Log or Doctor Plan entry.
2. **Create Lead:** He taps **Create Lead**. The app fills the known clinic, visit, location, employee, and branch details.
3. **Capture opportunity:** He adds the interest, expected value if known, and a short note. The lead starts at **New** unless an authorized user selects a more accurate stage.
4. **Plan next action:** Ravi taps **Add Follow-up**, chooses **Send quotation**, a due date/time, and an assignee (usually himself).
5. **Reminder:** The app shows it in **Due Today** and sends the configured reminder.
6. **Act and record result:** Ravi sends the quotation, marks the follow-up **Completed**, and records the outcome.
7. **Continue:** If the clinic asks for a meeting, Ravi creates another follow-up. The same lead continues; do not create a second lead.
8. **Close the lead:** When the business outcome is confirmed, Ravi marks it **Converted** with an outcome; if it will not happen, he marks it **Lost** with a reason.
9. **Management visibility:** Team Lead and authorized managers can see the lead's progress and pending/overdue actions without approving every step.

**Important:** Completing a follow-up does **not** automatically change the lead stage. Sending a quotation is not the same as converting a sale.

### Flow B: A follow-up exists without a lead

**Example:** Ravi already works with City Medical Centre and must collect an updated document next Tuesday. This is routine customer work, not a new sales opportunity.

1. Open the existing customer or Visit Log.
2. Tap **Add Follow-up**; choose **Document collection**, the due date, and the assignee.
3. The follow-up appears in Ravi's Follow-ups list and reminders.
4. Ravi completes the task and records the result. **No lead is required.**
5. If the interaction later creates a real opportunity, Ravi may create a new lead for the same customer and link future follow-ups to it. Existing follow-up history stays available.

### Flow C: A manager assigns a lead

A Branch Manager creates or receives a business opportunity, assigns it to Ravi, and the system notifies him. Ravi sees it under **My Leads**. His Team Lead sees it under **Team Leads**. The manager can reassign it within their allowed scope if Ravi is absent; ownership changes are logged. This is a visibility and assignment workflow, **not** a five-step approval chain.

## 3. How the existing six roles use the features

All roles use the **same underlying lead and follow-up records**. Only the screens, visible records, and allowed actions change.

| Role | Which records they see | What they normally do |
|---|---|---|
| **Executive Director** | Whole authorized organization | View pipeline and overdue work, inspect important leads, make exceptional reassignment/override decisions. |
| **Senior Operations Manager** | Assigned region and branches | Compare branches, monitor serious delays, reassign within their authorized regional scope. |
| **Branch Manager** | Assigned branch | Create/assign branch leads, monitor conversion and overdue follow-ups, help unblock work. |
| **Team Lead** | Assigned team | See team leads, assign within team, coach reps, handle overdue next actions. |
| **Field Executive** | Leads/follow-ups assigned to them, plus allowed items they created | Create leads, update own leads, add and complete follow-ups, record outcomes. |
| **In-Hospital Staff** | None by default | Lead Management and Follow-ups are hidden; add limited intake permissions only if separately approved. |

**Permission principles**

- A rep cannot freely see or edit another rep's opportunities.
- A Team Lead cannot view another team's records without explicit authorization.
- A Branch Manager cannot move a lead to an unauthorized branch.
- Company/tenant boundaries apply to **every query**, not only sidebar visibility.
- Managers can create records where authorized, but a rep's normal stage update does not require an approval from every level.

## 4. Where it fits into Medcy HRMS

**New navigation group (suggested): `Sales Pipeline`**

- **Lead Management** (`leads`) — list, search, create, assign, edit, stages, history.
- **Follow-ups** (`followups`) — today, upcoming, overdue, completed, create, reschedule, outcome.

**Entry points inside existing screens**

| Existing feature | New quick action / connection |
|---|---|
| **Doctor Plans** (`doctorPlanner`) | From a scheduled doctor visit, open linked leads and create a follow-up. |
| **Visit Log** (`callCapture`) | After recording the visit, choose **Create Lead** or **Add Follow-up** independently. |
| **ASHA Encounters** (`ashaEncounters`) | Add an authorized outreach action or opportunity; do not expose patient medical details in a sales lead. |
| **Employee/manager Dashboard** | Show **My Leads**, **Due Today**, and **Overdue** summaries within role scope. |
| **Directory/customer master** | Reuse existing records where suitable; do not duplicate doctors/clinics each time. |

Avoid adding six different modules or forcing the user through many pages. Use one shared screen with role-aware filters and actions.

## 5. Screens and forms to build

### 5.1 Lead List (`/sales/leads`)

**Rep view:** My Leads, Add Lead, search, filter by stage/type/priority, customer, next action, and recent activity.  
**Manager view:** Same list, plus an allowed scope switch (Team / Branch / Region), assigned employee, aging, and reassignment actions.

Show columns/cards: **Customer | Opportunity | Stage | Owner | Expected Value | Next Action/Due Date**. On mobile, prioritize customer, stage, next action, and a one-tap open action.

### 5.2 Add / Edit Lead form

| Field | Required? | Example / behavior |
|---|---|---|
| **Customer** | Yes | Select an existing Doctor / Clinic / Hospital / Pharmacy / Distributor, or create a new contact. |
| **Customer type** | Yes | Doctor, Clinic, Hospital, Pharmacy, Distributor, Other. |
| **Opportunity title / interest** | Yes | "Diagnostic service partnership" or "Patient monitor purchase". |
| **Lead type** | Yes | Hospital service, Medicine supply, Medical equipment, Partnership, Other (configurable). |
| **Location** | Yes | Clinic city/area; prefill if stored. |
| **Lead source** | Yes | Doctor Visit, ASHA Encounter, Referral, Inbound, Manual, Other. |
| **Assigned employee** | Yes | Prefill current rep; managers can assign another permitted rep. |
| **Stage** | Automatic | Default **New**; allow controlled editing later. |
| **Expected opportunity value** | Optional | INR 50,000 if known; not actual realized revenue. |
| **Contact number / person** | Optional | Reuse authorized customer contact details. |
| **Priority, notes, expected close date** | Optional | High / Medium / Low; short notes. |
| **Related visit / doctor plan** | Automatic if launched there | Link the existing record ID; avoid entering it again. |

**Automatically store:** unique ID, organization, branch, creator, created/updated timestamps, and audit history. After saving, offer **Add Follow-up** but do not require it.

### 5.3 Lead Details (`/sales/leads/:id`)

Top area: customer, opportunity, stage, assigned rep, expected value, and last interaction.  
Actions: **Update Stage | Add Follow-up | Record Note | Reassign** (only when allowed).  
Sections: **Overview, Follow-ups, Visit History, Activity Timeline**.

The timeline should include creation, assignment changes, stage changes, visit links, follow-up creation/completion/rescheduling, and closing outcomes.

### 5.4 Follow-ups List (`/sales/followups`)

Tabs/filters: **Due Today | Upcoming | Overdue | Completed | All**.  
Each item shows **Customer/Lead | What to do | When | Assigned To | Priority | Status**.

A rep sees their own actions; Team Lead and managers see authorized team/branch/region actions. The manager view supports overdue filtering and reassignment.

### 5.5 Add / Edit Follow-up form

| Field | Required? | Example / behavior |
|---|---|---|
| **Linked to** | Yes | A Lead **or** an existing Customer/Visit (no lead needed). |
| **Action type** | Yes | Call, Revisit, Quotation, Demo, Manager Meeting, Documents, Payment Reminder, Other. |
| **Action title** | Yes | "Send diagnostic service quotation". |
| **Due date & time** | Yes | 20 Oct 2026, 10:00 AM (show local time). |
| **Assigned employee** | Yes | Ravi by default; allow permitted reassignment. |
| **Priority / notes** | Optional | High; "Share requested pricing". |
| **Reminder** | Optional | Notify before due time and show in due/overdue lists. |
| **Completion result** | At completion | Short outcome note; optional next action. |

Follow-up buttons: **Mark Completed | Reschedule | Cancel | Add Another Follow-up**. Keep follow-up creation available inside Lead Details and after a visit.

## 6. Statuses and rules

### Lead stages

| Stage | Plain-English meaning | Recommended rule |
|---|---|---|
| **New** | Opportunity just recorded | Default at creation. |
| **Contacted** | Customer contacted | Record interaction/notes. |
| **Interested** | Customer expressed interest | Record what they want. |
| **Qualified** | Real opportunity with a plausible need and next step | Capture why it is qualified. |
| **Converted** | Confirmed business outcome | Require the conversion outcome/type and date; actual value when known. |
| **Lost** | Opportunity will not proceed | Require a loss reason. |

Do **not** assume every lead moves through every stage in strict order. Allow sensible stage updates and optional skips with history. **Converted** and **Lost** are closed states; reopening them requires a reason and permission. A follow-up completion never automatically converts a lead.

### Follow-up statuses

- **Pending:** Action is still open.
- **Completed:** Employee did the action and recorded its result.
- **Cancelled:** No longer needed, with a reason.
- **Overdue:** **Derived view**, not a separate saved state: Pending and due time has passed.

Rescheduling changes the due time and saves a history record. Reminders must not create duplicate follow-ups. **An overdue follow-up does not mean the lead is Lost.**

### Additional business rules

- Warn about an existing **similar open lead** for the same customer and interest; allow a legitimate different opportunity.
- A customer must be reusable across many leads; one lead must have one current owner.
- Follow-ups may link to a lead or to an existing customer/visit. No orphan follow-ups.
- Closing a lead should prompt the user to review any remaining Pending follow-ups; do not silently erase their history.
- Use soft archive/deactivation and audit records for important changes; avoid hard deletion in the normal UI.
- GPS/photo proof remains in the existing Visit Log. Creating a lead or follow-up should not require a new selfie or geolocation capture.
- Do not make customer communication or a quotation send happen automatically without the user's explicit action.

## 7. Suggested data architecture (adapt to existing code)

**Relationships:** **Organization → Branch → Customer / Lead / Follow-up** with role-scoped employee ownership. A **Customer has many Leads**; a **Lead has many Follow-ups**; a **Customer may also have Follow-ups directly**. Existing Doctor Plan, Visit Log, and ASHA records remain separate and are linked by their IDs.

| Entity | Important fields | Why it exists |
|---|---|---|
| **Customer / Contact** (reuse if available) | `id`, `organization_id`, name, type, phone, location | One reusable customer record, not copied per lead. |
| **Lead** | `id`, `organization_id`, `branch_id`, `customer_id`, `title`, `lead_type`, `source`, `stage`, `assigned_to`, `expected_value`, timestamps | Stores the business opportunity. |
| **FollowUp** | `id`, `organization_id`, `branch_id`, nullable `lead_id`, nullable `customer_id`/`visit_id`, `action_type`, `due_at`, `assigned_to`, `status`, `outcome`, timestamps | Stores the promised next action. |
| **LeadHistory** | `lead_id`, actor, event type, before/after, timestamp | Tracks stage/owner changes and decisions. |
| **FollowUpHistory** | `followup_id`, actor, event type, before/after, timestamp | Tracks completion, cancellation, and rescheduling. |
| **Interaction / Visit Link** (reuse if available) | customer ID, related Lead ID (optional), visit ID, summary, timestamp | Shows customer touchpoints without duplicating Visit Log evidence. |

**Database invariants**

- Every Lead and FollowUp has a valid `organization_id`, permitted `branch_id`, and employee owner.
- Every FollowUp references **at least one valid context**: lead, customer, or visit. When `lead_id` is present, derive/validate its customer and organization; reject mismatched links.
- `next_follow_up` on a lead should be **computed from its earliest Pending follow-up**, not manually stored in two places.
- Store due timestamps in UTC and display them using the user's local timezone.
- Store all important writes in transactions and append an audit record with the same action.
- Add indexes for organization, branch, assigned employee, stage/status, due date, and related lead/customer.

**Suggested information flow**

```text
Doctor Plans / Visit Log / Customer Directory
                    |
        +-----------+-----------+
        |                       |
  Lead Management           Follow-ups
  (opportunities)          (next actions)
        |                       |
        +---- linked when ------+
              applicable
        |                       |
        +------------+----------+
                     |
         AI Daily Sales Plan / Analytics
         / Monthly Target (read-only)
```

This is a relationship map, not a required sequence. **Expense Management** is a separate field workflow. **Revenue Leakage Detection** consumes historical information later.

## 8. Suggested backend/API contract

Use the existing application framework, authentication system, ID conventions, and database layer. Endpoint names below are examples; **do not add a second competing API layer** if services already exist.

| Operation | Suggested endpoint | Permission/check |
|---|---|---|
| List/create leads | `GET /leads`, `POST /leads` | Scope by org/branch/assignment; validate customer/source. |
| Read/update lead | `GET /leads/:id`, `PATCH /leads/:id` | Authorized lead only; record edits. |
| Change stage | `POST /leads/:id/stage` | Validate stage, close reason/outcome; append history. |
| Assign/reassign | `POST /leads/:id/assign` | Managers in scope; notify new owner; log transfer. |
| List/create follow-ups | `GET /followups`, `POST /followups` | Assigned/scope filters; valid linked context. |
| Complete/reschedule/cancel | `POST /followups/:id/complete`, `/reschedule`, `/cancel` | Only authorized owner/manager; record outcome/history. |
| Customer lookup | `GET /customers/search` | Reuse existing customer/doctor directory permissions. |
| Timeline | `GET /leads/:id/timeline` | Combined events/visits/follow-ups in authorized scope. |

**Events for other modules** (if the platform already has event/notification plumbing): `lead.created`, `lead.assigned`, `lead.stage_changed`, `lead.closed`, `followup.created`, `followup.rescheduled`, `followup.completed`, `followup.cancelled`.

A due-date job can calculate overdue items and send deduplicated reminders. A reminder is **not** a lead stage change. Use server-side checks even if the frontend hides unauthorized buttons.

## 9. Integration contracts with the team's other add-ons

| Other add-on | What it may read from these modules | Who owns the logic |
|---|---|---|
| **AI Daily Sales Plan (1)** | Open leads, stage, priority, last interaction, Pending follow-ups/due dates, owners | AI Plan team decides visit/action ranking; your modules supply accurate data. |
| **Analytics (6)** | Leads created/closed, stage history, conversion outcome/value, follow-up completion and overdue counts | Analytics team builds calculations and charts. |
| **Monthly Target (8)** | Qualified/converted lead counts, actual confirmed outcomes where available | Target team owns target setting and progress. |
| **Revenue Leakage (10)** | Stale leads, no next action, declining recent activity (later phase) | Leakage team owns risk rules; avoid promising predictions without sufficient data. |
| **Expense Management (5)** | May refer to a visit/field trip, not a Lead dependency | Expense team owns claims and reimbursement. |

**Do not build the AI scoring engine inside Lead Management now.** Expose clean, permission-safe data for the AI team. If a simple High/Medium/Low priority is needed, make it transparent and rule-based in the first release.

## 10. Security, healthcare boundaries, and quality

- Enforce access at API/database level: tenant isolation, employee assignment, team/branch/region scope. Hiding sidebar items is not security.
- Reuse HRMS authentication and the actual authorization model; inspect whether branch or regional assignments can change over time.
- Avoid putting patient diagnosis, treatment notes, or sensitive health information in general sales leads. Patient enquiry workflows need separate authorization, consent/privacy decisions, and appropriate access controls.
- Keep audit logs for assignment, stage changes, closures, cancellations, edits, and reschedules.
- Validate all forms, use safe handling for contact numbers/notes, and limit who can export information.
- Use retry-safe and deduplicated notifications, stable UTC timestamps, and branch-local display time.
- Never imply doctor visits, lead records, or follow-up completion alone prove product purchases or revenue.
- Follow applicable company rules and legal review for medicine promotion, clinician engagement, and referrals before automating communications or incentives.

## 11. Build order: what the coding agent should do

**Step 0 — Inspect existing HRMS first**

Locate the six roles, organization/branch model, employee IDs, Doctor Plans, Visit Log, ASHA data, customer/doctor directory, notification system, API stack, and authorization rules. Map the proposed fields to existing code. Do not create duplicate customer tables or hard-code new role names if equivalents exist.

**Step 1 — Define data and permissions**

Implement/reuse Customer references, Lead, FollowUp, stage/history, and owner/branch scoping. Add migrations/indexes and authorization tests.

**Step 2 — Build Lead Management MVP**

Lead List → Add/Edit Lead → Lead Details → Stage change → Assignment → History. Keep the form short and prefill from Visit Log where possible.

**Step 3 — Build Follow-ups MVP**

Follow-up List → Add from Lead or Customer/Visit → Due Today/Overdue → Complete/Reschedule/Cancel → Reminder and history.

**Step 4 — Join the workflows**

Add **Create Lead** and **Add Follow-up** from Visit Log. Add **Add Follow-up** from Lead Details. Compute next pending action on lead cards. Ensure standalone follow-ups continue to work.

**Step 5 — Expose data to other add-ons**

Provide documented read endpoints/events for AI Daily Sales Plan, Analytics, and Monthly Target. Do not make those modules required to use leads or follow-ups.

## 12. Definition of Done: acceptance checks

The feature is ready for a pilot when all checks below pass.

1. Ravi can create a lead from a visit and known details are prefilled.
2. Ravi can save a lead **without** adding a follow-up.
3. Ravi can create a follow-up for an existing customer **without** creating a lead.
4. One customer can have two legitimate opportunities without duplicating the customer profile.
5. One lead can have multiple Pending and Completed follow-ups and retain all history.
6. A pending action appears under **Due Today**; it becomes visibly **Overdue** after due time without changing its saved status to a separate status.
7. Completing a follow-up requires an outcome and never auto-converts the lead.
8. Converting a lead records an outcome; marking it Lost records a reason.
9. Reassignment moves responsibility and records who changed it; the new owner can see the item.
10. Field staff cannot read another staff member's unauthorized lead; cross-branch and cross-organization access is blocked on the server.
11. Manager screens show only their authorized scope; In-Hospital Staff cannot open either module by default.
12. Lead Detail shows an understandable timeline and next Pending follow-up, if one exists.
13. Closing a lead prompts review of outstanding follow-ups instead of silently deleting them.
14. Basic counts and due-action feeds can be consumed by AI Daily Sales Plan and Analytics without changing their own business logic.

## 13. Decisions to confirm before final schema approval

| Decision | Recommended starting choice |
|---|---|
| **What is a converted lead?** | Define per lead type (signed service agreement, confirmed purchase order, etc.); not merely a visit or quotation. |
| **Which customer master is canonical?** | Reuse existing Doctor/Clinic/Customer records when possible; avoid duplicate identities. |
| **Who may reassign or reopen closed leads?** | Team Lead within team, Branch Manager within branch, higher roles in scope; every exception audited. |
| **Which reminder channel?** | In-app first; push/email/WhatsApp only after access, consent, and notification infrastructure review. |
| **Do hospital reception staff capture leads?** | No access by default; consider a separate limited intake permission later. |
| **How are lead types configured?** | Start with a small list; keep types and outcome evidence configurable for different healthcare sales models. |
