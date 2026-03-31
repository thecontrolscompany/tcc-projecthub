## Files modified
- `src/app/admin/analytics/page.tsx`
- `src/app/admin/users/page.tsx`
- `codex/task-012-output.md`

## Redundant headers/nav removed
- `src/app/admin/analytics/page.tsx`: removed the page-level header bar and `/admin` back link so the page starts directly with the Analytics heading inside AppShell
- `src/app/admin/users/page.tsx`: removed the page-level header bar and `/admin` back link so the page starts directly with the User Management heading inside AppShell

## Token replacements made
- `src/app/admin/analytics/page.tsx`: about 40 token/style replacements across page surfaces, text, borders, chart accents, and Recharts color values
- `src/app/admin/users/page.tsx`: about 35 token/style replacements across page surfaces, table styles, form controls, buttons, error styles, and role badges

## Build result
- clean

## Blockers or questions
- none
