# Task 035 — Server-Side Data Routes (Whack-a-Mole Fix)

## Context

This app uses Microsoft SSO (Azure AD via Supabase) for admin, PM, lead, and ops_manager users.
After the OAuth callback, the browser-side Supabase auth token is **not reliably populated**.
Any UI component that queries Supabase using `createClient()` from `@/lib/supabase/client`
(the browser client) will silently return empty data for these users.

The fix is already proven: move all data reads to server-side API routes that:
1. Verify the session using `createClient()` from `@/lib/supabase/server`
2. Confirm the user's role
3. Read data using the service-role admin client (`createAdminClient` or `createClient` from `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY`)

This pattern was already applied to:
- `/api/admin/data` (admin + ops_manager tabs, project modal)
- `/api/pm/projects` (PM portal project list)

**This sprint completes the fix for every remaining page that still uses the browser client for reads.**

## Completed server-route reference implementations

### `/api/admin/data/route.ts`
- Verifies session server-side
- Confirms role is `admin` or `ops_manager` depending on section
- Uses service-role client for all reads
- Sections: `billing`, `projects`, `project`, `project-lookups`, `contacts`, `weekly-updates`, `feedback`, `users`, `project-weekly-updates`

### `/api/pm/projects/route.ts`
- Verifies session server-side
- Confirms role is `pm`, `lead`, or `ops_manager`
- Uses service-role client for all reads
- Returns assigned projects + current billing period

**Follow these exact patterns. Do not introduce new patterns.**

---

## Task 1 — Customer portal server route

**File:** `src/app/api/customer/data/route.ts` (new file)

Create a GET route that accepts a `section` query param. Verify session server-side. Confirm role is `customer`. Use service-role client for all reads.

Sections needed (match what `src/app/customer/page.tsx` currently queries from the browser):

- `section=projects`
  - Read `project_customer_contacts` filtered by `profile_id = user.id AND portal_access = true`
  - Read `projects` for those project IDs where `is_active = true`, joining `customers(name)`
  - Read `billing_periods` for those project IDs
  - Read `weekly_updates` for those project IDs (limit 100, ordered by `submitted_at desc`), including `id, project_id, pm_id, week_of, pct_complete, notes, blockers, submitted_at, crew_log, material_delivered, equipment_set, safety_incidents, inspections_tests, delays_impacts, other_remarks`
  - Read `project_assignments` for those project IDs where `role_on_project IN ('pm', 'lead')`, joining `profiles(full_name, email)` and `pm_directory(first_name, last_name, email, phone)`
  - Return: `{ projects, billingPeriods, weeklyUpdates, assignments }`

- `section=submit-feedback` — keep feedback submission as a POST to a separate route or inline in the page. **Do not move write operations into this GET route.**

**Then update `src/app/customer/page.tsx`:**
- Remove all `supabase.from(...)` browser client reads
- Replace the single data-load with `fetch('/api/customer/data?section=projects')`
- Keep feedback submission as a direct browser client INSERT (writes are fine on browser client for customers since they have a proper email/password session)
- Preserve all existing UI, charts, weekly update cards, project team section, feedback panel, and public status link — do not change any UI

---

## Task 2 — Admin analytics server route

**File:** `src/app/api/admin/data/route.ts` (extend existing file)

Add a new section `section=analytics` to the existing admin data route:
- Confirm role is `admin`
- Accept optional `startMonth` and `endMonth` query params (ISO date strings, e.g. `2026-01-01`)
- Read `billing_periods` filtered by `period_month >= startMonth AND period_month <= endMonth`, selecting `period_month, estimated_income_snapshot, pct_complete, prev_billed, actual_billed, project_id`
- Read `projects` where `is_active = true`, joining `customers(name)`, selecting `id, estimated_income, is_active`
- Return `{ billingPeriods, projects }`

**Then update `src/app/admin/analytics/page.tsx`:**
- Remove `createClient()` browser client import and all `.from(...)` browser reads
- Replace both reads with a single `fetch('/api/admin/data?section=analytics&startMonth=...&endMonth=...')` call
- Preserve all existing chart logic, Recharts components, Power BI embed, and UI — do not change any UI

---

## Task 3 — Admin users page server route

**File:** `src/app/api/admin/data/route.ts` (already has `section=users`)

The existing `section=users` already returns `profiles` via the server route.

**Update `src/app/admin/users/page.tsx`:**
- The page currently uses `supabase.from("profiles").select("*")` from the browser client
- Replace with `fetch('/api/admin/data?section=users')`
- Role update (`handleUpdateRole`) can remain as a browser client write — or move to a PATCH on a new `/api/admin/update-user-role` route if the browser write is also failing silently
- Check: does `supabase.from("profiles").update(...)` from the browser client work for admin users? If it silently fails, create a `PATCH /api/admin/update-user-role` route that accepts `{ userId, role }`, verifies admin session server-side, and updates using the service-role client
- Preserve all existing UI

---

## Task 4 — Audit remaining browser client reads

Search for all `"use client"` files that still call `.from(` on a browser Supabase client:

```bash
grep -rl "from(\"" src/app src/components | xargs grep -l "use client"
```

Also check for any `createClient()` (browser import) calls in client components that are used for reads:

```bash
grep -rl "lib/supabase/client" src/app src/components | xargs grep -l "use client"
```

For each file found that is NOT already fixed:
- If it reads data on mount or in a useEffect: move to a server API route using the established pattern
- If it only writes (INSERT/UPDATE): leave as-is (writes work fine on browser client)
- If it is an API route (in `src/app/api/`): leave as-is (these already run server-side)

Document each file you find and what you did with it.

---

## Task 5 — Final verification

1. Run `npm run build` — must pass clean with no type errors
2. Confirm no `"use client"` component file imports `@/lib/supabase/client` and calls `.from(...)` for a SELECT query
3. Commit and push each task individually to `origin/main` as you complete it

---

## Rules

- **Do not change any UI** — layout, styling, charts, cards, and behavior must be identical after the refactor
- **Do not refactor write operations** — INSERT/UPDATE from browser client is fine; only reads need server routes
- **Follow the existing route pattern exactly** — session verify → role check → service-role read → return JSON
- **Commit and push after each numbered task** — do not batch all tasks into one commit
- **Run `npm run build` after each task** before committing
- **Do not ask for permission** — proceed through all tasks autonomously

---

## Output

Create `codex/task-035-output.md` when done with:
- Which files were changed and what was moved
- Any browser client reads you found and left intentionally (writes)
- Final build status
- Any issues or limitations found
