# Task 058 — Customer Portal: Contract Value Fix + Enhanced Metrics + Change Orders

## Context

The customer portal (`src/app/customer/page.tsx`) has several gaps:

1. **Contract Value is understated** — shows `estimated_income` only, ignores approved change orders.
2. **Metric cards are sparse** — only "Contract Value" and "Last Update". Customer should also see Total Billed, Remaining Balance, and % Complete at a glance.
3. **Billing chart baseline is wrong** — chart plots `estimated_income_snapshot` (the baseline at period creation), not the current contract value including approved COs.
4. **Change orders not visible to customer** — approved COs affect the contract value but customers can't see them.
5. **Portfolio summary uses raw `estimated_income`** — same understatement issue in the project list header metrics.

The API route (`src/app/api/customer/data/route.ts`) does NOT currently fetch change_orders. The `CustomerProject` interface does not include them.

---

## Scope of changes

### Files to change

| File | What changes |
|------|-------------|
| `src/app/api/customer/data/route.ts` | Add change_orders to the parallel fetch; return in response |
| `src/app/customer/page.tsx` | Interface, data mapping, metric cards, chart fix, CO section, portfolio fix |

No migrations. No new dependencies.

---

## 1. API route changes — `src/app/api/customer/data/route.ts`

Add a 5th parallel fetch inside the `section === "projects"` block alongside `projectsResult`, `billingResult`, `updatesResult`, `assignmentsResult`:

```ts
adminClient
  .from("change_orders")
  .select("id, project_id, co_number, title, amount, status, submitted_date, approved_date, reference_doc")
  .in("project_id", projectIds)
  .in("status", ["approved"]),
```

Destructure as `changeOrdersResult`. Add it to `readError` check.

Return it in the response:

```ts
return NextResponse.json({
  projects: projectsResult.data ?? [],
  billingPeriods: billingResult.data ?? [],
  weeklyUpdates: updatesResult.data ?? [],
  assignments: assignmentsResult.data ?? [],
  changeOrders: changeOrdersResult.data ?? [],
});
```

---

## 2. Customer portal changes — `src/app/customer/page.tsx`

### 2a. New interface

Add above `CustomerProject`:

```ts
interface CustomerChangeOrder {
  id: string;
  project_id: string;
  co_number: string;
  title: string;
  amount: number;
  status: string;
  submitted_date: string | null;
  approved_date: string | null;
  reference_doc: string | null;
}
```

Update `CustomerProject`:
```ts
interface CustomerProject {
  // ...existing fields...
  change_orders: CustomerChangeOrder[];
}
```

### 2b. Load function — map change_orders into combined

In `loadProjects`, read from the response:

```ts
const changeOrders = (json?.changeOrders ?? []) as CustomerChangeOrder[];
```

In the `combined` map:

```ts
change_orders: changeOrders.filter((co) => co.project_id === project.id),
```

### 2c. Helper function

Add alongside the other helpers at the bottom of the file:

```ts
function getProjectApprovedCoTotal(project: CustomerProject): number {
  return project.change_orders
    .filter((co) => co.status === "approved")
    .reduce((sum, co) => sum + co.amount, 0);
}

function getProjectContractValue(project: CustomerProject): number {
  return (project.estimated_income ?? 0) + getProjectApprovedCoTotal(project);
}
```

### 2d. Portfolio summary fix — `ProjectList` component

In the `summary` useMemo, replace:

```ts
const totalContracts = projects.reduce((sum, project) => sum + (project.estimated_income ?? 0), 0);
```

with:

```ts
const totalContracts = projects.reduce((sum, project) => sum + getProjectContractValue(project), 0);
```

Also fix `financialChartData`:

```ts
const financialChartData = projects.map((project) => {
  const billed = getProjectBilledToDate(project);
  const contractValue = getProjectContractValue(project);
  return {
    name: getProjectChartLabel(project),
    contractValue,
    billed,
    backlog: Math.max(contractValue - billed, 0),
  };
});
```

The `totalBacklog` line will automatically be correct since it uses `totalContracts` (already fixed above) and `totalBilled`.

### 2e. ProjectDetail — expand metric cards from 2 to 4

Find the current metric cards block at ~line 616–622:

```tsx
<div className="grid gap-3 sm:grid-cols-2">
  <MetricCard label="Contract Value" value={currency(project.estimated_income)} />
  <MetricCard
    label="Last Update"
    value={project.weekly_updates[0] ? format(new Date(project.weekly_updates[0].week_of), "MMM d, yyyy") : "Pending"}
  />
</div>
```

Replace with:

```tsx
{/* Compute these inline since they're only used here */}
{(() => {
  const approvedCoTotal = getProjectApprovedCoTotal(project);
  const contractValue = getProjectContractValue(project);
  const totalBilled = project.billing_periods.reduce((sum, p) => sum + (p.actual_billed ?? 0), 0);
  const remaining = Math.max(contractValue - totalBilled, 0);
  const currentPct = latestPeriod ? latestPeriod.pct_complete * 100 : null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Contract Value"
        value={currency(contractValue)}
        subLabel={approvedCoTotal > 0 ? `incl. ${currency(approvedCoTotal)} in approved COs` : undefined}
      />
      <MetricCard label="Total Billed" value={currency(totalBilled)} />
      <MetricCard label="Remaining Balance" value={currency(remaining)} />
      <MetricCard
        label="% Complete"
        value={currentPct !== null ? `${currentPct.toFixed(1)}%` : "Pending"}
      />
    </div>
  );
})()}
```

**Update `MetricCard` component** to accept an optional `subLabel` prop:

Find the `MetricCard` function (near bottom of file). Change its signature from:

```ts
function MetricCard({ label, value }: { label: string; value: string }) {
```

to:

```ts
function MetricCard({ label, value, subLabel }: { label: string; value: string; subLabel?: string }) {
```

And inside the render, after the value element, add:

```tsx
{subLabel && (
  <p className="mt-0.5 text-[11px] text-slate-400">{subLabel}</p>
)}
```

### 2f. Billing chart — fix contract value baseline

In the `billingChartData` useMemo (~line 525–535):

Replace:
```ts
contractValue: period.estimated_income_snapshot,
```

With:
```ts
contractValue: getProjectContractValue(project),
```

This uses the current contract value (base + approved COs) as the reference bar in every period rather than the historical snapshot. The chart title "Billing Summary" accurately reflects this.

### 2g. Approved change orders section

Add a new section BETWEEN the charts grid and the tab bar (between `</div>` closing the charts grid and `<div className="customer-print-hide flex gap-2 border-b...`).

Only render when there are approved COs:

```tsx
{project.change_orders.filter((co) => co.status === "approved").length > 0 && (
  <section
    className="customer-print-card rounded-3xl border bg-white p-6 shadow-sm"
    style={{ borderColor: BORDER }}
  >
    <div className="mb-4">
      <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: HEADER_BG }}>
        Change Orders
      </p>
      <h3 className="text-xl font-bold" style={{ color: CHARCOAL }}>
        Approved Change Orders
      </h3>
    </div>
    <div className="space-y-3">
      {project.change_orders
        .filter((co) => co.status === "approved")
        .map((co) => (
          <div
            key={co.id}
            className="flex items-center justify-between rounded-2xl border bg-slate-50 px-4 py-3 text-sm"
            style={{ borderColor: BORDER }}
          >
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-800">{co.co_number}</span>
                <span className="text-slate-400">—</span>
                <span className="text-slate-700">{co.title}</span>
              </div>
              {co.approved_date && (
                <p className="text-xs text-slate-400">
                  Approved {format(new Date(co.approved_date), "MMM d, yyyy")}
                </p>
              )}
              {co.reference_doc && (
                <p className="text-xs text-slate-400">Ref: {co.reference_doc}</p>
              )}
            </div>
            <span className="shrink-0 font-semibold" style={{ color: HEADER_BG }}>
              {co.amount >= 0 ? "+" : ""}
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(co.amount)}
            </span>
          </div>
        ))}
    </div>
    <div
      className="mt-4 rounded-2xl px-4 py-3"
      style={{ backgroundColor: "#e6f6f4" }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Total Approved Change Orders
      </p>
      <p className="mt-1 text-base font-bold" style={{ color: HEADER_BG }}>
        {currency(getProjectApprovedCoTotal(project))}
      </p>
    </div>
  </section>
)}
```

---

## Acceptance criteria

- [ ] `npm run build` passes clean
- [ ] Contract Value on project detail shows base + approved CO total (with sub-label when COs exist)
- [ ] Project detail shows 4 metric cards: Contract Value, Total Billed, Remaining Balance, % Complete
- [ ] Billing chart `contractValue` bar is consistent across all months (uses current contract value, not per-period snapshot)
- [ ] Approved change orders section appears on project detail when project has approved COs; hidden when none
- [ ] Portfolio list "Total Contract Value" metric uses base + approved CO total per project
- [ ] Portfolio financial chart `contractValue` bar uses the same adjusted value

## Commit and push

Commit message: `Customer portal: contract value + 4 metric cards + approved change orders`
Push to main.
