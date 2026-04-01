# Task 036 Output

## Actual Error

The main save failure was in `src/app/api/admin/save-project/route.ts`.

- The route was checking role with a direct `profiles` lookup by `user.id`
- Microsoft-authenticated internal users can have a valid session but still require the stronger resolved-role path already used elsewhere in the app
- That meant `/api/admin/save-project` could return `403 Access denied.` even when the same user was already inside the admin or ops UI

There was also a second issue:

- `src/components/ops-project-list.tsx` was still saving through direct browser Supabase writes instead of the new server route
- Save failures were not surfaced clearly in the modal

## Files Changed

- `src/app/api/admin/save-project/route.ts`
  - Switched role verification to `resolveUserRole(user)`
  - Added request payload validation for missing/invalid body fields
  - Added server-side `console.error` logging for save failures

- `src/components/admin-projects-tab.tsx`
  - Confirmed `credentials: "include"` is sent
  - Added browser `console.error` logging on save failure
  - Cleared stale `saveError` state when reopening the editor

- `src/components/ops-project-list.tsx`
  - Migrated project save to `POST /api/admin/save-project`
  - Added `credentials: "include"`
  - Added inline modal error display through `saveError`
  - Added browser `console.error` logging on save failure

## Final Build Status

- `npm run build` passes clean
