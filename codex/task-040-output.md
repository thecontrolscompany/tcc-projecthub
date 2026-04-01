# Task 040 Output

## What Changed

- Added manual migration `supabase/migrations/021_weekly_update_draft_edit.sql` for:
  - `weekly_updates.status` (`draft` / `submitted`)
  - new `weekly_update_edits` audit table
- Added `WeeklyUpdateStatus` and `WeeklyUpdateEdit` types in `src/types/database.ts`.
- Added server write route `src/app/api/pm/weekly-update/route.ts` so PM save/submit/edit actions use the service-role client instead of fragile browser writes.
- Updated `src/app/api/pm/projects/route.ts` to return `status` plus edit history for the latest report.
- Updated `src/app/pm/page.tsx` with:
  - `Save Draft`
  - `Submit Weekly Update`
  - read-only submitted view with `Edit`
  - `Save Edit` + optional edit note
  - edit history list
  - draft/submitted badges in history
- Updated `src/app/api/customer/data/route.ts` and `src/app/status/[job_number]/page.tsx` so customers/public status only see submitted reports.
- Updated `src/app/api/admin/data/route.ts` and `src/app/admin/page.tsx` so admin weekly updates include a status badge for draft vs submitted.

## Verification

- `npm run build` passed clean on 2026-04-01.

## Manual Step

- Timothy still needs to run `supabase/migrations/021_weekly_update_draft_edit.sql` in Supabase before this feature can work in production.
