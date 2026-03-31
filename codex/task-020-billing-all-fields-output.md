## Files modified
- `src/components/billing-table.tsx`
- `src/app/admin/page.tsx`
- `src/types/database.ts`
- `src/lib/billing/calculations.ts`
- `codex/task-020-billing-all-fields-output.md`

## Billing table inline editing
- Extended the existing inline-edit pattern to all non-generated `billing_periods` fields shown in the billing table
- Editable fields now include:
  - `estimated_income_snapshot` via the `Est. Income` column
  - `prior_pct`
  - `pct_complete`
  - `prev_billed`
  - `actual_billed`
  - `notes`

## Behavior
- Cells still use click-to-edit inline controls
- Blur or `Enter` commits the value
- Each edit updates Supabase `billing_periods` directly
- `to_bill`, `backlog`, and `prev_billed_pct` now recalculate locally after edits
- `to_bill` remains non-editable because it is derived from the other values

## Data loading
- Updated the admin billing query to load directly from `billing_periods` with joined project/customer/PM data
- Added `notes` to the billing row shape so it can be displayed and edited inline

## Build result
- clean
- Ran `npm run build`

## Git
- Committed and pushed the billing inline-edit expansion to `origin main`

## Notes
- Left unrelated modified/untracked files untouched
