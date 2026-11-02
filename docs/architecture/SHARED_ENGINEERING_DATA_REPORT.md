# Shared Engineering Data Report: FSM Core & Sbloom Collaboration
**Prepared for Leadership & Shared Engineering Alignment**

---

## 1. Master 4×4 Engineering Data Matrix

| Layer | 1. Providers *(FSM Scope)* | 2. Advisors *(Shared Scope)* | 3. Marketers / Field Reps *(FSM Scope)* | 4. Influencers *(Sbloom Scope)* |
| :--- | :--- | :--- | :--- | :--- |
| **Functionality**<br>*(What features they need)* | • Provider KYC & Facility Profile Onboarding<br>• Product/Service Catalog & Price Tier Inspection<br>• Direct B2B Inventory / Replenishment Ordering<br>• Marketer Appointment & Visit Window Booking<br>• Client/Patient Lead Intake & Voucher Validation<br>• Real-time Order Tracking & Invoicing Ledger | • Scientific & Medical Collateral Review<br>• Digital Advisory Board & Webinar Hosting<br>• Product Trial Assessment & Clinical Evaluation<br>• Field Rep Escalation Queue (Ask-an-Expert)<br>• Endorsement & Campaign Brief Sign-off<br>• Honorarium Ledger & Regulatory Disclosures | • GPS Geofenced Attendance & Day Punch-In/Out<br>• Automated Route Planning & Beat Schedules<br>• Doctor/Clinic Visit Execution & DCR Logging<br>• Digital Detail Aid & Sample Kit Distribution<br>• Provider Onboarding & Facility Profiling<br>• Camera-only Expense Claims with Receipt OCR | • Creator Campaign Marketplace & Brief Intake<br>• Auto-generated Trackable Links & Promo Codes<br>• Social Post Draft Submission & Review Status<br>• Real-time Engagement, Click & Lead Metrics<br>• Commission Accrual & Conversion Ledger<br>• Automated Bank/UPI Payout Wallet Settlement |
| **UI/UX**<br>*(What their interface looks like)* | • Web Portal & Tablet Responsive UI<br>• High-density tabular order & inventory ledger<br>• Prominent "Accept / Reschedule Visit" card<br>• Drag-and-drop document & license uploader<br>• Instant voucher verification search bar | • Desktop Web & Tablet Reader UI<br>• Side-by-side PDF / Creative preview with markup<br>• 1-click "Approve / Request Changes / Reject"<br>• Clean executive typography, minimal distractions<br>• Integrated HD video consultation viewport | • Mobile PWA (Offline-first, Android/iOS feel)<br>• Quick-action thumb navigation & floating action buttons<br>• Interactive route map with GPS waypoint polylines<br>• Low-connectivity sync alert indicator<br>• Instant camera capture with live edge-detection | • Mobile-First Creator App (Dark/Modern theme)<br>• Gamified performance widgets & milestone tiers<br>• Real-time conversion sparklines & income charts<br>• 1-tap link copying & native social share sheets<br>• Transparent payout ledger with downloadable slips |
| **Application Logic**<br>*(What logic supports them)* | • Provider Lifecycle FSM (`PENDING` &rarr; `VERIFIED` &rarr; `SUSPENDED`)<br>• Order Fulfillment & Minimum Order Value (MOV) engine<br>• Territory-based Marketer auto-assignment<br>• Voucher redemption single-use verification<br>• Automated GST invoice generation engine | • Multi-tier approval state machine<br>• Regulatory Compliance & Conflict-of-Interest (COI) audit<br>• Time-weighted Honorarium billing calculator<br>• Bi-directional Q&A message routing pipeline<br>• Cryptographic signature stamping on approvals | • Recursive CTE hierarchy RBAC (`ADMIN` &rarr; `ZSM` &rarr; `RSM` &rarr; `MR`)<br>• Dual Geofencing engine (PostGIS + Haversine fallback)<br>• Anti-fraud camera capture & EXIF delta verification<br>• Offline IndexedDB queue with idempotent background sync<br>• Visit completion validation rules (min dwell time, GPS match) | • Real-time URL redirect & attribution tracker<br>• Multi-tier affiliate commission computation engine<br>• Click-farm, bot & duplicate IP fraud filter<br>• Promo code lifecycle & expiration worker<br>• Automated payment gateway batch disbursement |
| **Data Schema**<br>*(What data they access or manage)* | **Access**: Provider profile, product catalog, assigned rep card, order history, credit limit.<br><br>**Manage**: Facility metadata, operating hours, staff directory, purchase orders, delivery sign-offs. | **Access**: Clinical trial summaries, marketing creative briefs, unapproved collaterals, provider queries.<br><br>**Manage**: Approval decisions, review annotations, advisory logs, timesheets, conflict declarations. | **Access**: Territory beats, assigned provider list, monthly targets, expense claim statuses, team org tree.<br><br>**Manage**: GPS coordinates, punch logs, DCR visit notes, sample disbursements, expense receipts. | **Access**: Active campaign guidelines, commission rates, gross clicks, attributed leads, net earnings.<br><br>**Manage**: Social profile URLs, tax/payout details, content draft uploads, custom promo tags. |

---

## 2. Granular Persona Data Profiles

### 2.1 Provider Data Profile (FSM Core Managed)
* **System Entity**: `ProviderFacility`
* **Primary Key**: `provider_id` (UUIDv4)
* **Key Attributes**:
  * `business_name`: String(200)
  * `facility_type`: Enum (`CLINIC`, `HOSPITAL`, `RETAIL_PHARMACY`, `AGRI_CENTER`)
  * `license_number`: String(100) — verified via automated KYC checks
  * `geo_point`: Point (`latitude`, `longitude`, `geofence_radius_meters`)
  * `assigned_marketer_id`: UUID (Foreign Key &rarr; `employees.id`)
  * `order_credit_limit`: Decimal(12, 2)
  * `status`: Enum (`ONBOARDING`, `PENDING_VERIFICATION`, `ACTIVE`, `INACTIVE`)
* **Core APIs**:
  * `POST /api/providers/onboard`
  * `GET /api/providers/{id}/orders`
  * `POST /api/providers/orders/place`
  * `POST /api/providers/vouchers/redeem`

---

### 2.2 Advisor Data Profile (Shared Scope)
* **System Entity**: `AdvisorProfile` & `AdvisoryReview`
* **Primary Key**: `advisor_id` (UUIDv4)
* **Key Attributes**:
  * `full_name`: String(150)
  * `specialization`: String(100) (e.g., Cardiology, Crop Science, Dermatology)
  * `credential_id`: String(100) (e.g., Medical Council Registration)
  * `honorarium_rate_per_hour`: Decimal(10, 2)
  * `coi_status`: Enum (`CLEARED`, `FLAGGED`, `PENDING_ANNUAL_UPDATE`)
  * `active_reviews_count`: Integer
* **Core APIs**:
  * `GET /api/advisors/queue/reviews`
  * `POST /api/advisors/reviews/{id}/decision` (`APPROVE`, `FLAG`, `REJECT`)
  * `POST /api/advisors/queries/{id}/reply`
  * `GET /api/advisors/honorarium/statement`

---

### 2.3 Marketer / Field Rep Data Profile (FSM Core Managed)
* **System Entity**: `Employee`, `FieldSession`, `FieldVisit`
* **Primary Key**: `employee_id` (UUIDv4)
* **Key Attributes**:
  * `role`: String(50) (`MR`, `RSM`, `ZSM`, `GM`, `ADMIN`)
  * `territory_code`: String(50) (e.g., `IN-MH-MUM-SOUTH`)
  * `reporting_to_id`: UUID (Self-referential hierarchy tree)
  * `current_session_id`: UUID (Foreign Key &rarr; `field_sessions.id`)
  * `daily_target_visits`: Integer (Default: 8 to 12 visits/day)
  * `monthly_achievement_percentage`: Decimal(5, 2)
* **Core APIs**:
  * `POST /api/attendance/clock-in` (GPS + selfie proof validation)
  * `POST /api/field-sessions/start`
  * `POST /api/field-visits/{id}/start` & `PATCH /api/field-visits/{id}/complete`
  * `POST /api/expenses/submit` (Anti-fraud OCR scan + receipt hashing)

---

### 2.4 Influencer Data Profile (Sbloom Managed)
* **System Entity**: `SbloomCreator`, `AffiliateCampaign`
* **Primary Key**: `influencer_id` (UUIDv4)
* **Key Attributes**:
  * `handle_name`: String(100) (Instagram, YouTube, LinkedIn)
  * `tier`: Enum (`NANO`, `MICRO`, `MACRO`, `CELEBRITY`)
  * `assigned_promo_code`: String(50) (e.g., `BLOOM-DRKAPOOR`)
  * `attribution_shortlink`: String(255)
  * `total_clicks`: BigInteger
  * `verified_provider_conversions`: Integer
  * `unpaid_commission_balance`: Decimal(12, 2)
* **Core APIs (Sbloom Endpoints)**:
  * `GET /api/sbloom/campaigns/active`
  * `POST /api/sbloom/creatives/submit-draft`
  * `GET /api/sbloom/analytics/realtime`
  * `POST /api/sbloom/wallet/request-payout`

---

## 3. Cross-System Event Payloads for Shared Engineering

### Payload 1: Digital Lead Generated &rarr; Dispatched to FSM Core
* **Emitter**: Sbloom Affiliate Engine
* **Receiver**: FSM Core Webhook / Kafka Consumer
* **Purpose**: Influencer creates local consumer demand; FSM assigns field rep to stock & detail the nearest provider.

```json
{
  "event_id": "evt_sb_7781920",
  "event_name": "INFLUENCER_LEAD_DISPATCHED",
  "timestamp": "2026-10-29T10:30:00Z",
  "version": "1.0",
  "payload": {
    "lead_id": "lead_994820",
    "campaign_id": "camp_cardio_q4_2026",
    "influencer_id": "inf_sbloom_5541",
    "influencer_handle": "@health_guru_neha",
    "promo_code": "NEHA-CARDIO",
    "customer": {
      "city": "Mumbai",
      "pincode": "400001",
      "preferred_service_category": "Cardiac Screening"
    },
    "routing": {
      "target_territory": "South Mumbai Zone",
      "suggested_provider_id": "prv_mum_0042",
      "urgency": "HIGH"
    }
  }
}
```

---

### Payload 2: Provider Conversion Verified &rarr; Emitted to Sbloom
* **Emitter**: FSM Core Backend
* **Receiver**: Sbloom Payout & Commission Engine
* **Purpose**: Provider logs physical voucher redemption or doctor prescription; Sbloom credits influencer wallet.

```json
{
  "event_id": "evt_fsm_4401892",
  "event_name": "PROVIDER_CONVERSION_SETTLED",
  "timestamp": "2026-10-29T15:20:00Z",
  "version": "1.0",
  "payload": {
    "conversion_id": "cnv_98231",
    "lead_id": "lead_994820",
    "promo_code": "NEHA-CARDIO",
    "influencer_id": "inf_sbloom_5541",
    "provider": {
      "provider_id": "prv_mum_0042",
      "provider_name": "Apex Heart & Diagnostic Clinic",
      "verified_by_marketer_id": "22222222-2222-2222-2222-222222222222"
    },
    "transaction": {
      "gross_order_value": 4500.00,
      "discount_applied": 450.00,
      "net_settled_value": 4050.00,
      "currency": "INR",
      "invoice_ref": "INV-2026-88019"
    }
  }
}
```

---

## 4. Key Meeting Summary Notes
1. **Ownership Clarity**:
   * **FSM Team**: Providers (clinics/stores) + Marketers (field reps) + Physical verification.
   * **Sbloom Team**: Influencers + Social campaigns + Digital lead generation + Affiliate payouts.
   * **Advisors (Shared)**: Scientific gatekeepers ensuring compliance across both digital posts and field detailing.
2. **Integration Mechanism**: Asynchronous REST Webhooks or Kafka topics with idempotent processing to ensure zero service failure coupling.
3. **Data Security**: FSM preserves strict privacy for field personnel (GPS breadcrumbs and HR hierarchy are never sent to Sbloom; only conversion confirmation events are transmitted).
