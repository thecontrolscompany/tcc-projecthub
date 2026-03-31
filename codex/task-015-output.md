## Files modified
- `codex/task-015-pm-import.md`
- `supabase/migrations/005_pm_directory_last_name.sql`
- `src/types/database.ts`
- `src/lib/graph/client.ts`
- `src/app/api/admin/import-pm-directory/route.ts`
- `src/app/admin/page.tsx`
- `codex/task-015-output.md`

## Migration file created
- `supabase/migrations/005_pm_directory_last_name.sql`
- Purpose: adds `pm_directory.last_name` so the Microsoft import can persist both first and last names

## API route
- Added `POST /api/admin/import-pm-directory`
- Auth behavior: requires a signed-in admin and a Microsoft provider token from the Supabase session
- Graph endpoint used: `GET /users` with paging support via `@odata.nextLink`
- Filtering rules:
  - keeps only `userType === "Member"`
  - skips guest users
  - skips disabled accounts
  - skips likely shared/non-person accounts by requiring a usable email plus at least one personal name field
- Upsert behavior:
  - normalizes email to lowercase
  - upserts `email`, `first_name`, and `last_name` into `pm_directory`
  - looks for matching `profiles.email` and links `profile_id` when available
  - preserves any existing non-null `pm_directory.profile_id`
  - returns `inserted`, `updated`, and `skipped` counts

## Admin UI
- Added an `Import from Microsoft` button to the PM Directory tab in `src/app/admin/page.tsx`
- Button shows a loading state while the import runs
- On success, the PM Directory table reloads and displays an inline summary with inserted/updated/skipped counts
- On failure, the tab shows the returned error inline
- Added a `Last Name` column to the PM Directory table

## Error handling
- Missing token behavior: returns a clear message telling Timothy to sign out and sign back in with Microsoft
- Missing scope behavior: returns a clear Azure admin-consent message for `User.ReadBasic.All`

## Build result
- clean
- Ran `npm run build`

## Blockers or follow-up
- Run `supabase/migrations/005_pm_directory_last_name.sql` in Supabase before using the import in the real environment
