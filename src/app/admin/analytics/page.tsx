"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";
import { safeJson } from "@/lib/utils/safe-json";

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

interface StatusBreakdownItem {
  name: string;
  value: number;
}

interface PmWorkloadItem {
  name: string;
  count: number;
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
  const [rangeMonths, setRangeMonths] = useState(6);
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [byCustomer, setByCustomer] = useState<CustomerRevenue[]>([]);
  const [projectStatusBreakdown, setProjectStatusBreakdown] = useState<StatusBreakdownItem[]>([]);
  const [pmWorkload, setPmWorkload] = useState<PmWorkloadItem[]>([]);
  const [topCustomers, setTopCustomers] = useState<CustomerRevenue[]>([]);
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
    void loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeMonths]);

  async function loadAnalytics() {
    setLoading(true);

    const currentMonth = startOfMonth(new Date());
    const startMonth = format(subMonths(currentMonth, Math.max(rangeMonths, 24) - 1), "yyyy-MM-dd");
    const endMonth = format(currentMonth, "yyyy-MM-dd");

    try {
      const response = await fetch(
        `/api/admin/data?section=analytics&startMonth=${encodeURIComponent(startMonth)}&endMonth=${encodeURIComponent(endMonth)}`,
        { credentials: "include" }
      );
      const json = await safeJson(response);

      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to load analytics.");
      }

      const periods = (json?.billingPeriods ?? []) as Array<{
        period_month: string;
        estimated_income_snapshot: number;
        pct_complete: number;
        prev_billed: number;
        actual_billed: number | null;
        project_id: string;
      }>;
      const projects = (json?.projects ?? []) as Array<{
        id: string;
        estimated_income: number;
        is_active: boolean;
        customer?: { name: string } | { name: string }[] | null;
      }>;

      const monthKeys = Array.from({ length: Math.max(rangeMonths, 24) }, (_, i) =>
        format(subMonths(currentMonth, Math.max(rangeMonths, 24) - 1 - i), "yyyy-MM-dd")
      );

      const byMonth = new Map<string, MonthlyData>();
      for (const month of monthKeys) {
        byMonth.set(month, {
          month: format(new Date(month), "MMM yy"),
          projected: 0,
          actual: 0,
          backlog: 0,
        });
      }

      for (const period of periods) {
        const key = `${period.period_month.slice(0, 7)}-01`;
        const entry = byMonth.get(key);
        if (!entry) continue;

        const projected = Math.max(period.estimated_income_snapshot * period.pct_complete - period.prev_billed, 0);
        const backlog = Math.max(period.estimated_income_snapshot - period.prev_billed, 0);

        entry.projected += projected;
        entry.actual += period.actual_billed ?? 0;
        entry.backlog += backlog;
      }

      const monthlyRows = Array.from(byMonth.values()).slice(-rangeMonths);
      setMonthly(monthlyRows);

      const currentKey = format(currentMonth, "yyyy-MM-dd");
      const currentPeriods = periods.filter((period) => period.period_month === currentKey);
      setSummary({
        activeProjects: projects.length,
        totalBacklog: currentPeriods.reduce(
          (sum, period) => sum + Math.max(period.estimated_income_snapshot - period.prev_billed, 0),
          0
        ),
        billedMtd: currentPeriods.reduce((sum, period) => sum + (period.actual_billed ?? 0), 0),
        projectedMtd: currentPeriods.reduce(
          (sum, period) => sum + Math.max(period.estimated_income_snapshot * period.pct_complete - period.prev_billed, 0),
          0
        ),
      });

      const customerMap = new Map<string, number>();
      for (const project of projects) {
        const customerRecord = Array.isArray(project.customer) ? project.customer[0] : project.customer;
        const name = customerRecord?.name ?? "Unknown";
        customerMap.set(name, (customerMap.get(name) ?? 0) + project.estimated_income);
      }

      setByCustomer(
        Array.from(customerMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
      );
      setProjectStatusBreakdown((json?.projectStatusBreakdown as StatusBreakdownItem[]) ?? []);
      setPmWorkload((json?.pmWorkload as PmWorkloadItem[]) ?? []);
      setTopCustomers((json?.topCustomers as CustomerRevenue[]) ?? []);
    } catch {
      setMonthly([]);
      setByCustomer([]);
      setProjectStatusBreakdown([]);
      setPmWorkload([]);
      setTopCustomers([]);
      setSummary({
        activeProjects: 0,
        totalBacklog: 0,
        billedMtd: 0,
        projectedMtd: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-screen-xl space-y-8 px-6 py-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Analytics</h1>

      {loading ? (
        <div className="py-20 text-center text-text-tertiary">Loading analytics...</div>
      ) : (
        <>
          <div className="flex gap-2">
            {[3, 6, 12, 24].map((months) => (
              <button
                key={months}
                onClick={() => setRangeMonths(months)}
                className={[
                  "rounded-full px-4 py-1.5 text-sm font-medium transition",
                  rangeMonths === months
                    ? "bg-brand-primary text-text-inverse"
                    : "border border-border-default bg-surface-overlay text-text-secondary hover:bg-surface-raised",
                ].join(" ")}
              >
                {months === 24 ? "2 yr" : `${months} mo`}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Active Projects" value={String(summary.activeProjects)} />
            <KpiCard label="Total Backlog" value={fmt(summary.totalBacklog)} highlight />
            <KpiCard label="Projected This Month" value={fmt(summary.projectedMtd)} />
            <KpiCard label="Actual Billed MTD" value={fmt(summary.billedMtd)} accent="emerald" />
          </div>

          <ChartCard title={`Billing Trend - Last ${rangeMonths === 24 ? "24 months" : `${rangeMonths} months`}`}>
            {monthly.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={monthly} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" />
                  <XAxis dataKey="month" tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => fmt(v)} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => fmt(Number(value))}
                    contentStyle={{
                      background: "var(--color-surface-raised)",
                      border: "1px solid var(--color-border-default)",
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: "var(--color-text-primary)" }}
                  />
                  <Legend wrapperStyle={{ color: "var(--color-text-secondary)", fontSize: 12 }} />
                  <Line type="monotone" dataKey="projected" name="Projected To Bill" stroke="var(--color-brand-primary)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="actual" name="Actual Billed" stroke="var(--color-warning)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="backlog" name="Backlog" stroke="var(--color-success)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartMessage message="Billing trend data will appear here when periods are available." />
            )}
          </ChartCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Project Status Breakdown">
              {projectStatusBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={projectStatusBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {projectStatusBreakdown.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => String(value)}
                      contentStyle={{
                        background: "var(--color-surface-raised)",
                        border: "1px solid var(--color-border-default)",
                        borderRadius: 8,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartMessage message="Project status counts will appear here once active projects are loaded." />
              )}
            </ChartCard>

            <ChartCard title="PM Workload">
              {pmWorkload.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, pmWorkload.length * 42)}>
                  <BarChart data={pmWorkload} layout="vertical" margin={{ top: 5, right: 10, left: 30, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} width={120} />
                    <Tooltip
                      formatter={(value) => String(value)}
                      contentStyle={{
                        background: "var(--color-surface-raised)",
                        border: "1px solid var(--color-border-default)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="count" fill="var(--color-brand-primary)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartMessage message="PM workload appears here when PM assignments exist." />
              )}
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Contract Value by Customer">
              {byCustomer.length > 0 ? (
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
                      {byCustomer.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => fmt(Number(value))}
                      contentStyle={{
                        background: "var(--color-surface-raised)",
                        border: "1px solid var(--color-border-default)",
                        borderRadius: 8,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartMessage message="Customer revenue shares will appear here when projects are available." />
              )}
            </ChartCard>

            <ChartCard title="Top Customers by Backlog">
              {topCustomers.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(220, topCustomers.length * 40)}>
                  <BarChart data={topCustomers} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" horizontal={false} />
                    <XAxis type="number" tickFormatter={(value) => fmt(Number(value))} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} width={120} />
                    <Tooltip
                      formatter={(value) => fmt(Number(value))}
                      contentStyle={{
                        background: "var(--color-surface-raised)",
                        border: "1px solid var(--color-border-default)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="value" fill="var(--color-info)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartMessage message="Top backlog customers appear here when active backlog exists." />
              )}
            </ChartCard>
          </div>

          <ChartCard title={`Backlog Trend - Last ${rangeMonths === 24 ? "24 months" : `${rangeMonths} months`}`}>
            {monthly.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthly} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" />
                  <XAxis dataKey="month" tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
                  <YAxis tickFormatter={(value) => fmt(Number(value))} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => fmt(Number(value))}
                    contentStyle={{
                      background: "var(--color-surface-raised)",
                      border: "1px solid var(--color-border-default)",
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: "var(--color-text-primary)" }}
                  />
                  <Line type="monotone" dataKey="backlog" name="Backlog" stroke="var(--color-warning)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartMessage message="Backlog history will appear here when billing periods exist." />
            )}
          </ChartCard>

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

function EmptyChartMessage({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-border-default px-6 text-center text-sm text-text-tertiary">
      {message}
    </div>
  );
}
