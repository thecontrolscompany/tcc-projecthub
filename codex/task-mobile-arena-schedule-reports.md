# Task — Mobile Arena: Schedule Reviews & Change Orders in ProjectHub

## Background

Mobile Arena (project ID `824b2a05-eb00-4634-977d-c9216627a7be`, DB name `2025-005 - Mobile Arena`) has three standalone schedule impact review reports and a change order request that currently exist only as files in OneDrive. They are not in ProjectHub.

The goal is to surface them inside ProjectHub so they appear alongside the project's billing, change orders, and weekly updates — without rebuilding the HTML reports themselves (they already have full TCC branding and CSS).

---

## What exists today

**In the DB (change_orders table):**
- CO-001 — Thermostat Rough-Ins — $55,000 — approved

**Missing from DB:**
- CO-002 — Acceleration / Overtime — Controls Install — $99,174.90 — pending
- CO-003 — Additional Installers — Acceleration — $49,587.45 — pending
- Both submitted 2026-04-14 per the change order request document

**Schedule review files in OneDrive:**

| Date | Path |
|------|------|
| 2026-03-09 | `C:\Users\TimothyCollins\OneDrive - The Controls Company, LLC\Projects\Mobile Arena\Schedule\reports\2026-03-09-review\` |
| 2026-04-06 | `…\2026-04-06-review\` |
| 2026-04-27 | `…\2026-04-27-review\` |

Each folder contains `report.html` (full TCC-styled report, ~31KB) and `summary.md` (key findings narrative). Do NOT include `relocation-check` or `retry-test` folders.

---

## Scope of work

### Step 1 — Seed script (run once locally)

**File:** `scripts/seed-mobile-arena-reports.mjs`

This script does two things, then exits:

**A. Schedule reviews → `project_report_packets`**

For each of the 3 dated folders, upsert one row:

```js
{
  project_id: '824b2a05-eb00-4634-977d-c9216627a7be',
  report_type: 'mobile_arena_schedule_review',
  packet_date: '2026-03-09',        // or 2026-04-06 / 2026-04-27
  title: 'Schedule Impact Review — Mobile Arena 2026-03-09',
  body: { html_content: '<full contents of report.html>' },
  summary_markdown: '<full contents of summary.md>',
  updated_at: new Date().toISOString(),
}
```

Use `onConflict: 'project_id,report_type,packet_date'` so the script is safe to re-run.

**B. Change orders → `change_orders`**

Insert (skip on conflict by co_number + project_id):

```js
[
  {
    project_id: '824b2a05-eb00-4634-977d-c9216627a7be',
    co_number: 'CO-002',
    title: 'Acceleration / Overtime — Controls Install',
    amount: 99174.90,
    status: 'pending',
    submitted_date: '2026-04-14',
  },
  {
    project_id: '824b2a05-eb00-4634-977d-c9216627a7be',
    co_number: 'CO-003',
    title: 'Additional Installers — Acceleration',
    amount: 49587.45,
    status: 'pending',
    submitted_date: '2026-04-14',
  },
]
```

Use the service role key from `.env.local`. Print a confirmation summary when done.

---

### Step 2 — Extend the report-packets API

**File:** `src/app/api/pm/report-packets/route.ts`

The existing GET handler always returns only the most recent packet (`.limit(1)`). Add a `list=true` query param:

- **`list=true`:** return all packets for the `projectId` + `reportType`, selecting only `id, packet_date, title` (no body — body can be large), ordered by `packet_date` descending. Return `{ packets: [...] }`.
- **No `list` param:** existing behavior unchanged — returns `{ packet: ... }` for the most recent.

---

### Step 3 — Report viewer page

**File:** `src/app/reports/project/mobile-arena-schedule/page.tsx`

Use `src/app/reports/project/eglin-1416/page.tsx` as the structural template for auth, access control, and `searchParams` handling. Do NOT copy the Eglin HTML layout — this page renders the stored HTML verbatim.

**Search params:** `?projectId=<uuid>&packetDate=<YYYY-MM-DD>`

**Listing mode** (packetDate absent):
- Call the `list=true` API and render a simple card list
- Each card: formatted date (e.g. "April 27, 2026"), title, "View Report →" link to `?projectId=...&packetDate=...`
- Minimal TCC-branded header (matching style from existing reports)
- No print button in listing mode

**Viewer mode** (packetDate present):
- Fetch the single packet (`report_type = 'mobile_arena_schedule_review'`, `packet_date = packetDate`)
- Render `body.html_content` via `dangerouslySetInnerHTML` inside a thin wrapper `<div>`
- Add `PrintButton` at top-right (reuse from `src/app/reports/weekly-update/[id]/PrintButton`)
- The stored HTML already has all its own CSS — do not add extra styling around it

Access control (identical to Eglin page):
- `admin` and `ops_manager`: always allowed
- `pm` and `lead`: allowed only if assigned to the project via `project_assignments`
- All other roles: `redirect('/login')`
- Unauthenticated: `redirect('/login')`

---

### Step 4 — Project modal button

**File:** `src/app/pm/page.tsx`

Add alongside `isEglin1416Project` (line ~105):

```ts
function isMobileArenaProject(projectName: string) {
  const n = projectName.toLowerCase();
  return n.includes("mobile") && n.includes("arena");
}
```

Add alongside `showEglinReportBuilder` (line ~886):

```ts
const showScheduleReviews = isMobileArenaProject(project.name);
```

Add button in the same `<div className="mt-3">` block as the Eglin button, with identical styling:

```tsx
{showScheduleReviews && (
  <a
    href={`/reports/project/mobile-arena-schedule?projectId=${encodeURIComponent(project.id)}`}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center rounded-xl border border-brand-primary/20 bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/20"
  >
    Schedule Reviews
  </a>
)}
```

---

## Files to create / modify

| | File |
|---|---|
| CREATE | `scripts/seed-mobile-arena-reports.mjs` |
| MODIFY | `src/app/api/pm/report-packets/route.ts` |
| CREATE | `src/app/reports/project/mobile-arena-schedule/page.tsx` |
| MODIFY | `src/app/pm/page.tsx` |

**Reuse (do not reimplement):**
- `src/app/reports/weekly-update/[id]/PrintButton` — print button
- `src/lib/supabase/server` `createClient` — server-side Supabase client
- `createAdminClient` from `@supabase/supabase-js` with env vars — for DB writes and bypassing RLS
- `src/lib/auth/resolve-user-role` — role resolution
- `src/lib/utils/normalize` `normalizeSingle` — unwrap Supabase FK joins

---

## Verification checklist

1. `node scripts/seed-mobile-arena-reports.mjs` — output confirms 3 packets upserted + CO-002 and CO-003 inserted
2. Query DB: `select co_number, amount, status from change_orders where project_id = '824b2a05...' order by co_number` — should show CO-001, CO-002, CO-003
3. `npm run build` — zero errors
4. Open Mobile Arena in the PM view — "Schedule Reviews" button appears below the project name
5. Click it — listing page shows 3 dated cards (Mar 9, Apr 6, Apr 27)
6. Click "Apr 27" — viewer page renders the HTML report; Print button works
7. Open the change orders accordion on the project modal — CO-001, CO-002, CO-003 all visible with correct amounts

---

## Notes

- CO-002 and CO-003 are entered as `pending`. Update their status to `approved_email` in the UI once verbal/email approval is confirmed.
- `relocation-check` and `retry-test` folders in the reports directory are scratch runs — do not seed them.
- The seed script reads from a hardcoded absolute OneDrive path. This is intentional — it is a one-time local import, not a server-side feature.
