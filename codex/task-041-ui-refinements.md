# Task 041 — UI Refinements: Back Button, Admin/Ops View, Billing Backfill, Nav Cleanup

---

## 1 — Remove "Back" button from weekly report page

The report opens in a new tab (`target="_blank"`), so `window.history.back()`
does nothing useful. Remove the Back button entirely — keep only Print.

**File:** `src/app/reports/weekly-update/[id]/PrintButton.tsx`

Change to:
```tsx
"use client";

export function PrintButton() {
  return (
    <div className="no-print print-actions">
      <button type="button" onClick={() => window.print()}>
        Print / Save as PDF
      </button>
    </div>
  );
}
```

---

## 2 — Add Ops view tab to Admin portal

Admin should be able to see the same project list that Ops managers see,
without having to switch accounts. Add an "Ops View" tab to the admin page.

**File:** `src/app/admin/page.tsx`

### 2a — Add tab
Add `"ops"` to the `Tab` type and insert it in the tab list (after "projects"):
```ts
type Tab = "billing" | "projects" | "ops" | "weekly-updates" | "contacts" | "feedback" | "users";
```

Tab label: `"Ops View"`

### 2b — Render the tab
```tsx
{tab === "ops" && <OpsViewTab />}
```

### 2c — OpsViewTab component
Rather than duplicating the full ops page, render an iframe or import the
`OpsProjectList` component. The ops project list component lives at
`src/components/ops-project-list.tsx` — import and render it directly:

```tsx
import { OpsProjectList } from "@/components/ops-project-list";

function OpsViewTab() {
  return <OpsProjectList />;
}
```

If `OpsProjectList` requires props that aren't available in admin context,
check its signature in `src/components/ops-project-list.tsx` and pass
whatever is required (likely none — it fetches its own data).

---

## 3 — Billing backfill UI

PMs need to be able to backfill historical billing periods so that the
analytics charts (backlog trend, revenue by customer) have complete data.

### 3a — New tab in admin

Add `"backfill"` to the Tab type. Tab label: `"Billing History"`.
Render `<BillingBackfillTab />`.

### 3b — BillingBackfillTab component

Add this component to `src/app/admin/page.tsx`.

**UI layout:**
- Project selector dropdown (list all projects, sorted by name)
- When a project is selected, show its existing `billing_periods` rows in a
  table with columns: Period Month, Est. Income, Prior %, % Complete,
  Prev Billed, Actual Billed, Notes
- Each row is editable inline (all numeric fields + notes)
- "Add Period" button to insert a new blank billing period row
- "Save Changes" button that PATCHes all dirty rows to a new API route

**New API route:** `src/app/api/admin/billing-backfill/route.ts`

#### GET — load periods for a project
Query: `?projectId=xxx`

Returns all `billing_periods` for the project, ordered by `period_month` ascending.

Use admin client.

#### POST — add a new period
Body: `{ projectId: string; periodMonth: string }` (format: `"YYYY-MM-DD"`)

Insert a new `billing_periods` row with defaults. Return the new row.

#### PATCH — update one or more periods
Body:
```ts
{
  updates: Array<{
    id: string;
    estimated_income_snapshot?: number;
    prior_pct?: number;
    pct_complete?: number;
    prev_billed?: number;
    actual_billed?: number | null;
    notes?: string | null;
  }>
}
```

Loop and update each row. Return `{ ok: true }`.

### 3c — Component state
```ts
const [selectedProjectId, setSelectedProjectId] = useState<string>("");
const [periods, setPeriods] = useState<BillingPeriodRow[]>([]);
const [dirty, setDirty] = useState<Set<string>>(new Set());
const [saving, setSaving] = useState(false);
const [adding, setAdding] = useState(false);
```

`BillingPeriodRow` type (local to this component):
```ts
type BillingPeriodRow = {
  id: string;
  period_month: string;
  estimated_income_snapshot: number;
  prior_pct: number;
  pct_complete: number;
  prev_billed: number;
  actual_billed: number | null;
  notes: string | null;
};
```

When a field is edited, add the row id to `dirty`. Save Changes only sends
dirty rows. After save, clear `dirty`.

Use the existing `projects` list already loaded in `AdminPage` — pass it
down as a prop: `<BillingBackfillTab projects={projects} />` where `projects`
is the existing billing table's project rows (they have `id` and `name`).

---

## 4 — Navigation/tab cleanup notes (no code change needed, just awareness)

The three overlapping areas the user asked about:
- **Contacts tab** → `pm_directory` (all contacts, no login required)
- **User Management tab** → Supabase auth accounts + roles (who can log in)
- `/admin/users` page → legacy standalone page, likely superseded by the tab

No changes needed for these in this sprint — they serve different purposes.
The `/admin/users` standalone page can be removed in a future cleanup sprint.

---

## 5 — Build + commit

- Run `npm run build` — must pass clean.
- Commit: `"UI refinements: remove back button, add ops view to admin, billing backfill tab"`
- Push to `origin/main`.
- Create `codex/task-041-output.md` with what was changed and build status.
