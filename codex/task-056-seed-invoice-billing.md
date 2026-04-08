# Task 056 — Seed Billing Data from QBO Invoice Export

## Context

We have a QuickBooks Online invoice export covering Jan 1 – Apr 7, 2026. All 37
invoices have been pre-processed into **28 project-month billing records** across
**17 distinct projects**. This task writes a one-time import script that matches
each entry to a project in the database and upserts the `actual_billed` amount into
the corresponding `billing_periods` row.

---

## Pre-processed invoice data

The invoice project names (extracted from the QBO "Customer:Project" field) and
amounts by billing month are listed below. These are final — amounts within the same
project and calendar month have already been summed.

```
period_month  | project_name (match against projects.name)               | actual_billed
--------------+----------------------------------------------------------+---------------
2026-01-01    | Eglin 1416                                               |  209852.00
2026-01-01    | Pivotal Healthcare                                       |    4972.65
2026-01-01    | SOF Human Performance Training                           |   21750.87
2026-02-01    | Crestview Elementary                                     |   33826.32
2026-02-01    | Eglin Wildcat Facility                                   |   15665.32
2026-02-01    | Titan Hangar 3                                           |   11354.08
2026-02-01    | Daphne Elementary South                                  |   15529.11
2026-02-01    | Mobile Arena                                             |   45000.00
2026-02-01    | Soundside High School                                    |    6659.14
2026-02-01    | Eglin Airman                                             |   20135.58
2026-02-01    | Triple H Labor                                           |   13476.06
2026-02-01    | SOF Human Performance Training                           |   12000.00
2026-02-01    | Eglin 1416                                               |   64231.00
2026-03-01    | Arena Toilet Controls                                    |    6990.00
2026-03-01    | Daphne Elementary South                                  |   33199.51
2026-03-01    | Mobile Arena                                             |   69394.32
2026-03-01    | Titan Lighting                                           |   29448.00
2026-03-01    | NAS Fitness Center B832                                  |   10035.00
2026-03-01    | Crestview Elementary                                     |   52277.04
2026-03-01    | Destin Elementary                                        |   12595.68
2026-03-01    | Eglin Wildcat Facility                                   |   11392.96
2026-03-01    | Pivotal Healthcare                                       |    9945.30
2026-03-01    | Titan Hangar 3                                           |   47545.21
2026-03-01    | Eglin Airman                                             |    2188.65
2026-03-01    | SOF Human Performance Training                           |   29250.93
2026-03-01    | Magnolia Elementary                                      |    1717.50
2026-03-01    | Robertsdale Elementary Chiller Upgrade                   |    2584.65
2026-04-01    | Triple H Labor                                           |   15951.78
```

---

## Script to write

Create `scripts/seed-invoice-billing.ts`.

Use the Supabase service role client (same pattern as other API routes — import
`createClient` from `@supabase/supabase-js` with `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` from `.env.local`).

Load env with `dotenv`:
```ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
```

### Logic

```
INVOICE_DATA = the 28 rows above (hardcoded array in the script)

1. Fetch all projects: SELECT id, name FROM projects WHERE is_active = true OR is_active = false

2. For each invoice row:
   a. Match project by name: case-insensitive exact match first, then
      case-insensitive ILIKE contains match. Log a WARNING for any that
      don't match — do not abort, just skip that row and continue.

   b. Look up existing billing_period:
      SELECT * FROM billing_periods
      WHERE project_id = matched_id AND period_month = period_month

   c. If billing_period EXISTS:
      UPDATE billing_periods SET actual_billed = invoice_amount
      WHERE id = existing_id
      Log: UPDATED [project] [month] actual_billed = $X

   d. If billing_period DOES NOT EXIST:
      Compute prev_billed = sum of actual_billed values for this project
      from billing_periods with period_month < this month (from existing DB
      rows), plus any already-processed rows from this same script run
      (in-memory accumulator).

      INSERT INTO billing_periods (
        project_id,
        period_month,
        actual_billed,
        prev_billed,         -- calculated above
        pct_complete,        -- 0 (unknown, admin can update)
        prior_pct,           -- 0
        estimated_income_snapshot -- from projects.estimated_income
      ) VALUES (...)
      Log: CREATED [project] [month] actual_billed = $X  prev_billed = $Y

3. At the end, print a summary:
   - Total rows processed
   - Updated count
   - Created count
   - Skipped/unmatched count (list the unmatched project names)
```

### Important behaviors

- **Dry run flag**: if `--dry-run` is passed as a CLI arg, print every action that
  would be taken without writing anything to the database.
- **Idempotent**: running the script twice should produce the same result (UPDATE is
  safe to repeat; INSERT is guarded by the existence check).
- Process rows in chronological order (Jan → Feb → Mar → Apr) so the prev_billed
  accumulator builds correctly within a single run.
- Round all dollar amounts to 2 decimal places before inserting.

---

## How to run

Add to `package.json` scripts:
```json
"seed:invoices": "npx ts-node --project tsconfig.json scripts/seed-invoice-billing.ts"
```

Run with:
```bash
npm run seed:invoices           # live run
npm run seed:invoices -- --dry-run  # dry run
```

---

## Files to change

| File | What changes |
|------|-------------|
| `scripts/seed-invoice-billing.ts` | New — the import script |
| `package.json` | Add `seed:invoices` script |

No UI changes. No migrations. No new dependencies beyond `dotenv` (already
available via Next.js dev dependencies — if not present, add it).

---

## Acceptance criteria

- [ ] `npm run seed:invoices -- --dry-run` prints a full plan with no DB writes
- [ ] `npm run seed:invoices` runs to completion with no unhandled errors
- [ ] Summary line at end shows counts for updated, created, skipped
- [ ] All 17 project names match (verify by checking the summary — 0 unmatched)
- [ ] Running a second time produces "updated" for all rows (no duplicate inserts)
- [ ] `billing_periods` rows for the 28 project-month combos have the correct
      `actual_billed` values matching the table above

## Commit and push

Commit message: `Seed billing data: import Jan–Apr 2026 invoices from QBO export`
Push to main.
