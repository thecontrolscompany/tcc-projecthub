## Files modified
- `src/app/admin/page.tsx`
- `src/types/database.ts`
- `codex/task-013-output.md`

## Root cause identified
- The immediate data issue is that `billing_periods.estimated_income_snapshot` is `0` in the database until Timothy runs `supabase/seed-projects-fix.sql`
- On the code side, `/admin` depended entirely on the `billing_rows` view, so environments where that view is missing or unavailable could silently fall back to an empty billing table

## Fix applied
- Confirmed `billing_rows` is defined in `supabase/migrations/001_initial_schema.sql`
- Kept the `billing_rows` query as the primary path and added a fallback direct query against `billing_periods` with joined `projects`, `customers`, and `profiles`
- Mapped the fallback result into the `BillingRow` shape expected by `BillingTable`, including customer name, PM fields, backlog, previous billed percent, and to-bill calculation
- Preserved/prepended the job number in the project label when needed

## Build result
- pending

## Blockers or questions
- Timothy still needs to run `supabase/seed-projects-fix.sql` manually in Supabase SQL Editor for the dollar values to stop showing as zero
