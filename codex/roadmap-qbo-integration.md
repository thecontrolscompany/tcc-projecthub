# Roadmap — QuickBooks Online Integration

## Core concept

Two-way sync between TCC ProjectHub and QuickBooks Online.
QBO is the financial system of record. The portal is the operational system of record.
The integration bridges them so neither system requires double-entry.

## What QBO knows that the portal needs

| QBO Data | Portal Use |
|---|---|
| Customers | Sync to `customers` table — one source of truth |
| Jobs/Sub-customers | Map to `projects` (by job number) |
| Invoices (AR) | Actual billed amounts per project per period |
| Bills (AP) | Actual material + sub costs per project |
| Payroll / Time | Actual labor cost per person per project |
| Contract amounts | Estimated Income (currently manual) |
| Payment status | Paid/unpaid per invoice |

## What the portal knows that QBO needs

| Portal Data | QBO Use |
|---|---|
| Billing calculation (To Bill) | Pre-populate invoice amount |
| % Complete | Progress billing memo |
| Weekly update notes | Invoice description |
| Approved change orders | Additional line items on invoice |

## Integration points (phased)

### Phase 1 — Read only (safe starting point)
- Pull customer list from QBO → sync to `customers` table
- Pull invoices per job → populate `billing_periods.actual_billed`
- Pull bills per job → feed budget vs actual (task 058)
- Show QBO payment status on billing table

### Phase 2 — Write (more complex, needs careful mapping)
- Generate QBO invoice draft from billing calculation
- Push approved change orders as invoice line items
- Mark billing period as invoiced after QBO invoice is created

### Phase 3 — Full sync
- Payroll hours → timesheets
- Contract value from QBO estimate → `projects.estimated_income`
- Real-time payment status on customer portal

## Technical approach

QBO uses OAuth 2.0. Stub hooks already exist in the codebase.

```
/api/qbo/auth          -- OAuth flow initiation
/api/qbo/callback      -- OAuth callback, store tokens
/api/qbo/sync-customers -- Phase 1
/api/qbo/sync-invoices  -- Phase 1
/api/qbo/sync-bills     -- Phase 1
/api/qbo/create-invoice -- Phase 2
```

Store QBO tokens in a `qbo_tokens` table (encrypted at rest).

QBO sandbox available for testing at developer.intuit.com.

## Key mapping

`projects.job_number` (e.g. `2025-026`) maps to QBO Sub-customer under The Controls Company.
This is the linking key. Needs to be consistent in both systems.

## Priority: High strategic value — unlocks budget/actual, removes double-entry billing
## Depends on: budget-vs-actual roadmap (task 058), timesheets (task 056)
## Suggested task number: 059
