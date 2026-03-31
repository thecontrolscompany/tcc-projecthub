# Task 014 — Project Management: New Project, Edit Project, Billed/Paid Status

## Context

Admins need to create new projects, edit existing project details, and mark projects
as "Billed in Full" and "Paid in Full" — which moves them from Active to Completed.

## Read before starting

- `src/app/admin/page.tsx` (Projects tab — where New Project button goes)
- `src/app/projects/page.tsx` and `src/app/projects/projects-list.tsx`
- `src/types/database.ts` (Project type)
- `supabase/migrations/001_initial_schema.sql` (current schema)

---

## Part A — Database migration

Create `supabase/migrations/004_project_status_fields.sql`:

```sql
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS billed_in_full BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_in_full BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- When both billed_in_full and paid_in_full are true, is_active becomes false
-- This is enforced in the UI, not as a DB trigger
```

**Timothy must run this migration manually in Supabase SQL editor.**
Codex should create the file but not run it.

---

## Part B — Update TypeScript types

In `src/types/database.ts`, add to the `Project` interface:

```ts
billed_in_full: boolean;
paid_in_full: boolean;
completed_at: string | null;
```

---

## Part C — New Project button and form (Admin Projects tab)

In `src/app/admin/page.tsx`, on the Projects tab, add a **New Project** button
in the top-right of the projects section. Clicking it opens a modal form.

### New Project form fields:

**Required:**
- Project Name (text input)
- Customer (dropdown — populated from `customers` table, plus "Add new customer" option that reveals a text input)
- Estimated Income (number input, currency formatted)

**Optional:**
- Notes (textarea)

**Job number:**
- Auto-assign the next sequential job number in format `YYYY-NNN`
  where YYYY = current year and NNN = next available 3-digit number for that year.
- Query: `SELECT job_number FROM projects WHERE job_number LIKE 'YYYY-%' ORDER BY job_number DESC LIMIT 1`
  then increment the NNN portion.
- Display the auto-assigned job number in the form as read-only so admin can see it.

**On submit:**
- Insert into `projects` table
- Insert a `billing_periods` row for the current month with `estimated_income_snapshot` = entered value
- Close modal, refresh projects list

### Modal pattern:
Use a simple overlay modal with backdrop. No external library needed.
Use semantic token classes throughout (`bg-surface-overlay`, `border-border-default`, etc.)

---

## Part D — Edit Project

Each project row in the Projects tab should have an **Edit** button (pencil icon or "Edit" text link).
Clicking opens the same modal pre-populated with the project's current values.

Editable fields:
- Project Name
- Customer (dropdown)
- Estimated Income
- Billed in Full (checkbox)
- Paid in Full (checkbox)
- Notes

**Billed in Full / Paid in Full logic:**
- When "Billed in Full" is checked → set `billed_in_full = true`
- When "Paid in Full" is checked → set `paid_in_full = true`
- When BOTH are checked → also set `is_active = false` and `completed_at = now()`
- If either is unchecked → set `is_active = true`, clear `completed_at`

On save:
- Update `projects` table
- If `estimated_income` changed, also update `billing_periods.estimated_income_snapshot`
  for all billing periods belonging to this project where `actual_billed` is null

---

## Part E — Projects list display

Update `src/app/projects/projects-list.tsx` to show Active and Completed sections:
- Active: `is_active = true`
- Completed: `is_active = false`

Add "Billed in Full" and "Paid in Full" badge columns to the table.
Use:
- Billed in Full: `bg-status-success/10 text-status-success` badge when true
- Paid in Full: `bg-brand-primary/10 text-brand-primary` badge when true

Also update `src/app/projects/page.tsx` to fetch the new fields:
```ts
.select("id, name, job_number, is_active, migration_status, sharepoint_folder, created_at, billed_in_full, paid_in_full, completed_at")
```

---

## Constraints

- Do not modify `.env.local`
- Do not run the SQL migration — create the file only, Timothy runs it manually
- Run `npm run build` after changes, fix only new errors
- Mechanical only — do not restructure existing components beyond what's needed

---

## Output

Create `codex/task-014-output.md`:

```
## Files modified
- list each

## Migration file created
- filename

## New Project form fields implemented
- list required and optional fields

## Edit Project implemented
- yes/no + what fields

## Billed/Paid logic
- describe behavior

## Build result
- "clean" or paste new errors

## Blockers or questions
- any ambiguity, or "none"
```
