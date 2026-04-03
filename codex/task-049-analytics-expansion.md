# Task 049 — Analytics Expansion

## Context

The analytics page (`src/app/admin/analytics/page.tsx`, 340 lines) has three Recharts
charts: projected vs actual billing, backlog trend, and revenue by customer.
This task adds more charts, a PM workload chart, a project status breakdown,
and date range filters. No new DB tables needed — all data comes from existing API.

---

## Changes required

### 1. Date range filter

Add a date range selector at the top of the analytics page above all charts.

```tsx
const [rangeMonths, setRangeMonths] = useState(6);
```

Render a pill toggle above the charts:
```tsx
<div className="flex gap-2">
  {[3, 6, 12, 24].map((m) => (
    <button
      key={m}
      onClick={() => setRangeMonths(m)}
      className={[
        "rounded-full px-4 py-1.5 text-sm font-medium transition",
        rangeMonths === m
          ? "bg-brand-primary text-text-inverse"
          : "border border-border-default bg-surface-overlay text-text-secondary hover:bg-surface-raised",
      ].join(" ")}
    >
      {m === 24 ? "2 yr" : `${m} mo`}
    </button>
  ))}
</div>
```

Pass `rangeMonths` to the data fetch so the monthly array is filtered to last N months.
In the existing data load, filter `monthly` array to the last `rangeMonths` entries
(already sorted chronologically, so just `.slice(-rangeMonths)`).

### 2. Billing trend chart — add "Billed MTD" line

The existing projected vs actual `LineChart` has two lines.
Add a third line for `actual` (actual billed) in amber:
```tsx
<Line type="monotone" dataKey="actual" stroke="var(--color-warning)" name="Actual Billed" strokeWidth={2} dot={false} />
```

Ensure the `MonthlyData` interface and data fetch include `actual` (check if already present;
if not, add it to the `/api/admin/data?section=analytics` fetch and the SQL query).

### 3. New chart: Project Status Breakdown (donut)

Add a donut `PieChart` showing count of projects by status:
- Active (is_active = true, pct_complete < 0.95)
- Near Complete (pct_complete >= 0.75 AND < 0.95)
- Complete (pct_complete >= 0.95 OR is_active = false)
- No Updates (active but no billing period this period)

Fetch this from `/api/admin/data?section=analytics` — add a `projectStatusBreakdown`
array to the analytics API response:

```ts
// In /api/admin/data/route.ts, analytics section, add:
const { data: projectsForStatus } = await adminClient
  .from("projects")
  .select("id, is_active")
  .order("name");

const { data: latestPeriods } = await adminClient
  .from("billing_periods")
  .select("project_id, pct_complete")
  .eq("period_month", currentMonth);

const pctMap = new Map(latestPeriods?.map((p) => [p.project_id, p.pct_complete]) ?? []);

let active = 0, nearComplete = 0, complete = 0, noUpdates = 0;
for (const p of projectsForStatus ?? []) {
  if (!p.is_active) { complete++; continue; }
  const pct = pctMap.get(p.id) ?? 0;
  if (pct >= 0.95) complete++;
  else if (pct >= 0.75) nearComplete++;
  else if (pct === 0) noUpdates++;
  else active++;
}

const projectStatusBreakdown = [
  { name: "Active", value: active },
  { name: "Near Complete", value: nearComplete },
  { name: "Complete", value: complete },
  { name: "No Updates", value: noUpdates },
].filter((d) => d.value > 0);
```

Render as a `PieChart` with `innerRadius={60}` (donut), showing count in center.

### 4. New chart: PM Workload (horizontal bar)

Add a horizontal `BarChart` showing number of active projects per PM.

Fetch from `/api/admin/data?section=analytics`:
```ts
// Add to analytics response:
const { data: assignments } = await adminClient
  .from("project_assignments")
  .select("profile_id, role_on_project, project:projects(is_active), profile:profiles(full_name)")
  .eq("role_on_project", "pm");

const workloadMap = new Map<string, { name: string; count: number }>();
for (const a of assignments ?? []) {
  const proj = Array.isArray(a.project) ? a.project[0] : a.project;
  if (!proj?.is_active) continue;
  const profile = Array.isArray(a.profile) ? a.profile[0] : a.profile;
  const name = profile?.full_name ?? "Unknown";
  const existing = workloadMap.get(name) ?? { name, count: 0 };
  workloadMap.set(name, { ...existing, count: existing.count + 1 });
}
const pmWorkload = Array.from(workloadMap.values()).sort((a, b) => b.count - a.count);
```

Render as a horizontal `BarChart` (set `layout="vertical"`, use `YAxis dataKey="name"`,
`XAxis type="number"`). Keep it compact — max height 200px, one bar per PM, teal fill.

### 5. New chart: Top Customers by Backlog (horizontal bar)

Add a horizontal bar chart of top 8 customers by total estimated income of active projects.

Add to analytics response:
```ts
const { data: customerBacklog } = await adminClient
  .from("projects")
  .select("estimated_income, customer:customers(name)")
  .eq("is_active", true)
  .gt("estimated_income", 0);

const custMap = new Map<string, number>();
for (const p of customerBacklog ?? []) {
  const cust = Array.isArray(p.customer) ? p.customer[0] : p.customer;
  const name = cust?.name ?? "Unknown";
  custMap.set(name, (custMap.get(name) ?? 0) + (p.estimated_income ?? 0));
}
const topCustomers = Array.from(custMap.entries())
  .map(([name, value]) => ({ name, value }))
  .sort((a, b) => b.value - a.value)
  .slice(0, 8);
```

Render as horizontal `BarChart` same as PM workload above, with dollar values on X axis.

### 6. Layout

Arrange charts in a responsive grid:

```
Row 1: [Date range pills]
Row 2: [KPI cards — existing 4]
Row 3: [Billing Trend — full width]
Row 4: [Project Status (donut) half] [PM Workload (bar) half]
Row 5: [Revenue by Customer (existing pie) half] [Top Customers by Backlog (bar) half]
```

Use `grid grid-cols-1 gap-6 lg:grid-cols-2` for rows 4 and 5.
Wrap each chart in a `rounded-2xl border border-border-default bg-surface-raised p-5` card
with a section title above (`text-sm font-semibold text-text-primary mb-3`).

---

## Files to change

- `src/app/admin/analytics/page.tsx` — all UI changes, date filter, new charts
- `src/app/api/admin/data/route.ts` — add `projectStatusBreakdown`, `pmWorkload`, `topCustomers` to analytics section response

---

## Acceptance criteria

- [ ] Date range pills (3mo / 6mo / 12mo / 2yr) filter all charts
- [ ] Project Status donut chart shows breakdown by status
- [ ] PM Workload horizontal bar shows active project count per PM
- [ ] Top Customers bar chart shows top 8 by estimated income
- [ ] All charts render without errors when data is empty
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `Analytics: date filter, project status, PM workload, top customers charts`
Push to main. Create `codex/task-049-output.md`.
