## Files created or modified
- `.env.local`
- `src/app/admin/layout.tsx`
- `src/app/pm/layout.tsx`
- `src/app/admin/page.tsx`
- `src/components/billing-table.tsx`
- `src/app/pm/page.tsx`
- `src/app/customer/page.tsx`
- `src/app/login/page.tsx`
- `src/app/preview/page.tsx`

## Part A - .env.local created?
- yes
- added the exact placeholder values requested so Supabase client initialization no longer throws on import

## Part B - null handling added to which layouts/pages?
- `src/app/admin/layout.tsx`: wrapped profile/user lookup in `try/catch` and fell back to `admin` / `dev@localhost`
- `src/app/pm/layout.tsx`: wrapped profile/user lookup in `try/catch` and fell back to `pm` / `dev@localhost`
- `src/app/admin/page.tsx`: wrapped Supabase reads in `try/catch` and falls back to empty arrays / empty-state rendering
- `src/app/pm/page.tsx`: wrapped auth/project/update Supabase reads in `try/catch` and falls back to empty arrays
- `src/app/customer/page.tsx`: wrapped auth/customer/project/update Supabase reads in `try/catch` and falls back to empty arrays

## Part C - remaining token replacements
- `src/app/admin/page.tsx`: 10
- `src/components/billing-table.tsx`: 3
- `src/app/pm/page.tsx`: 18
- `src/app/customer/page.tsx`: 12
- `src/app/login/page.tsx`: 2

## Part D - /preview page created?
- yes

## Build result
- clean
- existing warning only: Next.js reports that the `middleware` file convention is deprecated in favor of `proxy`

## Dev server start result
- existing dev server already running on `http://localhost:3000`
- a fresh `npm run dev` invocation initialized successfully, detected port `3000` was already in use by this same repo, briefly used `3001`, then exited with the standard "another next dev server is already running" notice

## Blockers or questions
- none
