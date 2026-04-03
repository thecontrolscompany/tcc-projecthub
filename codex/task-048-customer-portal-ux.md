# Task 048 — Customer Portal UX Improvements

## Context

The customer portal (`src/app/customer/page.tsx`, 1235 lines) has several UX issues
identified from a screenshot review. This task is purely frontend — no new DB tables,
no new API routes. All data already exists.

---

## Changes required

### 1. Summary KPI tiles — rename labels

The three KPI tiles at the top of the page currently use generic labels.
Find the summary/KPI card section and rename:

| Current label | New label |
|---|---|
| "% Complete" (or similar) | "Avg Progress Across Projects" |
| "$ To Bill" or "To Bill" | "Billed This Period" |
| "Billing" or "Total Billing" | "Total Contract Value" |

### 2. Progress rings — show % number inside

Find the circular progress ring component(s) in the customer portal.
Each ring should display the percentage number in the center of the ring,
large and bold (font-size ~14px, font-weight 700, color: `text-status-success`).

If the ring is drawn with SVG `stroke-dasharray`, add a `<text>` element centered at
`cx`/`cy`. If it uses a CSS conic-gradient or similar, add an absolutely-positioned
`<span>` centered over it.

### 3. Project cards — add status badge

Each project card should show a status badge next to or below the project name:

- `pct_complete >= 0.95` (or is_active = false) → "Complete" — `bg-status-success/10 text-status-success`
- Latest weekly update submitted within last 14 days AND no blockers → "On Track" — `bg-brand-primary/10 text-brand-primary`
- Latest weekly update has blockers → "Has Blockers" — `bg-status-danger/10 text-status-danger`
- No weekly updates in last 30 days AND is_active = true → "No Updates" — `bg-status-warning/10 text-status-warning`
- Default → "Active" — `bg-surface-overlay text-text-secondary`

Derive this from data already loaded on the page (billing_periods for pct_complete,
weekly_updates for last update date and blockers).

### 4. Project cards — reorder info hierarchy

On each project card, the most important info should come first visually:

1. Project name + status badge (top)
2. % complete (prominent — large number or progress bar)
3. Last update date + "X days ago"
4. Site address / customer name (smaller, secondary)
5. "View updates" link at bottom of card

Keep the existing layout structure but adjust the visual weight/order.
Format last update as: `"Last update: Mar 28, 2026 (6 days ago)"` using `formatDistanceToNow`
from `date-fns` (already installed).

### 5. Search / filter bar above project grid

Add a search/filter bar between the KPI tiles and the project cards:

```tsx
<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
  <input
    type="search"
    placeholder="Search projects..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="flex-1 rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary/50 focus:outline-none"
  />
  <select
    value={statusFilter}
    onChange={(e) => setStatusFilter(e.target.value)}
    className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary focus:outline-none"
  >
    <option value="all">All Projects</option>
    <option value="active">Active</option>
    <option value="complete">Complete</option>
    <option value="blocked">Has Blockers</option>
  </select>
</div>
```

Add state:
```ts
const [search, setSearch] = useState("");
const [statusFilter, setStatusFilter] = useState("all");
```

Filter the displayed projects array:
```ts
const filteredProjects = projects.filter((p) => {
  const matchesSearch =
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.site_address ?? "").toLowerCase().includes(search.toLowerCase());
  const badge = getStatusBadge(p); // your badge function from change #3
  const matchesStatus =
    statusFilter === "all" ||
    (statusFilter === "active" && badge !== "Complete") ||
    (statusFilter === "complete" && badge === "Complete") ||
    (statusFilter === "blocked" && badge === "Has Blockers");
  return matchesSearch && matchesStatus;
});
```

### 6. "Last refreshed" timestamp

Add a small line below the KPI tiles showing when data was last loaded:

```tsx
<p className="text-xs text-text-tertiary">
  Last updated: {format(loadedAt, "MMM d, yyyy h:mm a")}
</p>
```

Add state: `const [loadedAt, setLoadedAt] = useState<Date | null>(null);`
Set it after data loads: `setLoadedAt(new Date());`

---

## Files to change

- `src/app/customer/page.tsx` — all changes above

No migrations, no new API routes, no new files.

---

## Acceptance criteria

- [ ] KPI tile labels use the new plain-English names
- [ ] Progress rings show the % number in the center
- [ ] Each project card shows a status badge
- [ ] Search input filters projects by name and address in real time
- [ ] Status filter dropdown filters by badge type
- [ ] "Last updated" timestamp appears below KPI tiles
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `Customer portal: UX improvements — KPI labels, status badges, search/filter`
Push to main. Create `codex/task-048-output.md`.
