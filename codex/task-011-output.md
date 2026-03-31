## Files created or modified
- `src/app/page.tsx`
- `src/app/quotes/layout.tsx`
- `src/app/quotes/page.tsx`
- `src/app/estimating/layout.tsx`
- `src/app/estimating/page.tsx`
- `src/app/projects/layout.tsx`
- `src/app/projects/page.tsx`
- `src/app/projects/projects-list.tsx`
- `src/app/billing/layout.tsx`
- `src/app/billing/page.tsx`
- `codex/task-011-output.md`

## Root page behavior
- Authenticated users are redirected by role to their home route: admin -> `/admin`, pm -> `/pm`, estimator -> `/estimating`, billing -> `/billing`, accounting/executive -> `/admin/analytics`, customer -> `/customer`
- Unauthenticated users, unknown roles, and error cases redirect to `/login`

## Routes created
- `/quotes` - stub
- `/estimating` - stub with current estimating tool link
- `/projects` - real data
- `/billing` - stub with link to current admin billing

## Build result
- clean

## Blockers or questions
- none
