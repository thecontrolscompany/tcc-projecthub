## Files modified
- `src/app/api/admin/import-pm-directory/route.ts`
- `src/app/admin/page.tsx`
- `codex/task-018-import-debug-output.md`

## PM import debug changes
- Kept the PM import on Graph `GET /users?$top=999`
- Added server-side logging of the raw Graph user count before any filtering
- Added a warning log when Graph returns one or fewer users, since that usually indicates the signed-in admin lacks the directory role needed to read the full tenant

## API response
- Added `rawCount` to the PM import response
- Success responses now return:
  - `rawCount`
  - `inserted`
  - `updated`
  - `skipped`
- Error responses now include `rawCount` when Graph succeeded but a later step failed

## Admin UI
- Updated the PM Directory import status message to show how many users Graph returned before filtering
- Success message now reads like:
  - `Graph returned 47 users, imported 12, skipped 35.`
- Error messages now append the raw Graph count when available

## Build result
- clean
- Ran `npm run build`

## Git
- Committed and pushed the PM import debug changes to `origin main`

## Notes
- Left unrelated untracked screenshot files untouched
