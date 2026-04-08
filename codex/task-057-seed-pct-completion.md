# Task 057 — Seed % Complete from Billing Tracker (Jan–Mar 2026)

## Context

The legacy Excel billing tracker (`Billing_Tracker_2026.xlsm`) has column G "% Complete"
for each project across the January, February, and March 2026 tabs. This task seeds
those values into `billing_periods.pct_complete`.

Rules applied when extracting this data (already handled — use the pre-processed table below):
- If column G was blank for a month, the value was carried forward from the prior month
- Explicit `0` means the project was deliberately zeroed (not a blank carry-forward)
- "SOF Human Performance" in Excel = "SOF Human Performance Training" in the DB

---

## Pre-processed data — 61 rows

Carry-forward logic has already been applied. Use this table exactly as provided.

```
period_month  | project_name (match against projects.name)          | pct_complete
--------------+-----------------------------------------------------+--------------
2026-01-01    | Crestview Elementary                                | 0.46
2026-01-01    | Cytiva Belt 8                                       | 0.88
2026-01-01    | Daphne Elementary South                             | 0.40
2026-01-01    | Daphne HS Additions                                 | 0.10
2026-01-01    | Destin Elementary                                   | 0.19
2026-01-01    | Eglin Airman                                        | 0.94
2026-01-01    | Eglin Wildcat Facility                              | 0.74
2026-01-01    | Elberta Elementary                                  | 0.70
2026-01-01    | Elberta Middle School                               | 0.05
2026-01-01    | Hurlburt Dorms B90369                               | 0.00
2026-01-01    | Magnolia Elementary                                 | 0.85
2026-01-01    | Mobile Arena                                        | 0.09
2026-01-01    | NAS Fitness Center                                  | 0.10
2026-01-01    | SOF Human Performance                               | 0.29
2026-01-01    | Soundside High School                               | 1.00
2026-01-01    | Titan Hangar 3                                      | 0.31
2026-02-01    | Arena Toilet Controls                               | 0.20
2026-02-01    | Crestview Elementary                                | 0.57
2026-02-01    | Cytiva Belt 8                                       | 0.88
2026-02-01    | Daphne Elementary South                             | 0.50
2026-02-01    | Daphne HS Additions                                 | 0.10
2026-02-01    | Destin Elementary                                   | 0.2192
2026-02-01    | Eglin 1416                                          | 0.1717
2026-02-01    | Eglin Airman                                        | 0.96
2026-02-01    | Eglin Wildcat Facility                              | 0.81
2026-02-01    | Elberta Elementary                                  | 0.70
2026-02-01    | Elberta Middle School                               | 0.05
2026-02-01    | Hurlburt Dorms B90369                               | 0.00
2026-02-01    | Magnolia Elementary                                 | 0.85
2026-02-01    | Mobile Arena                                        | 0.12
2026-02-01    | Mobile Arena CO-2                                   | 0.75
2026-02-01    | NAS Fitness Center                                  | 0.3875
2026-02-01    | Pivotal Healthcare                                  | 0.20
2026-02-01    | SOF Human Performance                               | 0.60
2026-02-01    | Soundside High School                               | 1.00
2026-02-01    | Titan Hangar 3                                      | 0.84
2026-02-01    | Titan Lighting                                      | 0.25
2026-03-01    | Arena Toilet Controls                               | 0.12
2026-03-01    | Crestview Elementary                                | 0.63
2026-03-01    | Cytiva Belt 8                                       | 0.88
2026-03-01    | Daphne Elementary South                             | 0.66
2026-03-01    | Daphne HS Additions                                 | 0.10
2026-03-01    | Destin Elementary                                   | 0.00
2026-03-01    | Eastern Shore Transportation                        | 0.00
2026-03-01    | Eglin 1416                                          | 0.2214
2026-03-01    | Eglin Airman                                        | 1.00
2026-03-01    | Eglin Wildcat Facility                              | 0.90
2026-03-01    | Elberta Elementary                                  | 0.70
2026-03-01    | Elberta Middle School                               | 0.05
2026-03-01    | Hurlburt Dorms B90369                               | 0.00
2026-03-01    | Magnolia Elementary                                 | 1.00
2026-03-01    | Mobile Arena                                        | 0.16
2026-03-01    | NAS Fitness Center                                  | 0.3875
2026-03-01    | Pivotal Healthcare                                  | 0.45
2026-03-01    | Robertsdale Elementary                              | 0.15
2026-03-01    | Rutherford High School Building 1                   | 0.00
2026-03-01    | SOF Human Performance                               | 0.84
2026-03-01    | Soundside High School                               | 1.00
2026-03-01    | Titan Hangar 3                                      | 0.98
2026-03-01    | Titan Lighting                                      | 0.60
2026-03-01    | Triple H Labor                                      | 1.00
```

---

## Name aliases

Some billing tracker names differ from DB project names. Apply these aliases when
matching (try each alias in order; use the first that produces a match):

```
"SOF Human Performance"     → also try "SOF Human Performance Training"
"NAS Fitness Center"        → also try "2023-015 - NAS B832 Fitness Center"
"Daphne Elementary South"   → also try "2024-006 - Daphne South Elem"
"Robertsdale Elementary"    → also try "Robertsdale Elementary Chiller Upgrade"
"Mobile Arena CO-2"         → also try exact match only; if no match, log as WARNING and skip
```

For all other names use: case-insensitive exact match first, then case-insensitive
contains match. If still no match, log WARNING and skip.

---

## Script to write

Create `scripts/seed-pct-completion.ts`.

Same setup pattern as `scripts/seed-invoice-billing.ts`:
- Load `.env.local` via dotenv
- Use Supabase service-role client
- Support `--dry-run` CLI flag
- Print a summary at the end: updated, created, skipped

### Logic

Process rows in chronological order (Jan → Feb → Mar) as provided.

For each row:

1. **Match project name** using the alias rules above. If no match: log WARNING, skip.

2. **Look up billing_period**:
   ```
   SELECT * FROM billing_periods
   WHERE project_id = matched_id AND period_month = row.period_month
   ```

3. **If billing_period EXISTS**:
   - `UPDATE billing_periods SET pct_complete = row.pct_complete WHERE id = existing_id`
   - Also update `prior_pct` to the pct_complete of the immediately preceding month's
     billing_period for this project (query: same project_id, largest period_month < this month).
     If no prior period exists, set prior_pct = 0.
   - Log: `UPDATED [project] [month] pct_complete = X`

4. **If billing_period DOES NOT EXIST**:
   - Compute `prev_billed` = sum of `actual_billed` for this project across all
     billing_periods with period_month < this month (from DB).
   - Compute `prior_pct` = pct_complete from the most recent billing_period for this
     project with period_month < this month, or 0 if none.
   - Fetch `estimated_income_snapshot` from `projects.estimated_income`.
   - INSERT new billing_period:
     ```
     project_id, period_month, pct_complete, prior_pct,
     prev_billed, actual_billed = null,
     estimated_income_snapshot
     ```
   - Log: `CREATED [project] [month] pct_complete = X`

---

## Add to package.json

```json
"seed:pct": "npx ts-node --project tsconfig.json scripts/seed-pct-completion.ts"
```

---

## Files to change

| File | What changes |
|------|-------------|
| `scripts/seed-pct-completion.ts` | New — the import script |
| `package.json` | Add `seed:pct` script |

No UI changes. No migrations.

---

## Acceptance criteria

- [ ] `npm run seed:pct -- --dry-run` prints all 61 planned actions with no DB writes
- [ ] `npm run seed:pct` runs to completion
- [ ] Summary shows 0 unmatched (all 61 rows resolve to a project)
- [ ] Running a second time: all rows show as UPDATED (idempotent)
- [ ] Spot check: `billing_periods` row for Crestview Elementary Jan 2026 has
      `pct_complete = 0.46`; March row has `pct_complete = 0.63`
- [ ] Spot check: SOF Human Performance Feb 2026 has `pct_complete = 0.60`
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `Seed pct_complete from 2026 billing tracker (Jan–Mar)`
Push to main.
