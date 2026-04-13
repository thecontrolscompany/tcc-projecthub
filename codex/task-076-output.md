# Task 076 Output

## What Was Done

- Added QuickBooks Time environment variable docs to `.env.local.example`.
- Ported the live QuickBooks Time sync library into ProjectHub at `src/lib/qb-time/sync.ts`.
- Added admin-only sync endpoint at `src/app/api/admin/sync-qb-time/route.ts`.
- Added an admin-only "Sync QB Time" action to the `/time` module UI with loading, success, and error states.
- Passed admin role context from `src/app/time/page.tsx` into the time home UI so the sync button only appears for admins.

## Reminder

- `QUICKBOOKS_TIME_ACCESS_TOKEN` must be added to `.env.local` for local use.
- `QUICKBOOKS_TIME_ACCESS_TOKEN` must also be added to Vercel environment variables for the sync to work in production.

## Ported Vs Fresh

- Ported from TCC Time and adapted for ProjectHub:
  - `getQuickBooksTimeConfig()`
  - `fetchQuickBooksTime()`
  - `fetchQuickBooksTimePaginated()`
  - `importQuickBooksTimeData()`
  - `extractCollection()`
  - `mapQuickBooksUser()`
  - `mapQuickBooksJobcode()`
  - `mapQuickBooksTimesheet()`
  - `getQuickBooksRecord()`
  - `getDateDaysAgo()`
  - `parseIsoTimestamp()`
- Written fresh for ProjectHub:
  - admin API route wrapper for sync execution
  - `/time` page admin-role handoff
  - sync button UI state and messaging in the time module

## Decisions Made

- Removed the legacy employee-mapping portion from the imported sync flow because ProjectHub uses `profile_qb_time_mappings` and already handles reconciliation separately through the existing `/time/reconcile` flow.
- Generated `integration_sync_runs.id` in ProjectHub during sync because the local schema requires an explicit UUID for new sync-run rows.
- Added the admin sync button to the rendered time-module component, while keeping role detection in the server page so the action stays hidden from non-admin users.
