# Task 027 Output

## What Changed

- Added admin-only `View as` role impersonation in `src/components/app-shell.tsx`.
- The selected preview role is stored in `sessionStorage` so it persists during the browser session but clears when the session ends.
- When impersonating, the header shows a persistent warning banner with the active preview role and an `Exit` control.
- Updated `src/components/sidebar-nav.tsx` to accept an override role so the sidebar nav reflects the impersonated role instead of the real admin role.
- Preview navigation uses the shared role home mapping, so PM/Lead go to `/pm`, Ops Manager to `/ops`, Installer to `/installer`, and Customer to `/customer`.

## Verification

- Ran `npm run build` successfully after implementation.
