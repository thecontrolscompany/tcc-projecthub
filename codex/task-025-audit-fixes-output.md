# Task 025 Output

## What Changed

- Fixed billing table optimistic saves in `src/components/billing-table.tsx` so rows only update locally after Supabase confirms the write, with a visible error banner if a save fails.
- Extracted role-to-home-route logic into `src/lib/auth/role-routes.ts` and reused it from both middleware and the auth callback.
- Hardened `billing`, `estimating`, `projects`, and `quotes` layouts to log auth/session load failures and fall back to `customer` instead of `admin`.
- Added Zod validation to `src/app/api/admin/create-user/route.ts` for email, password, full name, and role, returning HTTP 400 with a validation message on bad input.

## Verification

- Ran `npm run build` successfully after the fixes.
