## Files created or modified
- `supabase/migrations/003_migration_status.sql`
- `src/types/database.ts`
- `src/app/api/admin/migrate-sharepoint/route.ts`
- `src/lib/graph/client.ts`
- `src/app/admin/page.tsx`
- `src/app/pm/page.tsx`
- `src/app/admin/migrate-sharepoint/page.tsx`
- `codex/task-009-output.md`

## SQL migration
- Timothy must run `supabase/migrations/003_migration_status.sql` in the Supabase SQL editor before using the new `migration_status` field in production.

## Summary of changes
- Added migration `003_migration_status.sql` to create `projects.migration_status` with allowed values `legacy`, `migrated`, and `clean`.
- Extended the `Project` interface to include `migration_status`.
- Updated the SharePoint migration route to use the archive-folder pattern for projects and bids.
- Restored OneDrive-to-SharePoint copy into `/99 Archive - Legacy Files/` only, with non-fatal archive copy behavior.
- Set `migration_status: "legacy"` when inserting migrated project records.
- Added a legacy badge in the admin Projects tab.
- Added a legacy badge in the PM portal and ensured the PM query includes `migration_status`.
- Updated the migration tool info box to describe the archive pattern and legacy workflow.
- Fixed one PM page TypeScript normalization issue surfaced by the required build.

## Build result
- clean

## Blockers or questions
- none
