# Task 013 — Billing Table: Data Fix + Display Improvements

## Context

The admin billing table at `/admin` shows all projects with $0 for every column.
The root cause is two-fold:

1. **Data**: `billing_periods.estimated_income_snapshot` is 0 for all rows. Timothy needs
   to run `supabase/seed-projects-fix.sql` in the Supabase SQL editor to fix this.
   **This SQL step must be done by Timothy manually — do not attempt it in code.**

2. **Code**: The billing table queries a `billing_rows` view. Verify this view exists
   in the database by reading `src/app/admin/page.tsx` and tracing what it queries.
   If `billing_rows` is a Supabase view that may not exist, add a fallback query
   that joins `billing_periods` + `projects` + `customers` directly.

## Read before starting

- `src/app/admin/page.tsx` (full file — find the `billing_rows` query)
- `src/components/billing-table.tsx` (understand what columns it expects)
- `src/types/database.ts` (BillingRow type definition)
- `supabase/migrations/001_initial_schema.sql` (check if billing_rows view is defined)

---

## Part A — Verify or fix the billing_rows data source

In `src/app/admin/page.tsx`, the billing data loads from:
```ts
supabase.from("billing_rows").select("*").eq("period_month", monthStr)
```

`billing_rows` is likely a Supabase database view. If it is NOT defined in the migrations,
the query silently returns empty. Check `supabase/migrations/001_initial_schema.sql` for
a `CREATE VIEW billing_rows` statement.

**If the view is missing**, replace the `billing_rows` query with a direct join:

```ts
const { data, error } = await supabase
  .from("billing_periods")
  .select(`
    id,
    period_month,
    pct_complete,
    prior_pct,
    prev_billed,
    actual_billed,
    estimated_income_snapshot,
    notes,
    project:projects (
      id,
      name,
      job_number,
      customer:customers ( name )
    )
  `)
  .eq("period_month", monthStr)
  .order("period_month");
```

Then map the result to the `BillingRow` shape that `BillingTable` expects.
Check `src/types/database.ts` for the exact `BillingRow` fields and map accordingly.

---

## Part B — Show customer name in billing table

The billing table currently shows a CUSTOMER column but it may be blank.
Ensure the customer name from the joined `customers` table is displayed.

In `src/components/billing-table.tsx`, find where customer name is rendered and
ensure it reads from the correct field in the mapped data.

---

## Part C — Show job number in billing table

Each row in the billing table shows the project name. Prepend the job number if present:

```
2025-014 - Titan Hangar 3
```

This is already the format in the `projects.name` field (job number was prepended during
migration), so it may already be correct. Verify and adjust if needed.

---

## Constraints

- Do not modify `.env.local`
- Do not modify the Supabase schema or run any SQL — data fixes are Timothy's responsibility
- Run `npm run build` after changes, fix only new errors

---

## Timothy's manual SQL step (do BEFORE testing)

Run `supabase/seed-projects-fix.sql` in the Supabase SQL editor.
This updates `projects.estimated_income` and `projects.customer_id` using wildcard
name matching, then syncs `billing_periods.estimated_income_snapshot`.

---

## Output

Create `codex/task-013-output.md`:

```
## Files modified
- list each

## Root cause identified
- describe what was causing $0

## Fix applied
- describe the query change or view confirmation

## Build result
- "clean" or paste new errors

## Blockers or questions
- any ambiguity, or "none"
```
