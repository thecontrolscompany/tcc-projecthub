# Task 040 — Weekly Report: Draft / Save / Submit + Edit with Audit Log

## Overview

PMs need to be able to work on a weekly report throughout the week, saving
as they go, and only submit when it is complete. After submission, an Edit
button lets them correct mistakes — but every edit is stamped with who
edited and when.

---

## 1 — Database migration

Create `supabase/migrations/021_weekly_update_draft_edit.sql`:

```sql
-- 1. Add status column to weekly_updates
ALTER TABLE weekly_updates
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted'
  CHECK (status IN ('draft', 'submitted'));

-- 2. Mark all existing rows as submitted (they were submitted at time of insert)
UPDATE weekly_updates SET status = 'submitted' WHERE status IS NULL;

-- 3. Edit audit log
CREATE TABLE IF NOT EXISTS weekly_update_edits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_update_id uuid NOT NULL REFERENCES weekly_updates(id) ON DELETE CASCADE,
  edited_by_profile_id uuid REFERENCES profiles(id),
  edited_at       timestamptz NOT NULL DEFAULT now(),
  editor_name     text,
  note            text
);

CREATE INDEX IF NOT EXISTS idx_weekly_update_edits_update_id
  ON weekly_update_edits(weekly_update_id);
```

Run this in the Supabase SQL editor before testing.

---

## 2 — Update TypeScript types

In `src/types/database.ts`, add `status` and the new table:

```ts
// On WeeklyUpdate type, add:
status: 'draft' | 'submitted';

// New type:
export type WeeklyUpdateEdit = {
  id: string;
  weekly_update_id: string;
  edited_by_profile_id: string | null;
  edited_at: string;
  editor_name: string | null;
  note: string | null;
};
```

---

## 3 — New API route: `src/app/api/pm/weekly-update/route.ts`

All DB writes from the PM portal must use the service-role admin client
(browser Supabase client silently fails with Microsoft SSO sessions).

### POST — create draft or submit new

Body:
```ts
{
  projectId: string;
  weekOf: string;
  status: 'draft' | 'submitted';
  pctComplete: number;          // 0–1 decimal
  pocSnapshot: object | null;
  crewLog: CrewLogEntry[];
  notes: string | null;
  blockers: string | null;
  materialDelivered: string | null;
  equipmentSet: string | null;
  safetyIncidents: string | null;
  inspectionsTests: string | null;
  delaysImpacts: string | null;
  otherRemarks: string | null;
  pocUpdates: Array<{ id: string; pct_complete: number }>;  // write back to poc_line_items
  billingPeriodId: string | null;  // update billing_periods.pct_complete if provided
}
```

Logic:
1. Auth check — must be signed in.
2. Check if a `weekly_updates` row already exists for `(project_id, week_of)`.
   - If it exists and `status = 'submitted'`, return 409: "A submitted report already exists for this week."
   - If it exists and `status = 'draft'`, update it (same as PATCH below).
   - If it does not exist, insert it with `submitted_at = now()` if `status = 'submitted'`, else `submitted_at = null`.
3. Write `poc_line_items` updates.
4. Write `billing_periods.pct_complete` if `billingPeriodId` provided and `status = 'submitted'`.
5. Return `{ update: { id, status, week_of } }`.

### PATCH — save draft updates or submit existing draft

Body: same shape as POST plus `updateId: string`.

Logic:
1. Auth check.
2. Fetch the existing row. If `status = 'submitted'`, treat this as an
   **admin edit** — insert a row into `weekly_update_edits` recording
   `edited_by_profile_id`, `editor_name` (from profiles.full_name),
   `edited_at = now()`.
3. Update the `weekly_updates` row. If transitioning to `'submitted'`,
   set `submitted_at = now()`.
4. Write `poc_line_items` and `billing_periods` same as POST.
5. Return `{ update: { id, status, week_of }, editLogged: boolean }`.

---

## 4 — Update `src/app/api/pm/projects/route.ts`

In the `section === "project-data"` branch, the weekly updates query
currently returns all updates. Add `status` to the select fields:

```ts
.select("id, week_of, pct_complete, notes, blockers, crew_log, material_delivered, equipment_set, safety_incidents, inspections_tests, delays_impacts, other_remarks, imported_from, status, submitted_at")
```

Also return edit history for the current week's draft/submitted report.
After fetching updates, if there is a draft or most-recent submitted for
this project, fetch its edits:

```ts
const latestUpdate = updates[0] ?? null;
let editHistory: WeeklyUpdateEdit[] = [];
if (latestUpdate) {
  const { data: edits } = await adminClient
    .from("weekly_update_edits")
    .select("id, edited_at, editor_name, note")
    .eq("weekly_update_id", latestUpdate.id)
    .order("edited_at", { ascending: false });
  editHistory = edits ?? [];
}
// return { updates, pocItems, editHistory }
```

---

## 5 — Update `src/app/api/customer/data/route.ts`

Filter `weekly_updates` to only return submitted reports to customers:

```ts
.eq("status", "submitted")
```

Add this after `.in("project_id", projectIds)` in the weekly_updates query.

---

## 6 — Update `src/app/pm/page.tsx` — UpdateForm component

### Key behavioral changes

**On load** (`useEffect` that calls `project-data`):
- Check if the most recent update for this project has `week_of === thisSaturday`
  AND `status === 'draft'`.
- If yes, pre-populate all form fields from that draft and set
  `draftUpdateId` state to the draft's `id`. Show a banner:
  `"You have a saved draft for this week. Pick up where you left off."`
- If the most recent update has `week_of === thisSaturday` AND
  `status === 'submitted'`, set `submittedUpdateId` and render the
  read-only submitted view with an Edit button (see below).

**New state variables** (add to UpdateForm):
```ts
const [draftUpdateId, setDraftUpdateId] = useState<string | null>(null);
const [submittedUpdateId, setSubmittedUpdateId] = useState<string | null>(null);
const [isEditing, setIsEditing] = useState(false);
const [editHistory, setEditHistory] = useState<Array<{ id: string; edited_at: string; editor_name: string | null; note: string | null }>>([]);
const [editNote, setEditNote] = useState("");
```

**Remove the browser Supabase client writes** from `handleSubmit`. Replace
all `supabase.from(...)` calls with calls to the new API route.

### Save Draft button

Add a "Save Draft" button alongside the existing submit button:

```tsx
<div className="flex gap-3">
  <button
    type="button"
    onClick={() => void handleSaveDraft()}
    disabled={saving}
    className="flex-1 rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-surface-raised disabled:opacity-50"
  >
    {saving === 'draft' ? "Saving..." : "Save Draft"}
  </button>
  <button
    type="submit"
    disabled={!!saving}
    className="flex-1 rounded-xl bg-status-success px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:opacity-90 disabled:opacity-50"
  >
    {saving === 'submit' ? "Submitting..." : "Submit Weekly Update"}
  </button>
</div>
```

Change `saving` state from `boolean` to `'draft' | 'submit' | false`.

### handleSaveDraft

Same as handleSubmit but posts `status: 'draft'`. Does NOT update
`billing_periods` (only submitted reports affect billing). Returns without
navigating back — stays on the form with a toast: `"Draft saved."`.

### handleSubmit

Posts `status: 'submitted'`. On success, navigates back to the project list
as before.

### Submitted view + Edit button

When `submittedUpdateId` is set and `!isEditing`, show a read-only summary
card instead of the form, with:
- All field values displayed (not editable)
- `<ViewReportLink updateId={submittedUpdateId} />`
- An **Edit** button: `onClick={() => setIsEditing(true)}`

When `isEditing` is true, render the full form pre-populated, with:
- A text field for `editNote` labeled "Reason for edit (optional)"
- A **Save Edit** button (calls PATCH with `status: 'submitted'`,
  includes `editNote`)
- A **Cancel** button: `onClick={() => setIsEditing(false)}`

### Edit history

Below the form (or submitted card), if `editHistory.length > 0`, show:

```tsx
<div className="space-y-2">
  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Edit History</h3>
  {editHistory.map((edit) => (
    <div key={edit.id} className="rounded-xl border border-border-default bg-surface-raised px-4 py-2 text-xs text-text-secondary">
      <span className="font-medium text-text-primary">{edit.editor_name ?? "Unknown"}</span>
      {" — "}
      {format(new Date(edit.edited_at), "MMM d, yyyy h:mm a")}
      {edit.note && <p className="mt-0.5 text-text-tertiary">{edit.note}</p>}
    </div>
  ))}
</div>
```

---

## 7 — Admin weekly updates tab

In `src/app/admin/page.tsx`, `WeeklyUpdatesTab`:

- Add `status` to `WeeklyUpdatesAdminRow` type.
- Add a **Status** column to the table showing a badge:
  - `draft` → amber badge "Draft"
  - `submitted` → green badge "Submitted"
- Filter the admin data route to include both draft and submitted records
  (admin should see all).

In `src/app/api/admin/data/route.ts`, section `"weekly-updates"`, add
`status` to the select fields.

---

## 8 — Build + commit

- Run `npm run build` — must pass clean.
- Commit: `"Weekly reports: draft/save/submit flow with post-submit edit audit log"`
- Push to `origin/main`.
- Create `codex/task-040-output.md` with what was changed and build status.
