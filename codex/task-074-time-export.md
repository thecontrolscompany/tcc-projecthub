# Task 074 — Project Time Export

## Purpose

Tool to export all QuickBooks Time timesheet entries for a selected project
and date range to an Excel file. Lives under the `/time` module. Data comes
from the already-synced `qb_time_timesheets` table joined through
`project_qb_time_mappings`.

---

## New files to create

### 1. `src/app/api/time/export/route.ts`

GET endpoint. Requires `admin` or `ops_manager` role — return 403 otherwise.

**Query params:**
- `projectId` (required) — portal project UUID
- `start` (required) — ISO date string `YYYY-MM-DD`
- `end` (required) — ISO date string `YYYY-MM-DD`

**Logic:**
1. Use service-role Supabase client.
2. Look up the QB Time jobcode(s) mapped to this project:
   ```ts
   const { data: mappings } = await admin
     .from("project_qb_time_mappings")
     .select("qb_jobcode_id")
     .eq("project_id", projectId)
     .eq("is_active", true);
   ```
   If no mappings found, return `{ warning: "No QB Time jobcode mapped to this project." }` with 200.

3. Fetch timesheets for those jobcodes within the date range:
   ```ts
   const jobcodeIds = mappings.map((m) => m.qb_jobcode_id);
   const { data: sheets } = await admin
     .from("qb_time_timesheets")
     .select("timesheet_date, duration_seconds, notes, qb_user_id, state")
     .in("qb_jobcode_id", jobcodeIds)
     .gte("timesheet_date", start)
     .lte("timesheet_date", end)
     .neq("state", "deleted")
     .order("timesheet_date", { ascending: true });
   ```

4. Look up employee names for all user IDs in the result:
   ```ts
   const userIds = [...new Set(sheets.map((s) => s.qb_user_id))];
   const { data: users } = await admin
     .from("qb_time_users")
     .select("qb_user_id, display_name")
     .in("qb_user_id", userIds);
   const nameMap = Object.fromEntries(users.map((u) => [u.qb_user_id, u.display_name]));
   ```

5. Look up project name:
   ```ts
   const { data: project } = await admin
     .from("projects")
     .select("name, job_number")
     .eq("id", projectId)
     .maybeSingle();
   ```

6. Build the Excel workbook using ExcelJS:
   - Worksheet name: `Time Export`
   - Header row (bold, light teal fill `#eef8f6`):
     `Date | Employee | Hours | Notes`
   - Data rows (one per timesheet entry):
     - Date: `timesheet_date` formatted as `MM/DD/YYYY`
     - Employee: `nameMap[qb_user_id] ?? "Unknown"`
     - Hours: `duration_seconds / 3600` rounded to 2 decimal places
     - Notes: `notes ?? ""`
   - After all data rows, add a blank row then a **Total** row:
     - Col A: "Total Hours"
     - Col C: sum of all hours (bold)
   - Column widths: Date=14, Employee=28, Hours=10, Notes=50
   - Freeze the header row

7. Return the workbook as a downloadable `.xlsx`:
   ```ts
   const buffer = await workbook.xlsx.writeBuffer();
   const filename = `time-export-${project?.job_number ?? projectId}-${start}-to-${end}.xlsx`;
   return new Response(buffer, {
     headers: {
       "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
       "Content-Disposition": `attachment; filename="${filename}"`,
     },
   });
   ```

---

### 2. `src/app/time/export/page.tsx`

Client component (`"use client"`). Requires `admin` or `ops_manager` role —
on mount check via `supabase.auth.getUser()` + profiles; redirect to `/login`
if not authorized.

The page is rendered inside the existing `/time` layout
(`src/app/time/layout.tsx`) which provides the AppShell automatically.

#### UI

```
┌────────────────────────────────────────────────┐
│  Project Time Export                           │
│  Export QuickBooks Time entries for a project  │
│  to Excel.                                     │
│                                                │
│  Project    [dropdown — all projects]          │
│  Start Date [date input]                       │
│  End Date   [date input]                       │
│                                                │
│  [Export to Excel]                             │
│                                                │
│  (warning or error banner if applicable)       │
└────────────────────────────────────────────────┘
```

- Load all projects on mount via a Supabase select from `projects` ordered
  by `name`.
- Project dropdown: `<option value={p.id}>{p.name}{p.job_number ? ` — ${p.job_number}` : ""}</option>`
- Default `start` = first day of current month, `end` = today.
- "Export to Excel" button:
  - Disable if any field is missing.
  - Show a loading spinner while fetching.
  - On success: trigger browser download via a temporary `<a>` element pointing
    to the blob URL.
  - On warning or error: show a banner.

#### Styling

Use the same dark theme token classes as other time module pages:
`rounded-2xl border border-border-default bg-surface-raised`, `text-text-primary`, etc.
Form inputs: `rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary`.

---

## Link from Time module home

**File:** `src/components/time/time-module.tsx`

Find the `ActionCard` grid in `TimeModuleHome` (the section with Clock,
Employees, Projects cards). Add a fourth card:

```tsx
<ActionCard href="/time/export" title="Export" description="Download QB Time entries for a project to Excel." />
```

---

## Acceptance criteria

- `/time/export` renders inside the time module shell; non-admin/ops users
  redirect to `/login`.
- Selecting a project + date range and clicking Export downloads an `.xlsx`
  file named `time-export-{job_number}-{start}-to-{end}.xlsx`.
- The spreadsheet has one row per timesheet entry with Date, Employee, Hours,
  Notes columns plus a Total Hours row at the bottom.
- Projects with no QB Time jobcode mapping show a warning banner instead of
  downloading an empty file.
- Entries with `state = "deleted"` are excluded.

## When done

Run `npm run build` to confirm no type errors, then commit all new and modified
files and push to `main`.
