# Task 072 — Customer Financial Snapshot Chart: Label & Single-Project Fixes

## File to edit
`src/app/customer/page.tsx`

---

## Fix 1 — Project name labels truncating to ~4 characters

The `YAxis` in the "Financial Snapshot by Project" chart has `width={110}`.
This is too narrow — project names are being clipped to a few characters.

Find:
```tsx
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
```

Replace with:
```tsx
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  tick={{ fill: "#475569", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
```

Also extend `getProjectChartLabel` so names aren't cut too short:

Find:
```ts
function getProjectChartLabel(project: CustomerProject) {
  if (project.name.length <= 18) {
    return project.name;
  }

  return `${project.name.slice(0, 15)}...`;
}
```

Replace with:
```ts
function getProjectChartLabel(project: CustomerProject) {
  if (project.name.length <= 24) {
    return project.name;
  }

  return `${project.name.slice(0, 21)}...`;
}
```

---

## Fix 2 — Single-project chart has too much whitespace

When a customer has only one project the chart height is `Math.max(160, 1 * 52) = 160px`
but the card is much taller due to padding, leaving a large empty area.

Replace the entire `<ChartCard title="Financial Snapshot by Project">` block
(the one containing the `<ResponsiveContainer>`) with the following, which
shows a compact two-stat summary card instead of a chart when there is only
one project:

```tsx
        <ChartCard title="Financial Snapshot by Project">
          {summary.financialChartData.length === 0 ? (
            <EmptyChartMessage message="Contract and billing totals will appear here as project data is recorded." />
          ) : summary.financialChartData.length === 1 ? (
            (() => {
              const d = summary.financialChartData[0];
              const total = d.billed + d.backlog;
              const pct = total > 0 ? Math.round((d.billed / total) * 100) : 0;
              return (
                <div className="flex flex-col gap-4 py-2">
                  <p className="text-sm font-semibold text-text-primary">{d.name}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Billed</p>
                      <p className="mt-1 text-lg font-bold" style={{ color: HEADER_BG }}>{currency(d.billed)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Remaining</p>
                      <p className="mt-1 text-lg font-bold" style={{ color: ACCENT }}>{currency(d.backlog)}</p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>Progress</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: HEADER_BG }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Contract: {currency(total)}</p>
                  </div>
                </div>
              );
            })()
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, summary.financialChartData.length * 52)}>
              <BarChart
                data={summary.financialChartData}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                barSize={22}
              >
                <CartesianGrid horizontal={false} stroke="#dbe7e5" />
                <XAxis
                  type="number"
                  tickFormatter={(value) => compactCurrency(value)}
                  tick={{ fill: "#475569", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  tick={{ fill: "#475569", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<PortfolioTooltip />} />
                <Bar dataKey="billed" stackId="a" fill={HEADER_BG} radius={[0, 0, 0, 0]} name="billed" />
                <Bar dataKey="backlog" stackId="a" fill={ACCENT} radius={[4, 4, 4, 4]} name="backlog" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
```

---

## When done

Run `npm run build` to confirm no type errors, then commit all changes and push to `main`.
