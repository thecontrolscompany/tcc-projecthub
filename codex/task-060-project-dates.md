# Task 060 — Project Dates: Start Date & Scheduled Completion

## Context

The `projects` table has no date fields beyond `created_at` and `completed_at`.
Neither PMs nor customers can see when a project is scheduled to finish.
This is the most common question from both audiences.

This task adds `start_date` and `scheduled_completion` to the projects table,
surfaces them in the admin project modal, and displays them on both portals.

---

## 1. Migration — `supabase/migrations/032_project_dates.sql`

```sql
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS scheduled_completion date;
```

Run with:
```bash
npx supabase db push
```

---

## 2. Admin project modal — `src/components/project-modal.tsx`

### 2a. Add to `ProjectFormValues` type (around line 42)

```ts
startDate: string;
scheduledCompletion: string;
```

### 2b. Add to `EMPTY_PROJECT_FORM` (around line 72)

```ts
startDate: "",
scheduledCompletion: "",
```

### 2c. Add form fields to the modal UI

Find the section with `siteAddress` / `generalContractor` fields. Add after the
`siteAddress` field and before `generalContractor`:

```tsx
<div className="grid gap-3 sm:grid-cols-2">
  <div>
    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
      Start Date
    </label>
    <input
      type="date"
      className={inputClassName}
      value={values.startDate}
      onChange={(e) => onChange("startDate", e.target.value)}
    />
  </div>
  <div>
    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
      Scheduled Completion
    </label>
    <input
      type="date"
      className={inputClassName}
      value={values.scheduledCompletion}
      onChange={(e) => onChange("scheduledCompletion", e.target.value)}
    />
  </div>
</div>
```

### 2d. Handle incoming project data

When the modal is opened for an existing project, the form is pre-populated from the
project record. Find the place where project fields are mapped into the form values
(the edit case). Add:

```ts
startDate: project.start_date ?? "",
scheduledCompletion: project.scheduled_completion ?? "",
```

Look for where `generalContractor: project.general_contractor ?? ""` is set — add
these two fields in the same block.

---

## 3. Save-project API — `src/app/api/admin/save-project/route.ts`

### 3a. Add to formValues type (around line 48)

```ts
startDate: string;
scheduledCompletion: string;
```

### 3b. Add to project payload (around line 110)

```ts
start_date: formValues.startDate || null,
scheduled_completion: formValues.scheduledCompletion || null,
```

---

## 4. PM portal — `src/app/pm/page.tsx`

### 4a. Include dates in the project data fetched from the API

In the section where the PM portal fetches project data
(`/api/pm/projects?section=project-data`), the project object already comes from
`project_assignments → projects(...)`. Add `start_date` and `scheduled_completion`
to the fields selected in `src/app/api/pm/projects/route.ts`:

In the `project:projects(...)` select block, add:
```
start_date,
scheduled_completion,
```

Also update the TypeScript type for the project shape in that file to include:
```ts
start_date: string | null;
scheduled_completion: string | null;
```

### 4b. Display on PM portal Overview tab

In the Overview tab content block, find the stats grid (the `<div className="grid ...">` 
with stats like % complete, last update, etc.). Add a "Project Dates" row below it:

```tsx
{(project.start_date || project.scheduled_completion) && (
  <div className="rounded-2xl border border-border-default bg-surface-raised px-4 py-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">
      Project Dates
    </p>
    <div className="flex flex-wrap gap-6 text-sm">
      {project.start_date && (
        <div>
          <p className="text-xs text-text-tertiary">Start Date</p>
          <p className="font-medium text-text-primary">
            {format(new Date(project.start_date), "MMM d, yyyy")}
          </p>
        </div>
      )}
      {project.scheduled_completion && (
        <div>
          <p className="text-xs text-text-tertiary">Scheduled Completion</p>
          <p className={[
            "font-medium",
            new Date(project.scheduled_completion) < new Date()
              ? "text-status-danger"
              : "text-text-primary",
          ].join(" ")}>
            {format(new Date(project.scheduled_completion), "MMM d, yyyy")}
            {new Date(project.scheduled_completion) < new Date() && (
              <span className="ml-1.5 text-xs font-semibold text-status-danger">(Overdue)</span>
            )}
          </p>
        </div>
      )}
    </div>
  </div>
)}
```

Also update the project data interface in `page.tsx` to include the new fields:
```ts
start_date: string | null;
scheduled_completion: string | null;
```

### 4c. Red alert when no schedule is set

In the Overview tab, add a warning banner when `scheduled_completion` is null.
Place it at the TOP of the Overview tab content, before the stats grid:

```tsx
{!project.scheduled_completion && (
  <div className="flex items-center gap-3 rounded-xl border border-status-danger/30 bg-status-danger/5 px-4 py-3">
    <svg className="h-4 w-4 shrink-0 text-status-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
    <p className="text-sm font-medium text-status-danger">
      Schedule not received — no completion date on file for this project.
    </p>
  </div>
)}
```

---

## 5. Customer portal — `src/app/customer/page.tsx`

### 5a. Fetch from API

In `src/app/api/customer/data/route.ts`, the projects query selects specific fields.
Add `start_date` and `scheduled_completion` to the select:

```ts
adminClient
  .from("projects")
  .select("id, name, estimated_income, job_number, site_address, general_contractor, start_date, scheduled_completion, customer:customers(name)")
```

### 5b. Update `CustomerProject` interface

```ts
start_date: string | null;
scheduled_completion: string | null;
```

### 5c. Map in `loadProjects`

In the `combined` map:
```ts
start_date: project.start_date ?? null,
scheduled_completion: project.scheduled_completion ?? null,
```

### 5d. Display in ProjectDetail header

In the project header section (the card with the project name and progress bar),
after the `general_contractor` line, add:

```tsx
{project.scheduled_completion && (
  <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
    <CalendarIcon />
    <span>
      Scheduled completion:{" "}
      <span className={
        new Date(project.scheduled_completion) < new Date()
          ? "font-semibold text-red-600"
          : "font-medium"
      }>
        {format(new Date(project.scheduled_completion), "MMMM d, yyyy")}
      </span>
    </span>
  </div>
)}
```

Add a simple `CalendarIcon` SVG component near the other icon components in the file:

```tsx
function CalendarIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}
```

---

## Files to change

| File | What changes |
|------|-------------|
| `supabase/migrations/032_project_dates.sql` | New — adds start_date and scheduled_completion columns |
| `src/components/project-modal.tsx` | Two date fields in form values, empty form, and UI |
| `src/app/api/admin/save-project/route.ts` | Add date fields to formValues type and payload |
| `src/app/api/pm/projects/route.ts` | Add date fields to project select |
| `src/app/pm/page.tsx` | Add dates to project interface, display on Overview tab |
| `src/app/api/customer/data/route.ts` | Add date fields to projects select |
| `src/app/customer/page.tsx` | Add to interface, map in loadProjects, display in ProjectDetail |

---

## Acceptance criteria

- [ ] Migration runs clean; columns exist on projects table
- [ ] Admin can set start date and scheduled completion when creating or editing a project
- [ ] Dates appear on PM portal Overview tab; overdue completion shows in red with "(Overdue)" label
- [ ] Scheduled completion appears in customer portal project header with overdue styling
- [ ] PM Overview tab shows a red "Schedule not received" alert when scheduled_completion is null
- [ ] Alert disappears once admin sets a scheduled completion date
- [ ] Fields are optional — projects with no dates set show nothing on customer portal (no empty placeholders)
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `Add start date and scheduled completion to projects`
Push to main.
