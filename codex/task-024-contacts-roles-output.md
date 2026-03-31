# Task 024 Output

## What Changed

- Updated the billing query in `src/app/admin/page.tsx` to join `pm_directory` and fall back to the assigned contact name/email when no linked `profiles` row exists yet.
- Renamed the remaining Contacts tab UI labels from `PM` to `Contact`.
- Added an internal-contact role dropdown in the Contacts edit modal for unlinked `@controlsco.net` users.
- Saving a contact now updates an existing `profiles` row by email when present, or stores the preassigned role in `pm_directory.intended_role` when the user has not signed in yet.
- Extended `src/app/auth/callback/route.ts` so first sign-in auto-linking also applies `pm_directory.intended_role` to a default `customer` profile, then clears the stored intended role.

## Migration

- Added `supabase/migrations/007_pm_directory_intended_role.sql`.
- This migration was not run and should be applied manually by Timothy.

## Verification

- Ran `npm run build` successfully after implementation.
