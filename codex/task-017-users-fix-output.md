## Files modified
- `src/app/admin/page.tsx`
- `codex/task-017-users-fix-output.md`

## Users tab fix
- Replaced the placeholder Users tab content with a real `profiles` table query
- The tab now displays `profiles.full_name`, `profiles.email`, and `profiles.role`
- Rows no longer depend on a missing join or mismatched alias

## Edit modal
- Added an `Edit` button for each user row
- The modal allows updating:
  - full name
  - role
- Saves changes back to the `profiles` table and refreshes the table after update

## Build result
- clean
- Ran `npm run build`

## Git
- Committed and pushed the Users tab fix to `origin main`

## Notes
- Left unrelated untracked screenshot files untouched
