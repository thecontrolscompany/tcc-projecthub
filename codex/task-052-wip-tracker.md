# Task 052 — WIP (Work In Progress) Tracker

## Context

Per-project task tracking focused on what's blocked and who owns it.
Structured around how controls jobs execute — by system area (AHU-1, VAV Group, etc.)
with a required blocker field when status is "blocked".

**IMPORTANT:** Migration 029 (`wip_items` table) must be run before this task.
Check: `SELECT to_regclass('public.wip_items');`
If null, write the migration to `supabase/migrations/028_wip_items.sql` using the
schema below and note it needs manual execution.

### `wip_items` table schema (for reference)
```sql
id, project_id, system_area, task, status (enum), assigned_to (text),
responsible_co, blocker, priority (enum), due_date, notes, sort_order,
created_at, updated_at
```
Status enum: `not_started | in_progress | blocked | in_review | complete`
Priority enum: `low | medium | high`

---

## Where it lives

New tab in the admin Project Modal (`src/components/project-modal.tsx`, 2425 lines)
and a read-only view in the PM portal (`src/app/pm/page.tsx`).

---

## Changes required

### 1. TypeScript types

Add to `src/types/database.ts`:
```ts
export type WipStatus = "not_started" | "in_progress" | "blocked" | "in_review" | "complete";
export type WipPriority = "low" | "medium" | "high";

export interface WipItem {
  id: string;
  project_id: string;
  system_area: string;
  task: string;
  status: WipStatus;
  assigned_to: string | null;
  responsible_co: string | null;
  blocker: string | null;
  priority: WipPriority;
  due_date: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

### 2. API route: `/api/admin/wip`

Create `src/app/api/admin/wip/route.ts` with GET, POST, PATCH, DELETE:

**GET** `?projectId=xxx` — fetch all wip_items for a project, ordered by `sort_order, created_at`
**POST** — create a new wip_item (admin/ops_manager only). Body: `{ project_id, system_area, task, status?, assigned_to?, responsible_co?, blocker?, priority?, due_date?, notes? }`
**PATCH** — update a wip_item (admin/ops_manager only). Body: `{ id, ...fields }`
**DELETE** — delete a wip_item (admin only). Body: `{ id }`

Use service role client. Auth: admin and ops_manager for write, pm/lead for GET.

### 3. New component: `src/components/wip-tab.tsx`

Extract the WIP tab into its own component. Props:
```ts
interface WipTabProps {
  projectId: string;
  readOnly?: boolean;
}
```

#### Summary cards (top)
Four cards in a row:
- Total items
- Blocked 🚨 (red if > 0)
- In Progress
- Complete

#### Hot List section
Only shown when there are blocked + high-priority items:
```tsx
{hotItems.length > 0 && (
  <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-4">
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-status-danger">
      🚨 Needs Attention ({hotItems.length})
    </p>
    {hotItems.map((item) => (
      <div key={item.id} className="mb-1 flex items-start justify-between text-sm">
        <span className="font-medium text-text-primary">{item.system_area} — {item.task}</span>
        <span className="ml-3 shrink-0 text-status-danger text-xs">{item.blocker}</span>
      </div>
    ))}
  </div>
)}
```
`hotItems` = items where `status === "blocked" && priority === "high"`.

#### Main table (grouped by system_area)

Group items by `system_area`. Each group has a collapsible header.

Table columns per group:
| Task | Status | Assigned To | Responsible | Blocker | Priority | Due Date | Actions |

Status display as colored pills:
- `not_started` → grey "Not Started"
- `in_progress` → blue "In Progress"
- `blocked` → red "Blocked 🚨"
- `in_review` → amber "In Review"
- `complete` → green "Complete"

If `readOnly = true`, hide Actions column, hide Add buttons.

#### Add item form (admin/ops_manager only)

Below the table, a collapsed "+ Add Item" row that expands inline:
```
System/Area: [text]  Task: [text]  Status: [select]  Priority: [select]
Assigned To: [text]  Responsible: [select: TCC|Mechanical|Controls Vendor|GC|Other]
Blocker: [text — only shown/required when status=blocked]
Due Date: [date]  Notes: [text]
[Add]  [Cancel]
```

#### Inline editing

Clicking a row opens it for inline editing (same fields as add form).
Clicking "Save" calls PATCH, "Delete" calls DELETE with confirmation.

#### Filters (above table)
- Search input (task, system_area, blocker)
- Status filter dropdown
- "Show blocked only" checkbox

### 4. Add WIP tab to Project Modal

In `src/components/project-modal.tsx`, the modal already has tabs (Overview, POC, etc.).
Add a "WIP" tab:

Add `"wip"` to the tab type, add the tab button to the tab bar,
and render `<WipTab projectId={project.id} />` when the WIP tab is active.

Only show the WIP tab when `project.id` exists (not for new project creation).

### 5. Read-only WIP in PM portal

In `src/app/pm/page.tsx`, in the project detail view (the `DailyReportForm` component
or the read-only summary view), add a collapsible "WIP / Open Items" section at the bottom:

```tsx
<details className="group">
  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-text-secondary">
    WIP / Open Items
    <span className="ml-2 text-text-tertiary group-open:hidden">▼</span>
  </summary>
  <div className="mt-3">
    <WipTab projectId={project.id} readOnly />
  </div>
</details>
```

Only show items where `status !== "complete"` in read-only mode.

---

## Files to create / change

- `src/types/database.ts` — add WipItem, WipStatus, WipPriority types
- `src/app/api/admin/wip/route.ts` — new CRUD API
- `src/components/wip-tab.tsx` — new component
- `src/components/project-modal.tsx` — add WIP tab
- `src/app/pm/page.tsx` — add read-only WIP section
- `supabase/migrations/028_wip_items.sql` — migration file (needs manual run if not already done)

---

## Acceptance criteria

- [ ] Admin opens a project modal → WIP tab shows summary cards, hot list, grouped table
- [ ] Admin can add, edit, and delete WIP items
- [ ] Blocked + high-priority items appear in the Hot List
- [ ] PM portal shows read-only WIP section (incomplete items only)
- [ ] Status pills are color-coded correctly
- [ ] Blocker field is required when status = blocked (client-side validation)
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `Add WIP tracker tab to project modal and PM portal read-only view`
Push to main. Create `codex/task-052-output.md`.
