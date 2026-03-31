"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";

interface MonthlyData {
  month: string;
  projected: number;
  actual: number;
  backlog: number;
}

interface CustomerRevenue {
  name: string;
  value: number;
}

const COLORS = [
  "var(--color-brand-primary)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-danger)",
  "var(--color-info)",
  "var(--color-brand-accent)",
];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(n);

export default function AnalyticsPage() {
  const supabase = createClient();
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [byCustomer, setByCustomer] = useState<CustomerRevenue[]>([]);
  const [summary, setSummary] = useState({
    activeProjects: 0,
    totalBacklog: 0,
    billedMtd: 0,
    projectedMtd: 0,
  });
  const [loading, setLoading] = useState(true);
  const [powerBiEnabled] = useState(
    !!(process.env.NEXT_PUBLIC_POWERBI_WORKSPACE_ID && process.env.NEXT_PUBLIC_POWERBI_REPORT_ID)
  );

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAnalytics() {
    const currentMonth = startOfMonth(new Date());
    const months = Array.from({ length: 12 }, (_, i) =>
      format(subMonths(currentMonth, 11 - i), "yyyy-MM-dd")
    );

    const { data: periods } = await supabase
      .from("billing_periods")
      .select("period_month, estimated_income_snapshot, pct_complete, prev_billed, actual_billed, project_id")
      .gte("period_month", months[0])
      .lte("period_month", months[11]);

    const { data: projects } = await supabase
      .from("projects")
      .select("id, estimated_income, is_active, customer:customers(name)")
      .eq("is_active", true);

    if (periods) {
      const byMonth = new Map<string, MonthlyData>();
      for (const m of months) {
        const label = format(new Date(m), "MMM yy");
        byMonth.set(m, { month: label, projected: 0, actual: 0, backlog: 0 });
      }

      for (const p of periods) {
        const key = p.period_month.slice(0, 7) + "-01";
        const entry = byMonth.get(key);
        if (!entry) continue;
        const toBill = Math.max(p.estimated_income_snapshot * p.pct_complete - p.prev_billed, 0);
        const backlog = Math.max(p.estimated_income_snapshot - p.prev_billed, 0);
        entry.projected += toBill;
        entry.actual += p.actual_billed ?? 0;
        entry.backlog += backlog;
      }

      setMonthly(Array.from(byMonth.values()));

      const currentKey = format(currentMonth, "yyyy-MM-dd");
      const currentPeriods = periods.filter((p) => p.period_month === currentKey);
      setSummary({
        activeProjects: projects?.length ?? 0,
        totalBacklog: currentPeriods.reduce(
          (s, p) => s + Math.max(p.estimated_income_snapshot - p.prev_billed, 0),
          0
        ),
        billedMtd: currentPeriods.reduce((s, p) => s + (p.actual_billed ?? 0), 0),
        projectedMtd: currentPeriods.reduce(
          (s, p) => s + Math.max(p.estimated_income_snapshot * p.pct_complete - p.prev_billed, 0),
          0
        ),
      });
    }

    if (projects) {
      const custMap = new Map<string, number>();
      for (const proj of projects) {
        const customerRecord = proj.customer as { name: string } | { name: string }[] | null;
        const name = (Array.isArray(customerRecord) ? customerRecord[0]?.name : customerRecord?.name) ?? "Unknown";
        custMap.set(name, (custMap.get(name) ?? 0) + proj.estimated_income);
      }
      setByCustomer(
        Array.from(custMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
      );
    }

    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-screen-xl space-y-8 px-6 py-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Analytics</h1>
      {loading ? (
        <div className="py-20 text-center text-text-tertiary">Loading analytics...</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Active Projects" value={String(summary.activeProjects)} />
            <KpiCard label="Total Backlog" value={fmt(summary.totalBacklog)} highlight />
            <KpiCard label="Projected This Month" value={fmt(summary.projectedMtd)} />
            <KpiCard label="Actual Billed MTD" value={fmt(summary.billedMtd)} accent="emerald" />
          </div>

          <ChartCard title="Projected vs Actual Billings - Last 12 Months">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthly} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" />
                <XAxis dataKey="month" tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
                <YAxis tickFormatter={(v) => fmt(v)} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => fmt(Number(v))}
                  contentStyle={{
                    background: "var(--color-surface-raised)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "var(--color-text-primary)" }}
                />
                <Legend wrapperStyle={{ color: "var(--color-text-secondary)", fontSize: 12 }} />
                <Bar dataKey="projected" name="Projected" fill="var(--color-brand-primary)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="var(--color-success)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Backlog Trend - Last 12 Months">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthly} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" />
                <XAxis dataKey="month" tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
                <YAxis tickFormatter={(v) => fmt(v)} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => fmt(Number(v))}
                  contentStyle={{
                    background: "var(--color-surface-raised)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "var(--color-text-primary)" }}
                />
                <Line
                  type="monotone"
                  dataKey="backlog"
                  name="Backlog"
                  stroke="var(--color-warning)"
                  strokeWidth={2}
                  dot={{ fill: "var(--color-warning)", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Contract Value by Customer">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={byCustomer}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: "var(--color-text-tertiary)" }}
                  >
                    {byCustomer.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => fmt(Number(v))}
                    contentStyle={{
                      background: "var(--color-surface-raised)",
                      border: "1px solid var(--color-border-default)",
                      borderRadius: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Contract Values">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default">
                      <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Customer</th>
                      <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Contract Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCustomer.map((c, i) => (
                      <tr key={c.name} className="border-b border-border-default">
                        <td className="flex items-center gap-2 py-2 text-text-secondary">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ background: COLORS[i % COLORS.length] }}
                          />
                          {c.name}
                        </td>
                        <td className="py-2 text-right font-semibold text-text-primary">{fmt(c.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </div>

          {powerBiEnabled ? (
            <ChartCard title="Power BI Report">
              <p className="mb-3 text-xs text-text-tertiary">
                Embedded Power BI report - drill down into full financial detail.
              </p>
              <div className="aspect-video w-full overflow-hidden rounded-xl border border-border-default bg-surface-raised">
                <iframe
                  title="TCC Power BI Report"
                  src={`https://app.powerbi.com/reportEmbed?reportId=${process.env.NEXT_PUBLIC_POWERBI_REPORT_ID}&groupId=${process.env.NEXT_PUBLIC_POWERBI_WORKSPACE_ID}&autoAuth=true&ctid=${process.env.NEXT_PUBLIC_AZURE_TENANT_ID}`}
                  className="h-full w-full"
                  allowFullScreen
                />
              </div>
            </ChartCard>
          ) : (
            <div className="rounded-2xl border border-dashed border-border-default p-8 text-center">
              <p className="text-sm font-medium text-text-secondary">Power BI Embed</p>
              <p className="mt-1 text-xs text-text-tertiary">
                Set NEXT_PUBLIC_POWERBI_WORKSPACE_ID and NEXT_PUBLIC_POWERBI_REPORT_ID in .env.local to enable.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  highlight,
  accent,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  accent?: "emerald";
}) {
  const valueColor =
    accent === "emerald" ? "text-status-success" : highlight ? "text-brand-primary" : "text-text-primary";

  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">{title}</h3>
      {children}
    </div>
  );
}
