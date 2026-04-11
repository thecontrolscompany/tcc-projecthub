# Task 071 — Historical Billing Import (QBO Invoice List)

## Purpose

Admin-only tool to import historical `actual_billed` amounts from a QuickBooks
"Invoice List by Date" Excel export into `billing_periods`. Designed for
one-time backfill of pre-2026 data, but safe to re-run as it upserts.

---

## Excel file format

QBO exports this exact layout (do not assume any other format):

| Row | Content |
|-----|---------|
| 1 | "Invoice List by Date" (merged across all cols — skip) |
| 2 | "The Controls Company" (merged — skip) |
| 3 | Date range string e.g. "January 1-April 7, 2026" (skip) |
| 4 | Empty (skip) |
| 5 | **Column headers**: Date, Transaction type, Num, Name, Location full name, Memo, Due date, Amount, Open balance |
| 6+ | Data rows |
| last | Row where col A === "TOTAL" — stop here, do not import |

**Column positions (1-indexed):**
- Col 1 (A): Invoice date — string "MM/DD/YYYY" or Excel date serial
- Col 2 (B): Transaction type — only import rows where this equals "Invoice"
- Col 4 (D): Name — format "Customer Name:Project Name" — split on first ":"
  and take everything **after** the colon as the project name to match
- Col 8 (H): Amount — numeric invoice amount

---

## New files to create

### 1. `src/app/api/admin/billing-import/route.ts`

Two operations on the same POST endpoint, distinguished by a `action` form field:

#### `action = "preview"`
- Accept `multipart/form-data` with a `file` field (the Excel)
- Parse the Excel using `exceljs` (already installed)
- Skip rows 1–5, stop at any row where col 1 === "TOTAL" or col 1 is null/empty
- Only process rows where col 2 === "Invoice"
- For each data row:
  - Parse date from col 1 → derive `period_month` as `YYYY-MM-01`
  - Extract project name = everything after the first `:` in col 4
  - Amount = col 8 as number
- Group rows by `(project_name_raw, period_month)` and sum amounts
- For each unique `project_name_raw`, attempt to match a project in the DB:
  1. **Exact match**: `projects.name ILIKE project_name_raw`
  2. **Fuzzy fallback**: find projects where `name` contains any word from
     `project_name_raw` that is longer than 4 characters, return the
     best single match if unambiguous, or null if multiple candidates
  - Use service-role client; search across all projects (active and inactive)
- Return JSON:
  ```json
  {
    "rows": [
      {
        "project_name_raw": "Destin Elementary",
        "period_month": "2025-03-01",
        "amount": 12595.68,
        "matched_project_id": "uuid-or-null",
        "matched_project_name": "Destin Elementary School or null",
        "match_confidence": "exact" | "fuzzy" | "none"
      }
    ],
    "unmatched_count": 3,
    "matched_count": 14,
    "total_periods": 17
  }
  ```

#### `action = "import"`
- Accept `multipart/form-data` with:
  - `file`: the Excel file
  - `overrides`: JSON string — array of `{ project_name_raw, period_month, project_id }`
    for any rows where the admin corrected the match in the UI
- Re-parse the file (same logic as preview)
- Apply overrides: if a `project_name_raw + period_month` combo has an override
  `project_id`, use that instead of the auto-matched one
- Skip any rows with no resolved `project_id` (unmatched and no override)
- For each resolved `(project_id, period_month)` group:
  - Fetch the existing `billing_period` row if it exists
  - **Upsert** into `billing_periods`:
    - `actual_billed` = sum of amounts for this project+month
    - `estimated_income_snapshot` = existing value if row exists, otherwise
      fetch from `projects.estimated_income`
    - `pct_complete` = existing value if row exists, otherwise 0
    - `prior_pct` = existing value if row exists, otherwise 0
    - `prev_billed` = existing value if row exists, otherwise 0
    - Use Supabase `upsert` with `onConflict: 'project_id,period_month'`
    - **Only set `actual_billed`** — do not overwrite `pct_complete`,
      `prev_billed`, `prior_pct`, or `estimated_income_snapshot` if the row
      already existed (to preserve any values set by previous billing cycles)
    - For new rows (no existing period), set `prev_billed` = sum of
      `actual_billed` across all billing_periods for that project with
      `period_month < this period_month` (computed from DB at import time)
- After all upserts, for each affected `project_id`, recalculate `prev_billed`
  for every period in chronological order:
  ```sql
  -- For each project, sort periods ASC by period_month.
  -- period[0].prev_billed = 0
  -- period[n].prev_billed = SUM of actual_billed for periods 0..n-1
  -- Only update if actual_billed is not null for prior periods
  ```
  Do this in application code: fetch all periods for the project, sort by
  `period_month`, compute cumulative sums, batch update.
- Return:
  ```json
  { "imported": 14, "skipped": 3, "updated_prev_billed_for": 8 }
  ```

**Auth**: require `admin` role. Return 403 otherwise.

---

### 2. `src/app/admin/billing-import/page.tsx`

Client component (`"use client"`). Admin-only (redirect to `/login` if not admin
— check via `supabase.auth.getUser()` and role from profiles on mount).

#### UI layout

```
┌─────────────────────────────────────────────────────────────┐
│  Historical Billing Import                                    │
│  Import QuickBooks "Invoice List by Date" Excel exports      │
│  to backfill actual_billed on billing periods.               │
│                                                              │
│  [Choose file]  [Preview]                                    │
├─────────────────────────────────────────────────────────────┤
│  Preview (shown after upload)                                │
│                                                              │
│  Summary: 14 matched · 3 unmatched · 17 billing periods     │
│                                                              │
│  ┌──────────────────┬──────────┬──────────┬──────────────┐  │
│  │ QBO Name         │ Month    │ Amount   │ Matched To   │  │
│  ├──────────────────┼──────────┼──────────┼──────────────┤  │
│  │ Destin Elementary│ Mar 2025 │ $12,595  │ ✓ Destin Ele │  │
│  │ Some Other Proj  │ Mar 2025 │ $ 5,000  │ ⚠ [dropdown] │  │
│  │ Unknown Project  │ Feb 2025 │ $ 3,200  │ ✗ Skip       │  │
│  └──────────────────┴──────────┴──────────┴──────────────┘  │
│                                                              │
│  [Import N matched rows]                                     │
└─────────────────────────────────────────────────────────────┘
```

#### Behaviour

- File input accepts `.xlsx` and `.xls`
- "Preview" button: POST to `/api/admin/billing-import` with `action=preview`
  and the file; render the table
- **Match column**:
  - `match_confidence === "exact"` → green checkmark + project name
  - `match_confidence === "fuzzy"` → amber warning icon + project name +
    a `<select>` dropdown pre-selected on the fuzzy match, listing all projects
    alphabetically so admin can correct it
  - `match_confidence === "none"` → red ✗ + "No match — will skip" (no dropdown;
    these rows are excluded from import)
- Admin can change any dropdown to correct a fuzzy match
- "Import N matched rows" button: POST to `/api/admin/billing-import` with
  `action=import`, the file, and a JSON array of overrides from all the dropdowns
- Show a success banner: "Imported 14 periods. Updated prev_billed for 8 projects."
- Show an error banner if the API returns an error

#### Styling

Use the existing app shell and dark theme token classes (same as other admin
pages). No special styling needed — plain `rounded-2xl border bg-surface-raised`
cards, `text-text-primary`, `border-border-default`, etc.

---

## Link from admin page

**File:** `src/app/admin/page.tsx`

Find the admin nav or the top of the page. Add a link/button somewhere visible
to admins:

```tsx
<a
  href="/admin/billing-import"
  className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-base"
>
  Import Historical Billing
</a>
```

Place it near any existing export/import buttons, or at the top of the billing tab.

---

## Acceptance criteria

- `/admin/billing-import` renders; non-admin users are redirected to `/login`
- Uploading the sample file (`project updates/The Controls Company_Invoice List by Date.xlsx`)
  and clicking Preview shows the correct row count, matched projects, and amounts
- Rows with `Transaction type !== "Invoice"` are excluded
- The TOTAL row and empty rows are not imported
- Multiple invoices in the same project+month are summed into a single `actual_billed`
- Upsert does not overwrite `pct_complete` or `prev_billed` on existing rows
- After import, `prev_billed` is recalculated correctly for all affected projects
- Import is idempotent: running it twice with the same file produces the same result

## When done

Run `npm run build` to confirm no type errors. Commit all new and modified files
and push to `main`.
