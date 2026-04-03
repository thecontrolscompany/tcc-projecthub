# Roadmap — QuickBooks Online Integration

## Core concept

Two-way sync between TCC ProjectHub and QuickBooks Online.
QBO is the financial system of record. The portal is the operational system of record.
The integration bridges them so neither system requires double-entry.

---

## What QBO unlocks for TCC

| Portal feature | What QBO provides |
|---|---|
| `projects.estimated_income` | Pull from accepted Estimate `TotalAmt` — no manual entry |
| `billing_periods.actual_billed` | Pull from posted Invoice `TotalAmt` |
| `billing_periods.paid` | Invoice `Balance == 0` |
| Material cost per project | Bill line `AccountBasedExpenseLineDetail.CustomerRef` |
| Labor cost per project | TimeActivity `CustomerRef + Hours` |
| Customer list | Customer objects (parent level) |
| Job list | Sub-customer objects (`Job = true`) |
| Change order contract value | Sum of accepted Estimates per job |

---

## Authentication: OAuth 2.0

### Flow
1. Redirect user to `https://appcenter.intuit.com/connect/oauth2` with scope `com.intuit.quickbooks.accounting`
2. User authorizes → Intuit redirects back with `?code=AUTH_CODE&realmId=REALM_ID`
3. POST to `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer` with auth code → get `access_token` + `refresh_token`
4. Store `access_token`, `refresh_token`, `realm_id`, `token_expires_at`, `refresh_token_expires_at` in Supabase `qbo_tokens` table (encrypted)

### Token lifetimes
- **Access token**: 1 hour
- **Refresh token**: 5 years (hard cap as of October 2023 policy)
- **Rotation**: Every refresh call returns a NEW refresh token — store it immediately or lose access
- **Reconnect warning**: Build a UI warning when `refresh_token_expires_at` is within 30 days

### Scope needed
`com.intuit.quickbooks.accounting` — this is the only scope needed for all data described here.

---

## API base URLs

```
Production: https://quickbooks.api.intuit.com/v3/company/{realmId}/{endpoint}
Sandbox:    https://sandbox-quickbooks.api.intuit.com/v3/company/{realmId}/{endpoint}
```

Always append `?minorversion=70` to every request. Required headers:
```
Authorization: Bearer {access_token}
Accept: application/json
Content-Type: application/json
```

Query language (IQL — SQL-like):
```
GET /v3/company/{realmId}/query?query=SELECT * FROM Invoice WHERE CustomerRef = '123' MAXRESULTS 100
```
Max 1,000 results per page. Paginate with `STARTPOSITION`.

---

## Key entities and fields

### Customer / Job (Sub-Customer)
QBO has no "Job" object — jobs are sub-customers with `Job: true` and `ParentRef.value` set to parent customer ID.

| Field | Notes |
|---|---|
| `Id` | QBO ID — use as FK to `projects` |
| `DisplayName` | Full name — store TCC job number here e.g. `"2025-026 Mobile Arena"` |
| `Job` | `true` = this is a job/sub-customer |
| `ParentRef.value` | Parent customer ID |
| `IsProject` | Read-only — `true` if created as QBO Project in UI. Cannot set via API. |
| `Active` | `false` = archived |
| `Balance` | Outstanding A/R balance |

Query all active jobs: `SELECT * FROM Customer WHERE Job = true AND Active = true`

**Gotcha**: `IsProject` is read-only. If TCC's bookkeeper creates jobs via QBO's Projects feature, you can read them but `IsProject=true` — cannot create via API.

---

### Invoice (AR / Billing)

| Field | Notes |
|---|---|
| `Id` | QBO ID |
| `DocNumber` | Invoice number |
| `TxnDate` | Invoice date |
| `CustomerRef.value` | Sub-customer (job) ID |
| `TotalAmt` | Invoice total = `actual_billed` |
| `Balance` | `0` = fully paid; `> 0` = unpaid/partial |
| `Line[]` | Line items (SalesItemLineDetail) |
| `LinkedTxn[]` | Linked payments, estimates |

Filter by job: `SELECT * FROM Invoice WHERE CustomerRef = '{jobId}' ORDER BY TxnDate DESC`

**Payment status**: `Invoice.Balance == 0` = paid. No separate "paid" flag.

**Progress billing**: No native API method to convert estimate to invoice at X%. Build the invoice manually from estimate line items with calculated amounts.

---

### Bill (AP / Material + Sub Costs)

| Field | Notes |
|---|---|
| `VendorRef.value` | Vendor/supplier ID |
| `TotalAmt` | Total cost |
| `Line[].AccountBasedExpenseLineDetail.CustomerRef.value` | **Job ID lives HERE on each line, not on bill header** |
| `Line[].AccountBasedExpenseLineDetail.BillableStatus` | `Billable`, `NotBillable`, `HasBeenBilled` |

**Critical gotcha**: Bills have NO top-level `CustomerRef`. Job assignment is per-line only.
IQL cannot filter by nested line fields. Options:
1. Pull all bills in date range, filter client-side
2. Use Report API: `GET /reports/ProfitAndLossDetail?customer={jobId}`

---

### Estimate (Contract Value)

| Field | Notes |
|---|---|
| `TxnStatus` | `Pending`, `Accepted`, `Closed`, `Rejected` |
| `TotalAmt` | Contract total = `projects.estimated_income` |
| `CustomerRef.value` | Job ID |
| `LinkedTxn[]` | Linked invoices |

Filter accepted contracts: `SELECT * FROM Estimate WHERE CustomerRef = '{jobId}' AND TxnStatus = 'Accepted'`

**No single "contract amount" field** — derive from sum of accepted estimates per job (covers original + change orders if each CO is a separate estimate).

---

### TimeActivity (Labor Hours)

| Field | Notes |
|---|---|
| `EmployeeRef.value` | Employee ID |
| `CustomerRef.value` | Job ID |
| `Hours` + `Minutes` | Time worked |
| `BillableStatus` | Billable / NotBillable / HasBeenBilled |
| `HourlyRate` | Rate used |
| `TxnDate` | Work date |

Query: `SELECT * FROM TimeActivity WHERE CustomerRef = '{jobId}'`

**Gotcha**: If TCC uses QBO Payroll, payroll timesheets use the new GraphQL Time API (not REST). That API requires `payroll.compensation.read` scope and is **not available in sandbox** — production only.

---

### Payment

| Field | Notes |
|---|---|
| `CustomerRef.value` | Customer/job who paid |
| `TotalAmt` | Payment amount |
| `Line[].LinkedTxn[]` | Which invoices this payment applies to |
| `TxnDate` | Payment date |

Check if specific invoice is paid: use `Invoice.Balance == 0` — simpler than querying payments.

---

## Change Orders — no native QBO concept

QBO has no Change Order object. TCC approach:
- Track COs in ProjectHub `change_orders` table (already exists)
- When creating a QBO invoice, include approved COs as additional `SalesItemLineDetail` lines
- To track contract value including COs: create a new Estimate per approved CO with `TxnStatus = Accepted`
- Sum all accepted Estimates per job = total contracted amount

---

## Webhooks

Subscribe in Intuit Developer Portal → your app → Webhooks.
Supported entities: Customer, Invoice, Bill, Estimate, Payment, TimeActivity, and more.
Supported operations: `Create`, `Update`, `Delete`, `Void`

**Payload is a stub** — only contains entity name, ID, operation, timestamp. Must make follow-up API call to get data.

Verify webhook signature:
```ts
import crypto from 'crypto';
function verifyWebhook(payload: string, signature: string, verifierToken: string) {
  const hash = crypto.createHmac('sha256', verifierToken).update(payload).digest('base64');
  return hash === signature;
}
// signature from req.headers['intuit-signature']
// verifierToken from Intuit Developer Portal → Webhooks
```

Delivery: ~5 min latency, batched, best-effort with retries. Plan for duplicates (idempotency key = `entityId + operation + lastUpdated`).

---

## Change Data Capture (use instead of polling)

Much more efficient than querying each entity on a schedule:
```
GET /v3/company/{realmId}/cdc?entities=Customer,Invoice,Bill,TimeActivity,Payment&changedSince=2026-04-01T00:00:00-07:00
```
- Returns all creates/updates/deletes since the given timestamp
- Max 30-day lookback
- First sync: full query per entity. Subsequent syncs: CDC with last-sync timestamp stored in DB.

---

## Rate limits

| Limit | Value |
|---|---|
| Requests/minute per company | 500 |
| Concurrent requests | 10 |
| Query max results/page | 1,000 |
| Free GET calls/month | 500,000 then metered |

HTTP 429 = rate limited. Implement exponential backoff with `Retry-After` header.

---

## Sandbox setup

1. Go to developer.intuit.com → create app (select `com.intuit.quickbooks.accounting` scope)
2. Note separate Client ID / Client Secret for sandbox vs production
3. Developer Profile → Sandbox → Add Sandbox Company (pre-populated with sample data)
4. Sandbox base URL: `https://sandbox-quickbooks.api.intuit.com/...`
5. Sandbox company valid for 2 years; up to 10 sandbox companies
6. **GraphQL Time/Payroll API not available in sandbox** — use REST `TimeActivity` instead

---

## Node.js packages

```
npm install intuit-oauth          # Official Intuit OAuth client
npm install node-quickbooks       # Community SDK with entity CRUD wrappers
```

Or use raw `fetch` with bearer token — simpler for a limited integration.

---

## Integration phases for TCC

### Phase 1 — Read only (safe, build first)
- OAuth flow + token storage in `qbo_tokens` table
- Pull customers → sync to `customers` table
- Pull jobs (sub-customers) → match to `projects` by job_number in DisplayName
- Pull accepted Estimates → populate `projects.estimated_income`
- Pull Invoices → populate `billing_periods.actual_billed` + `billing_periods.paid`
- Show QBO payment status on billing table

### Phase 2 — Write (more complex)
- Push TCC billing calculation to QBO as Invoice draft
- Include approved COs as additional invoice lines
- Mark billing period as invoiced after QBO invoice is created

### Phase 3 — Full job costing
- Pull Bills → populate material actual costs per project
- Pull TimeActivity → populate labor hours per project
- Show budget vs actual with real cost data (not estimates)
- Payroll rate sync for true labor cost calculation

---

## DB schema for tokens

```sql
CREATE TABLE qbo_tokens (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id                  text NOT NULL UNIQUE,
  access_token              text NOT NULL,       -- encrypt at rest
  refresh_token             text NOT NULL,       -- encrypt at rest
  token_expires_at          timestamptz NOT NULL,
  refresh_token_expires_at  timestamptz NOT NULL,
  connected_by              uuid REFERENCES profiles(id),
  connected_at              timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
```

---

## API routes to build

```
GET  /api/qbo/auth              -- initiate OAuth (redirect to Intuit)
GET  /api/qbo/callback          -- OAuth callback, store tokens
GET  /api/qbo/status            -- check connection status + token expiry
DELETE /api/qbo/disconnect      -- revoke + delete tokens
POST /api/qbo/sync-customers    -- Phase 1: sync customers
POST /api/qbo/sync-jobs         -- Phase 1: sync sub-customers → projects
POST /api/qbo/sync-estimates    -- Phase 1: sync estimated_income
POST /api/qbo/sync-invoices     -- Phase 1: sync actual_billed + paid status
POST /api/qbo/create-invoice    -- Phase 2: push billing calculation to QBO
POST /api/qbo/sync-bills        -- Phase 3: sync material costs
POST /api/qbo/sync-time         -- Phase 3: sync labor hours
```

---

## Key gotchas summary

1. `realmId` is per-company — required in every URL
2. `SyncToken` required for all updates — always read first, include in update
3. Bills have no top-level `CustomerRef` — job cost is per-line only, cannot filter via IQL
4. `IsProject` is read-only — cannot create QBO Projects via API
5. Refresh token rotation — save new refresh token atomically or lose access
6. Webhook payload is stub only — must fetch full entity after receiving event
7. No native change order object — handle in portal, push to invoice as line items
8. Estimate → Invoice conversion has no API method — build invoice from scratch
9. Payroll Time API (GraphQL) not available in sandbox
10. Always use `?minorversion=70` on all requests
11. CDC is better than polling for sync — use it after initial full sync

---

## Priority: High strategic value
## Depends on: budget-vs-actual (task 058), timesheets (task 056)
## Suggested task number: 059
## Sandbox app registration: developer.intuit.com (separate from production)
