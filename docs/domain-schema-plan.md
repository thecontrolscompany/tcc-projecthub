# TCC Unified Platform — Domain Schema Plan

**Date:** 2026-03-30

---

## 1. Domain Overview

The platform is organized around eight business domains. Each domain owns its primary tables. Cross-domain references use foreign keys to shared entity IDs.

```
quote_requests
    ↓ (convert_to_estimate)
estimates
    ├── estimate_items (HVAC systems)
    ├── estimate_cost_settings
    └── (snapshot on award)
    ↓ (award_project)
projects
    ├── billing_periods
    ├── weekly_updates
    ├── change_orders (future)
    └── labor_actuals (future, QBO Time)
    ↓
invoices (future, QBO sync)
    ↓
closeout / lessons_learned (future)
```

---

## 2. Shared / Identity Domain

### `profiles` (extends Supabase auth.users)
```sql
id            UUID PK → auth.users(id)
full_name     TEXT
role          TEXT  -- enum: admin | estimator | pm | billing | accounting | executive | customer
email         TEXT UNIQUE
avatar_url    TEXT
theme_pref    TEXT  -- 'light' | 'dark' | 'system'
created_at    TIMESTAMPTZ
```

**Notes:**
- Role determines which modules are visible in the nav
- Multiple roles per user via a `profile_roles` join table (future: granular permissions)
- `theme_pref` persists per-user for light/dark toggle

### `customers` (companies)
```sql
id              UUID PK
name            TEXT NOT NULL
contact_email   TEXT
contact_name    TEXT
phone           TEXT
address         TEXT
city            TEXT
state           TEXT
notes           TEXT
sharepoint_folder TEXT  -- relative path within SharePoint Customers library
created_at      TIMESTAMPTZ
```

---

## 3. Quote Requests Domain

### `quote_requests`
```sql
id                  UUID PK
quote_number        TEXT UNIQUE    -- QR-2026-001 (auto-generated, sequential per year)
year                INT            -- 2026
sequence            INT            -- 001, 002, ...
customer_id         UUID → customers(id)
project_name        TEXT NOT NULL
project_location    TEXT
requested_by        TEXT           -- contact name at customer
requested_by_email  TEXT
bid_date            DATE
due_date            DATE
scope_description   TEXT
notes               TEXT
job_type            TEXT           -- 'ddcRetrofit' | 'planSpec' | 'designBuild' | 'service' | 'other'
new_construction    BOOLEAN
occupied_building   BOOLEAN
site_walk_required  BOOLEAN
gc_name             TEXT
engineer_name       TEXT
controls_vendor     TEXT
budget_range        TEXT
status              TEXT NOT NULL DEFAULT 'new'
                    -- new | under_review | waiting_on_info | assigned | estimating | submitted | won | lost | archived
assigned_estimator  UUID → profiles(id)
assigned_at         TIMESTAMPTZ
internal_notes      TEXT
opportunity_value   NUMERIC(12,2)  -- internal only, never shown to customer
target_margin_pct   NUMERIC(5,4)   -- internal only
sharepoint_folder   TEXT           -- /Quote Requests/QR-2026-001 - CustomerName - ProjectName
submitted_at        TIMESTAMPTZ    -- when customer submitted
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

### `quote_request_attachments`
```sql
id                  UUID PK
quote_request_id    UUID → quote_requests(id)
filename            TEXT
file_size           INT
content_type        TEXT
sharepoint_path     TEXT           -- full path in SharePoint
uploaded_by         UUID → profiles(id)  -- null = customer upload
upload_type         TEXT           -- 'customer_upload' | 'internal_review' | 'addendum'
created_at          TIMESTAMPTZ
```

### `quote_request_messages` (future)
```sql
id                  UUID PK
quote_request_id    UUID → quote_requests(id)
author_id           UUID → profiles(id)  -- null = customer
body                TEXT
is_internal         BOOLEAN DEFAULT false
created_at          TIMESTAMPTZ
```

### Numbering function
```sql
-- Auto-generate QR-YYYY-NNN on insert
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
DECLARE
  next_seq INT;
BEGIN
  SELECT COALESCE(MAX(sequence), 0) + 1
  INTO next_seq
  FROM quote_requests
  WHERE year = EXTRACT(YEAR FROM NOW());

  NEW.year := EXTRACT(YEAR FROM NOW());
  NEW.sequence := next_seq;
  NEW.quote_number := 'QR-' || NEW.year || '-' || LPAD(next_seq::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Estimating Domain

This domain incorporates the logic from hvac-estimator. The estimate record links back to the originating quote request, and when awarded, creates a locked project baseline.

### `estimates`
```sql
id                    UUID PK
estimate_number       TEXT UNIQUE    -- EST-2026-014
year                  INT
sequence              INT
quote_request_id      UUID → quote_requests(id) NULLABLE  -- null if not from quote request
customer_id           UUID → customers(id)
name                  TEXT NOT NULL
project_name          TEXT
project_location      TEXT
version               TEXT DEFAULT '1.0'
status                TEXT           -- 'draft' | 'in_progress' | 'submitted' | 'won' | 'lost' | 'archived'
created_by            UUID → profiles(id)
assigned_estimator    UUID → profiles(id)
sharepoint_folder     TEXT
notes                 TEXT
internal_notes        TEXT
total_labor_hrs       NUMERIC(10,2)
total_labor_cost      NUMERIC(12,2)
total_material_cost   NUMERIC(12,2)
total_overhead        NUMERIC(12,2)
total_profit          NUMERIC(12,2)
sell_price            NUMERIC(12,2)
bid_date              DATE
submitted_at          TIMESTAMPTZ
awarded_at            TIMESTAMPTZ
locked_at             TIMESTAMPTZ    -- set when converted to project (baseline locked)
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
```

### `estimate_cost_settings`
Mirrors the `Settings` object from hvac-estimator's `projectSettings.js`.
```sql
id                    UUID PK
estimate_id           UUID UNIQUE → estimates(id)
wage_rate             NUMERIC(8,2)
overhead_pct          NUMERIC(5,4)
profit_pct            NUMERIC(5,4)
bond_pct              NUMERIC(5,4)
team                  TEXT           -- 'pensacola' | 'panama-city'
miles_one_way         NUMERIC(6,1)
mileage_rate          NUMERIC(6,4)
trips                 INT
vertical_market       TEXT
site_access           BOOLEAN
safety_reqs           BOOLEAN
occupied_pct          NUMERIC(5,4)
overtime_pct          NUMERIC(5,4)
shift_pct             NUMERIC(5,4)
retrofit_pct          NUMERIC(5,4)
work_above_15_pct     NUMERIC(5,4)
supervision           BOOLEAN
vav_field_mount       BOOLEAN
fire_seals            BOOLEAN
misc_materials        BOOLEAN
-- ... full settings mirroring projectSettings.js defaults
```

### `estimate_items`
Each row = one HVAC system on the estimate.
```sql
id                UUID PK
estimate_id       UUID → estimates(id)
system_type       TEXT    -- 'vav' | 'ahu' | 'rtu' | 'fcu' | 'uh' | 'dx' | 'vrf' | 'plant' | 'network'
tag               TEXT    -- 'VAV-1', 'AHU-3B'
location          TEXT
qty               INT DEFAULT 1
install_type      TEXT    -- 'EMT' | 'Plenum'
cfg               JSONB   -- system-specific config object (from hvac-estimator)
selected          JSONB   -- [{id, qty}] component selections
custom            JSONB   -- custom assemblies
price_snap        JSONB   -- {compId: {mtl, lbr}} snapshot
prices_locked_at  TIMESTAMPTZ
total_labor_hrs   NUMERIC(10,2)
total_labor_cost  NUMERIC(12,2)
total_material    NUMERIC(12,2)
sort_order        INT
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

### `price_book_overrides`
Persists the hvac-estimator price book overrides server-side (replacing localStorage).
```sql
id            UUID PK
item_id       TEXT NOT NULL  -- assembly/unit item ID
price_type    TEXT           -- 'unit' | 'assembly'
mtl_override  NUMERIC(10,4)
lbr_override  NUMERIC(10,4)
updated_by    UUID → profiles(id)
updated_at    TIMESTAMPTZ
UNIQUE(item_id, price_type)
```

---

## 5. Projects Domain

A project is created by converting an awarded estimate. The estimate snapshot becomes the immutable baseline.

### `projects`
```sql
id                    UUID PK
job_number            TEXT UNIQUE    -- 2026-041 (auto-generated)
year                  INT
sequence              INT
estimate_id           UUID → estimates(id) NULLABLE  -- null if created manually
quote_request_id      UUID → quote_requests(id) NULLABLE
customer_id           UUID → customers(id)
name                  TEXT NOT NULL
display_name          TEXT           -- '2026-041 - Mobile Arena Renovation'
location              TEXT
pm_id                 UUID → profiles(id)
estimator_id          UUID → profiles(id) NULLABLE
status                TEXT           -- 'active' | 'on_hold' | 'complete' | 'archived'
is_active             BOOLEAN DEFAULT true

-- Baseline (locked from estimate at award time)
baseline_estimated_income   NUMERIC(12,2)
baseline_labor_hrs          NUMERIC(10,2)
baseline_labor_cost         NUMERIC(12,2)
baseline_material_cost      NUMERIC(12,2)
baseline_overhead           NUMERIC(12,2)
baseline_profit             NUMERIC(12,2)

-- Live tracking
estimated_income      NUMERIC(12,2)  -- may update with change orders
actual_labor_hrs      NUMERIC(10,2)  -- from QBO Time (future)
actual_material_cost  NUMERIC(12,2)  -- from QBO (future)

onedrive_path         TEXT           -- legacy POC sheet path
sharepoint_folder     TEXT           -- /Projects/2026-041 - Mobile Arena Renovation
award_date            DATE
start_date            DATE
target_completion_date DATE
actual_completion_date DATE
notes                 TEXT
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
```

### `billing_periods` (already exists, enhanced)
```sql
-- Existing columns retained
-- Add:
job_number            TEXT           -- denormalized for reporting
change_order_amount   NUMERIC(12,2) DEFAULT 0
```

### `weekly_updates` (already exists)

### `change_orders` (future)
```sql
id                UUID PK
project_id        UUID → projects(id)
co_number         TEXT    -- CO-001, CO-002
description       TEXT
amount            NUMERIC(12,2)
approved          BOOLEAN DEFAULT false
approved_by       UUID → profiles(id)
approved_at       TIMESTAMPTZ
created_at        TIMESTAMPTZ
```

---

## 6. PM Directory Domain

### `pm_directory` (already exists, refined)
Keep as-is. Links profile → first name for email personalization.

---

## 7. Data in Database vs SharePoint

| Data | Location | Reason |
|------|----------|--------|
| Quote request metadata | Supabase | Queryable, relational, RLS-protected |
| Quote request attachments (files) | SharePoint | Large binaries, versioning, customer-upload support |
| Estimate records + items | Supabase | Complex relational queries, price calculations |
| Price book master data | Supabase | Shared across users, replaces localStorage |
| Project records + billing | Supabase | Core operational data, RLS per PM |
| Weekly update notes | Supabase | Queried by admin/customer/PM |
| Internal/PM notes | Supabase | Controlled visibility |
| Proposals (submitted .docx) | SharePoint | Deliverable files, customer-safe download |
| Signed contracts | SharePoint | Legal documents, versioned |
| Project drawings / specs | SharePoint | Large files, versioned |
| Billing export .xlsx | SharePoint | Archive copies, human-accessible |
| POC sheets | SharePoint (OneDrive) | Already there, synced via Graph API |
| Power BI datasets | Power BI Service | Reads from Supabase PostgreSQL connector |

---

## 8. Lifecycle Conversion Model

### Quote Request → Estimate

```
Triggered by: Admin clicks "Create Estimate" on quote request detail page

Action:
  1. Create estimate record
     - Inherit: customer_id, project_name, project_location, bid_date, notes
     - Set: quote_request_id, status='draft', assigned_estimator
     - Generate: estimate_number (EST-YYYY-NNN)
  2. Set quote_request.status = 'estimating'
  3. Create SharePoint folder: /Estimates/EST-2026-014 - CustomerName
  4. Copy attachments from quote request's /01 Customer Uploads → estimate folder
  5. Redirect to estimate detail page
```

### Estimate → Project (Award)

```
Triggered by: Admin clicks "Award Project" on estimate detail page

Action:
  1. Lock estimate (estimates.locked_at = now())
  2. Create project record
     - Inherit: customer_id, name, location, estimator_id
     - Snapshot: estimated_income = estimate.sell_price
     - Snapshot: baseline_* columns from estimate totals
     - Generate: job_number (YYYY-NNN)
     - Set: display_name = '2026-041 - Project Name'
  3. Set estimate.status = 'won', estimate.awarded_at = now()
  4. Set quote_request.status = 'won' (if linked)
  5. Create billing_period record for current month
  6. Create SharePoint project folder:
     /Projects/2026-041 - CustomerName - ProjectName/
       01 Estimate Baseline/
       02 Drawings & Specs/
       03 Submittals/
       04 Billing/
       05 Closeout/
  7. Copy awarded estimate .docx from estimate folder → 01 Estimate Baseline
  8. Notify PM via Outlook draft
  9. Redirect to project detail page
```

---

## 9. Numbering Systems

| Entity | Format | Example | Logic |
|--------|--------|---------|-------|
| Quote Request | QR-YYYY-NNN | QR-2026-014 | Sequential per year, auto-generated on insert |
| Estimate | EST-YYYY-NNN | EST-2026-022 | Sequential per year, auto-generated on insert |
| Project/Job | YYYY-NNN | 2026-041 | Sequential per year, read-only after creation |
| Change Order | CO-NNN | CO-003 | Sequential per project |
| Billing Period | (period_month date) | 2026-03-01 | First of month, derived |

All sequences are enforced in PostgreSQL via functions (not application code) to prevent race conditions.
