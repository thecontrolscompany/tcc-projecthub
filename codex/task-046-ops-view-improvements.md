# Task 046 — Ops View: % Complete fix, expandable weekly reports, By Project filter

## Overview

Three improvements to the Ops Manager view:

1. **% Complete not populating** — currently queries `billing_periods` for the current month only; if no billing period has been entered yet this month, all projects show 0%.
2. **Weekly reports expand when a project row is selected** — Projects tab rows should expand inline to show recent weekly updates; Weekly Updates tab should be grouped by project and expand.
3. **By Project tab missing "Show completed" checkbox** — clicking "All Projects" hardcodes `showCompleted = true` with no way to filter back to active only.

---

## Fix 1 — % Complete in `src/app/ops/page.tsx`

The current query:
```ts
adminClient.from("billing_periods").select("project_id, pct_complete").eq("period_month", currentMonth)
```
Only fetches billing periods for the current calendar month. Replace this with a query against `weekly_updates` to get the most recent submitted % complete per project:

```ts
adminClient
  .from("weekly_updates")
  .select("project_id, pct_complete, week_of")
  .eq("status", "submitted")
  .order("week_of", { ascending: false })
```

Then build the map by taking the first (most recent) entry per project_id:

```ts
const pctByProjectId = new Map<string, number>();
for (const update of (recentUpdates ?? [])) {
  if (!pctByProjectId.has(update.project_id) && update.pct_complete !== null) {
    pctByProjectId.set(update.project_id, update.pct_complete);
  }
}
```

Update the Promise.all to use this new query instead of the billing_periods query. Remove the `currentMonth` variable and `format` import if no longer needed.

In `normalizedProjects` map, the line:
```ts
pctComplete: (pctByProjectId.get(project.id) ?? 0) * 100,
```
stays the same — `weekly_updates.pct_complete` is also stored as a decimal (0–1).

---

## Fix 2a — Projects tab: expand row to show weekly updates

In `src/components/ops-project-list.tsx`:

### State additions
```ts
const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
const [projectUpdates, setProjectUpdates] = useState<Record<string, WeeklyUpdateSummary[]>>({});
const [loadingUpdatesFor, setLoadingUpdatesFor] = useState<string | null>(null);
```

Add a type near the top:
```ts
type WeeklyUpdateSummary = {
  id: string;
  week_of: string;
  pct_complete: number | null;
  status: "draft" | "submitted";
  blockers: string | null;
};
```

### New function: `toggleProjectUpdates`
When a row is clicked, toggle expand and lazy-load weekly updates if not already fetched:
```ts
async function toggleProjectUpdates(projectId: string) {
  if (expandedProjectId === projectId) {
    setExpandedProjectId(null);
    return;
  }
  setExpandedProjectId(projectId);
  if (projectUpdates[projectId]) return; // already loaded

  setLoadingUpdatesFor(projectId);
  try {
    const res = await fetch(
      `/api/admin/data?section=project-weekly-updates&projectId=${encodeURIComponent(projectId)}`,
      { credentials: "include" }
    );
    const json = await res.json();
    setProjectUpdates((prev) => ({
      ...prev,
      [projectId]: (json?.updates as WeeklyUpdateSummary[]) ?? [],
    }));
  } catch {
    setProjectUpdates((prev) => ({ ...prev, [projectId]: [] }));
  } finally {
    setLoadingUpdatesFor(null);
  }
}
```

### Row changes in grouped view
Change the `<tr>` `onClick` from opening the modal to toggling updates:
```tsx
<tr
  key={project.id}
  onClick={() => void toggleProjectUpdates(project.id)}
  className="cursor-pointer border-b border-border-default hover:bg-surface-raised"
>
```

Add an "Edit" button in the project name cell (stop propagation so it doesn't toggle):
```tsx
<td className="px-4 py-2.5 font-medium text-text-primary">
  <div className="flex items-center gap-2">
    <span>{project.name}</span>
    <button
      onClick={(e) => { e.stopPropagation(); void openProject(project.id); }}
      className="shrink-0 rounded border border-border-default bg-surface-overlay px-2 py-0.5 text-xs font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary"
    >
      Edit
    </button>
    {loadingProjectId === project.id && (
      <span className="text-xs text-text-tertiary">Loading…</span>
    )}
    {project.sharepointFolder && ( /* SP link unchanged */ )}
  </div>
</td>
```

After each `<tr>` for a project row, render an expansion row:
```tsx
{expandedProjectId === project.id && (
  <tr key={`${project.id}-expand`} className="border-b border-border-default bg-surface-raised/40">
    <td colSpan={4} className="px-6 py-3">
      {loadingUpdatesFor === project.id ? (
        <p className="text-xs text-text-tertiary">Loading updates...</p>
      ) : (projectUpdates[project.id] ?? []).length === 0 ? (
        <p className="text-xs text-text-tertiary">No weekly updates on file.</p>
      ) : (
        <div className="space-y-1.5">
          {(projectUpdates[project.id] ?? []).slice(0, 8).map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-xs">
              <span className="text-text-secondary">Week of {u.week_of}</span>
              <div className="flex items-center gap-3">
                {u.pct_complete !== null && (
                  <span className="font-semibold text-status-success">{(u.pct_complete * 100).toFixed(1)}%</span>
                )}
                <span className={[
                  "rounded-full px-2 py-0.5 font-medium capitalize",
                  u.status === "draft" ? "bg-status-warning/10 text-status-warning" : "bg-status-success/10 text-status-success",
                ].join(" ")}>{u.status}</span>
                {u.status === "submitted" && <ViewReportLink updateId={u.id} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </td>
  </tr>
)}
```

Apply the same expand-row pattern to the "All Projects" flat table view. The "All Projects" `<tr>` onClick should also call `toggleProjectUpdates` instead of `openProject`, with an Edit button added.

Add this import at the top:
```ts
import { ViewReportLink } from "@/components/view-report-link";
```

---

## Fix 2b — Weekly Updates tab: group by project with expand/collapse

In `src/components/admin-weekly-feedback.tsx`, refactor `WeeklyUpdatesTab`:

After filtering, group by project name:
```ts
const groupedByProject = useMemo(() => {
  const map = new Map<string, { projectName: string; updates: typeof filteredUpdates }>();
  for (const update of filteredUpdates) {
    const project = Array.isArray(update.project) ? update.project[0] : update.project;
    const name = project?.name ?? "Unknown Project";
    if (!map.has(name)) map.set(name, { projectName: name, updates: [] });
    map.get(name)!.updates.push(update);
  }
  return Array.from(map.values()).sort((a, b) => a.projectName.localeCompare(b.projectName));
}, [filteredUpdates]);
```

Add state:
```ts
const [expandedProject, setExpandedProject] = useState<string | null>(null);
```

Replace the flat `<table>` render with grouped sections:
```tsx
<div className="space-y-3">
  {groupedByProject.map(({ projectName, updates }) => (
    <div key={projectName} className="overflow-hidden rounded-2xl border border-border-default">
      <button
        type="button"
        onClick={() => setExpandedProject(expandedProject === projectName ? null : projectName)}
        className="flex w-full items-center justify-between border-b border-border-default bg-surface-raised px-4 py-3 text-left hover:bg-surface-overlay/60"
      >
        <div>
          <span className="font-semibold text-text-primary">{projectName}</span>
          <span className="ml-2 text-xs text-text-tertiary">
            {updates.length} update{updates.length === 1 ? "" : "s"}
          </span>
        </div>
        <span className="text-text-tertiary text-xs">{expandedProject === projectName ? "▲" : "▼"}</span>
      </button>

      {expandedProject === projectName && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-raised/60">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Week Of</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">PM</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">% Complete</th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">Blockers</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Submitted At</th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Report</th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Delete</th>
              </tr>
            </thead>
            <tbody>
              {updates.map((update) => {
                /* same row render logic as current, minus the Project/Customer columns */
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  ))}
</div>
```

Add `useMemo` import if not already present.

---

## Fix 3 — "By Project" view: add Show completed checkbox

In `src/components/ops-project-list.tsx`:

The "All Projects" button currently forces `showCompleted = true`. Change it to not force the state:
```tsx
<button
  onClick={() => setViewMode("all")}
  ...
>
  By Project
</button>
```

Update the toolbar so the "Show completed" checkbox appears for **both** view modes (not just `viewMode === "grouped"`):
```tsx
<label className="inline-flex items-center gap-2 text-sm text-text-secondary">
  <input
    type="checkbox"
    checked={showCompleted}
    onChange={(event) => setShowCompleted(event.target.checked)}
    className="h-4 w-4 accent-[var(--color-brand-primary)]"
  />
  Show completed
</label>
```
Remove the `{viewMode === "grouped" && (` wrapper around the checkbox.

In the "All Projects" flat table, apply the filter:
```tsx
{(showCompleted ? projects : projects.filter((p) => p.is_active))
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((project) => ( /* existing row */ ))}
```

Also rename the button label from "All Projects" to "By Project" (consistent with the user's description).

---

## New API endpoint: `GET /api/admin/data?section=project-weekly-updates&projectId=...`

In `src/app/api/admin/data/route.ts`, add a new section handler for `project-weekly-updates`:

```ts
if (section === "project-weekly-updates") {
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId." }, { status: 400 });
  }
  const { data, error } = await adminClient
    .from("weekly_updates")
    .select("id, week_of, pct_complete, status, blockers")
    .eq("project_id", projectId)
    .order("week_of", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updates: data ?? [] });
}
```

---

## Acceptance criteria

- [ ] % Complete column in Ops Projects view shows the most recent submitted weekly update value (non-zero for projects with submitted updates)
- [ ] Clicking a project row in the "By PM" grouped view expands an inline panel showing that project's recent weekly updates; clicking "Edit" opens the modal
- [ ] Clicking a project row in the "By Project" flat view does the same
- [ ] Weekly Updates tab groups updates by project, each group collapsible
- [ ] "By Project" view has a "Show completed" checkbox that defaults to unchecked (active projects only)
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `Ops view: fix % complete, expandable weekly updates, By Project filter`
Push to main.
