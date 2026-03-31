## Files modified
- `src/app/admin/page.tsx`
- `codex/task-019-pm-directory-edit-output.md`

## PM Directory CRUD
- Added an `Add PM` button for manually creating PM directory entries
- Added an `Edit` button on each PM row that opens a modal
- Added a `Delete` button on each PM row with confirmation
- Save and delete operations now use Supabase client calls directly against `pm_directory`

## Fields editable
- `email`
- `first_name`
- `last_name`

## Linked portal account display
- PM Directory rows now clearly show whether a row has a linked portal account via `profile_id`
- Linked rows show a `Linked Portal Account` badge and the related profile name when available
- External/manual rows show `External / No Portal Link`

## Build result
- clean
- Ran `npm run build`

## Git
- Committed and pushed the PM Directory edit changes to `origin main`

## Notes
- Left unrelated untracked screenshot files untouched
