"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import {
  PURSUIT_STATUS_LABELS,
  PURSUIT_STATUS_OPTIONS,
  type PursuitStatus,
  type PursuitStatusFilter,
} from "@/lib/pursuit-status";
import { safeJson } from "@/lib/utils/safe-json";

type AnalyticsPursuit = {
  id: string;
  project_name: string;
  owner_name: string | null;
  project_location: string | null;
  status: PursuitStatus;
  created_at: string;
  bid_year: number | null;
  estimated_value: number | null;
};

const COLORS = [
  "var(--color-brand-primary)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-danger)",
  "var(--color-info)",
  "var(--color-brand-accent)",
];

export function PursuitAnalyticsClient() {
  const [pursuits, setPursuits] = useState<AnalyticsPursuit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PursuitStatusFilter>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");

  useEffect(() => {
    void loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/opportunities/pursuits/analytics", { cache: "no-store" });
      const json = await safeJson(response);
      if (!response.ok) throw new Error(json?.error ?? "Unable to load pursuit analytics.");
      setPursuits((json?.pursuits ?? []) as AnalyticsPursuit[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load pursuit analytics.");
    } finally {
      setLoading(false);
    }
  }

  const availableYears = useMemo(() => {
    const years = new Set(pursuits.map((pursuit) => pursuitYear(pursuit)));
    const known = Array.from(years)
      .filter((year) => year !== "Unknown")
      .sort();
    return years.has("Unknown") ? [...known, "Unknown"] : known;
  }, [pursuits]);

  const filtered = useMemo(() => {
    return pursuits.filter((pursuit) => {
      if (statusFilter !== "all" && pursuit.status !== statusFilter) return false;
      if (yearFilter !== "all" && pursuitYear(pursuit) !== yearFilter) return false;
      return true;
    });
  }, [pursuits, statusFilter, yearFilter]);

  const customerLabelMap = useMemo(() => buildCustomerLabelMap(pursuits), [pursuits]);

  const metrics = useMemo(() => {
    const totalBids = filtered.length;
    const totalValueBid = filtered.reduce((sum, pursuit) => sum + (pursuit.estimated_value ?? 0), 0);
    const wonValue = filtered
      .filter((pursuit) => pursuit.status === "awarded")
      .reduce((sum, pursuit) => sum + (pursuit.estimated_value ?? 0), 0);
    const wonCount = filtered.filter((pursuit) => pursuit.status === "awarded").length;
    const lostCount = filtered.filter((pursuit) => pursuit.status === "lost").length;
    const closedCount = wonCount + lostCount;
    const winRate = closedCount > 0 ? (wonCount / closedCount) * 100 : 0;
    const withValueCount = filtered.filter((pursuit) => pursuit.estimated_value !== null).length;
    const avgBidValue = withValueCount > 0 ? totalValueBid / withValueCount : 0;

    return { totalBids, totalValueBid, wonValue, winRate, avgBidValue };
  }, [filtered]);

  const byStatus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const pursuit of filtered) {
      const label = PURSUIT_STATUS_LABELS[pursuit.status];
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const topCustomersByValue = useMemo(
    () => topCustomers(filtered, customerLabelMap, "value"),
    [customerLabelMap, filtered]
  );
  const topCustomersByCount = useMemo(
    () => topCustomers(filtered, customerLabelMap, "count"),
    [customerLabelMap, filtered]
  );

  const byYear = useMemo(() => {
    const rows = new Map<string, { year: string; count: number; value: number }>();
    for (const pursuit of filtered) {
      const year = pursuitYear(pursuit);
      const current = rows.get(year) ?? { year, count: 0, value: 0 };
      current.count += 1;
      current.value += pursuit.estimated_value ?? 0;
      rows.set(year, current);
    }
    return Array.from(rows.values()).sort((a, b) => sortYearLabel(a.year, b.year));
  }, [filtered]);

  const winLossByCustomer = useMemo(() => {
    const closed = filtered.filter((pursuit) => pursuit.status === "awarded" || pursuit.status === "lost");
    const grouped = new Map<string, { name: string; won: number; lost: number; total: number }>();

    for (const pursuit of closed) {
      const key = canonicalCustomerKey(pursuit.owner_name, customerLabelMap.acronymToBaseKey);
      const name = customerLabelMap.labelByKey.get(key) ?? "Unknown";
      const current = grouped.get(key) ?? { name, won: 0, lost: 0, total: 0 };
      if (pursuit.status === "awarded") current.won += 1;
      else current.lost += 1;
      current.total += 1;
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [customerLabelMap, filtered]);

  return (
    <div className="mx-auto max-w-screen-xl space-y-8 px-6 py-6">
      <OpportunityHubSubnav />

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">OpportunityHub</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Analytics</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Slice the pursuit pipeline by status and year to quantify bid volume, customer concentration, win rate, and trend.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 px-5 py-4 text-sm text-status-danger">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-border-default bg-surface-raised px-6 py-16 text-center text-sm text-text-tertiary">
          Loading pursuit analytics...
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border-default bg-surface-raised p-5">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-text-secondary">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as PursuitStatusFilter)}
                className="rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              >
                {(["all", ...PURSUIT_STATUS_OPTIONS] as const).map((value) => (
                  <option key={value} value={value}>
                    {PURSUIT_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-text-secondary">Year</span>
              <select
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
                className="rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              >
                <option value="all">All</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Total bids" value={String(metrics.totalBids)} />
            <MetricCard label="Total value bid" value={formatCurrency(metrics.totalValueBid)} highlight />
            <MetricCard label="Won value" value={formatCurrency(metrics.wonValue)} accent="emerald" />
            <MetricCard label="Win rate" value={`${metrics.winRate.toFixed(0)}%`} />
            <MetricCard label="Avg bid value" value={formatCurrency(metrics.avgBidValue)} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Bids by Status">
              {byStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                      {byStatus.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, _name, item) => {
                        const total = byStatus.reduce((sum, row) => sum + row.value, 0);
                        const count = Number(value);
                        const percent = total > 0 ? `${Math.round((count / total) * 100)}%` : "0%";
                        return [`${count} (${percent})`, item?.payload?.name ?? "Status"];
                      }}
                      contentStyle={tooltipStyle}
                    />
                    <Legend wrapperStyle={legendStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartMessage message="No pursuits match the current filters." />
              )}
            </ChartCard>

            <ChartCard title="Top Customers by Value">
              {topCustomersByValue.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(260, topCustomersByValue.length * 40)}>
                  <BarChart data={topCustomersByValue} layout="vertical" margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" horizontal={false} />
                    <XAxis type="number" tickFormatter={(value) => formatCompactCurrency(Number(value))} tick={axisTickStyle} />
                    <YAxis type="category" dataKey="name" tick={axisTickStyle} width={140} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="var(--color-brand-primary)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartMessage message="Customer value data will appear here when pursuits have customers." />
              )}
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Top Customers by Bid Count">
              {topCustomersByCount.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(260, topCustomersByCount.length * 40)}>
                  <BarChart data={topCustomersByCount} layout="vertical" margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" horizontal={false} />
                    <XAxis type="number" tick={axisTickStyle} />
                    <YAxis type="category" dataKey="name" tick={axisTickStyle} width={140} />
                    <Tooltip formatter={(value) => String(value)} contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="var(--color-info)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartMessage message="Customer bid counts will appear here when pursuits have customers." />
              )}
            </ChartCard>

            <ChartCard title="Win / Loss by Customer">
              {winLossByCustomer.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(260, winLossByCustomer.length * 42)}>
                  <BarChart data={winLossByCustomer} layout="vertical" margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" horizontal={false} />
                    <XAxis type="number" tick={axisTickStyle} />
                    <YAxis type="category" dataKey="name" tick={axisTickStyle} width={140} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={legendStyle} />
                    <Bar dataKey="won" stackId="status" fill="var(--color-success)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="lost" stackId="status" fill="var(--color-danger)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartMessage message="Closed bid win/loss data will appear here when pursuits are marked won or lost." />
              )}
            </ChartCard>
          </div>

          <ChartCard title="Bids by Year">
            {byYear.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={byYear} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" />
                  <XAxis dataKey="year" tick={axisTickStyle} />
                  <YAxis yAxisId="left" tick={axisTickStyle} allowDecimals={false} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={axisTickStyle}
                    tickFormatter={(value) => formatCompactCurrency(Number(value))}
                  />
                  <Tooltip
                    formatter={(value, name) =>
                      name === "value" ? formatCurrency(Number(value)) : String(value)
                    }
                    contentStyle={tooltipStyle}
                  />
                  <Legend wrapperStyle={legendStyle} />
                  <Bar yAxisId="left" dataKey="count" name="Bid count" fill="var(--color-brand-primary)" radius={[6, 6, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="value" name="Total value" stroke="var(--color-warning)" strokeWidth={2.5} dot />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartMessage message="Year trend data will appear here once pursuits are available." />
            )}
          </ChartCard>

          <ChartCard title="All Pursuits">
            {filtered.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border-default bg-surface-base">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Pursuit name</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Customer</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Location</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Est. value</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Year</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {filtered.map((pursuit) => (
                      <tr key={pursuit.id} className="hover:bg-surface-overlay">
                        <td className="px-3 py-3 font-medium text-text-primary">
                          <Link href={`/quotes/pursuits/${pursuit.id}`} className="hover:text-brand-primary hover:underline">
                            {pursuit.project_name}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-text-secondary">{pursuit.owner_name ?? "-"}</td>
                        <td className="px-3 py-3 text-text-secondary">{pursuit.project_location ?? "-"}</td>
                        <td className="px-3 py-3 text-text-secondary">{PURSUIT_STATUS_LABELS[pursuit.status]}</td>
                        <td className="px-3 py-3 text-text-secondary">{formatCurrency(pursuit.estimated_value ?? 0)}</td>
                        <td className="px-3 py-3 text-text-secondary">{pursuitYear(pursuit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyChartMessage message="No pursuits match the current filters." />
            )}
          </ChartCard>
        </>
      )}
    </div>
  );
}

function topCustomers(
  pursuits: AnalyticsPursuit[],
  customerLabelMap: ReturnType<typeof buildCustomerLabelMap>,
  mode: "value" | "count"
) {
  const grouped = new Map<string, { name: string; value: number; count: number }>();

  for (const pursuit of pursuits) {
    const key = canonicalCustomerKey(pursuit.owner_name, customerLabelMap.acronymToBaseKey);
    const name = customerLabelMap.labelByKey.get(key) ?? "Unknown";
    const current = grouped.get(key) ?? { name, value: 0, count: 0 };
    current.value += pursuit.estimated_value ?? 0;
    current.count += 1;
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .sort((a, b) => (mode === "value" ? b.value - a.value : b.count - a.count))
    .slice(0, 10);
}

function buildCustomerLabelMap(pursuits: AnalyticsPursuit[]) {
  const baseKeyToLabels = new Map<string, Map<string, number>>();
  const acronymCandidates = new Map<string, Map<string, number>>();

  for (const pursuit of pursuits) {
    const trimmed = pursuit.owner_name?.trim();
    if (!trimmed) continue;

    const baseKey = normalizedBaseKey(trimmed);
    if (!baseKey) continue;

    const labels = baseKeyToLabels.get(baseKey) ?? new Map<string, number>();
    labels.set(trimmed, (labels.get(trimmed) ?? 0) + 1);
    baseKeyToLabels.set(baseKey, labels);

    const acronym = acronymForName(trimmed);
    if (acronym && acronym !== baseKey) {
      const candidates = acronymCandidates.get(acronym) ?? new Map<string, number>();
      candidates.set(baseKey, (candidates.get(baseKey) ?? 0) + 1);
      acronymCandidates.set(acronym, candidates);
    }
  }

  const acronymToBaseKey = new Map<string, string>();
  for (const [acronym, candidates] of acronymCandidates.entries()) {
    const winner = Array.from(candidates.entries()).sort((a, b) => b[1] - a[1])[0];
    if (winner) acronymToBaseKey.set(acronym, winner[0]);
  }

  const labelByKey = new Map<string, string>();
  labelByKey.set("unknown", "Unknown");

  for (const [baseKey, labels] of baseKeyToLabels.entries()) {
    const label = Array.from(labels.entries())
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return b[0].length - a[0].length;
      })[0]?.[0];
    if (label) labelByKey.set(baseKey, label);
  }

  return { acronymToBaseKey, labelByKey };
}

function canonicalCustomerKey(value: string | null, acronymToBaseKey: Map<string, string>) {
  const trimmed = value?.trim();
  if (!trimmed) return "unknown";

  const baseKey = normalizedBaseKey(trimmed);
  if (!baseKey) return "unknown";

  if (looksLikeAcronym(trimmed)) {
    return acronymToBaseKey.get(baseKey) ?? baseKey;
  }

  return baseKey;
}

function normalizedBaseKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[&.,/()-]+/g, " ")
    .replace(/\bcoolins\b/g, "cooling")
    .replace(/\bthe\b/g, " ")
    .replace(/\bincorporated\b/g, " ")
    .replace(/\binc\b/g, " ")
    .replace(/\bllc\b/g, " ")
    .replace(/\bl l c\b/g, " ")
    .replace(/\bcorp\b/g, " ")
    .replace(/\bcorporation\b/g, " ")
    .replace(/\bco\b/g, " ")
    .replace(/\bcompany\b/g, " ")
    .replace(/\bservices\b/g, " ")
    .replace(/\bservice\b/g, " ")
    .replace(/\bsystems\b/g, " ")
    .replace(/\bsystem\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function acronymForName(value: string) {
  const tokens = normalizedBaseKey(value).split(" ").filter((token) => token.length > 1);
  if (tokens.length === 0) return "";
  return tokens.map((token) => token[0]).join("");
}

function looksLikeAcronym(value: string) {
  return /^[A-Z0-9]{2,5}$/.test(value.trim());
}

function pursuitYear(pursuit: AnalyticsPursuit): string {
  if (pursuit.bid_year) return String(pursuit.bid_year);
  return "Unknown";
}

function sortYearLabel(a: string, b: string) {
  if (a === "Unknown") return 1;
  if (b === "Unknown") return -1;
  return a.localeCompare(b);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(value);
}

function MetricCard({
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

const tooltipStyle = {
  background: "var(--color-surface-raised)",
  border: "1px solid var(--color-border-default)",
  borderRadius: 8,
};

const legendStyle = { color: "var(--color-text-secondary)", fontSize: 12 };
const axisTickStyle = { fill: "var(--color-text-secondary)", fontSize: 11 };
