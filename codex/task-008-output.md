## Files created or modified
- `supabase/migrations/002_add_sharepoint_columns.sql`
- `src/types/database.ts`
- `src/lib/graph/client.ts`
- `src/app/api/admin/migrate-sharepoint/route.ts`
- `src/app/api/admin/sharepoint-cleanup/route.ts`
- `src/app/admin/migrate-sharepoint/page.tsx`

## SQL migration
- Run `supabase/migrations/002_add_sharepoint_columns.sql` manually in the Supabase SQL editor before using the updated migration tool.

## Summary of fixes applied
- Added SharePoint tracking columns and indexes for `projects` via a new SQL migration and updated the `Project` TypeScript interface.
- Added SharePoint folder listing, folder lookup, and delete helpers to the Graph client, and changed SharePoint folder creation to use conflict behavior `fail`.
- Reworked the migration POST route to batch work, skip already-migrated job numbers, reuse existing SharePoint folder IDs on `409`, and stop copying file contents from OneDrive.
- Switched project inserts to use the new `sharepoint_folder`, `sharepoint_item_id`, and `job_number` fields.
- Added a new admin cleanup API to scan for and delete duplicate SharePoint folders with names ending in ` 1`, ` 2`, etc.
- Updated the admin migration page with an instructions box, batched execute progress, and a new Cleanup Duplicates tab.

## Build result
- clean
- existing warning only: Next.js reports that the `middleware` file convention is deprecated in favor of `proxy`

## Blockers or questions
- none
