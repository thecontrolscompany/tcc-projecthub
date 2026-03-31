## Files created or modified
- `src/components/sidebar-nav.tsx`
- `src/components/app-shell.tsx`
- `src/app/admin/layout.tsx`
- `src/app/pm/layout.tsx`
- `codex/task-003-output.md`

## Changes made
- Created `src/components/sidebar-nav.tsx` with role-filtered navigation, active/inactive link states, logo fallback, user email display, and sign-out behavior
- Created `src/components/app-shell.tsx` with fixed sidebar, fixed top header, theme toggle, and main content wrapper
- Updated `src/app/admin/layout.tsx` to fetch the current user/profile server-side and wrap children with `AppShell`
- Updated `src/app/pm/layout.tsx` to fetch the current user/profile server-side and wrap children with `AppShell`

## Build result
- clean
- Existing warning during build: `The "middleware" file convention is deprecated. Please use "proxy" instead.`

## Blockers or questions
- none
