"use client";

import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import type { CrmDashboardMetrics } from "@/types/database";
import { CrmSubnav } from "@/components/crm/crm-subnav";
import { TaskWidget } from "@/components/crm/task-widget";
import { CRM_STAGES } from "@/lib/crm/stages";
import { CRM_ROLE_TYPE_LABELS, fmtCrmCurrency, fmtCrmDate } from "@/lib/crm/utils";

type DashboardClientProps = {
  metrics: CrmDashboardMetrics;
  role: string;
};

const STAGE_COLORS: Record<string, string> = {
  target_account: "#94a3b8", initial_contact: "#60a5fa", relationship_building: "#818cf8",
  opportunity_identified: "#fb923c", request_for_pricing: "#f59e0b", estimating: "#6366f1",
  proposal_sent: "#3b82f6", follow_up_negotiation: "#f97316", verbal_award: "#22c55e", po_received: "#16a34a",
};

const PIE_COLORS = ["#6366f1", "#3b82f6", "#22c55e", "#f59e0b", "#fb923c", "#ec4899", "#14b8a6", "#94a3b8"];

function MetricCard({ label, value, sublabel, href }: { label: string; value: string | number; sublabel?: string; href?: string }) {
  const content = (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
      <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-text-tertiary">{sublabel}</p>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

const TOOLTIP_STYLE = {
  background: "var(--color-surface-overlay)",
  border: "1px solid var(--color-border-default)",
  borderRadius: "12px",
  fontSize: 12,
};

export function DashboardClient({ metrics, role }: DashboardClientProps) {
  const totalPipelineValue = metrics.pipeline_by_stage.reduce((s, r) => s + r.total_value, 0);
  const totalOpenOpps = metrics.pipeline_by_stage.reduce((s, r) => s + r.count, 0);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <CrmSubnav role={role} />

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">RelationshipHub Dashboard</h1>
      </div>

      {/* Top metric cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Open Pipeline" value={fmtCrmCurrency(totalPipelineValue)} sublabel={`${totalOpenOpps} opportunities`} href="/crm/opportunities" />
        <MetricCard label="Stale Opportunities" value={metrics.stale_opportunities.length} sublabel="No activity 30+ days" />
        <MetricCard label="Tasks Due This Week" value={metrics.tasks_due_this_week.length} href="/crm/tasks" />
        <MetricCard label="Single-Contact Accounts" value={metrics.accounts_single_contact.length} sublabel="Relationship risk" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pipeline by stage */}
        <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Pipeline by Stage</h2>
          {metrics.pipeline_by_stage.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-tertiary">No open opportunities.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={metrics.pipeline_by_stage.map((d) => ({ name: CRM_STAGES[d.stage].label, value: d.total_value, stage: d.stage }))} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
                <XAxis type="number" tickFormatter={(v: unknown) => fmtCrmCurrency(v as number)} tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: unknown) => [fmtCrmCurrency(v as number), "Value"]} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {metrics.pipeline_by_stage.map((d) => (
                    <Cell key={d.stage} fill={STAGE_COLORS[d.stage] ?? "#6366f1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue by close month */}
        <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Expected Revenue by Close Month</h2>
          {metrics.revenue_by_close_month.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-tertiary">No close dates set on open opportunities.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={metrics.revenue_by_close_month} margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: unknown) => fmtCrmCurrency(v as number)} tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: unknown) => [fmtCrmCurrency(v as number), "Est. Revenue"]} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="total_value" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Contacts by role */}
        <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Contacts by Role</h2>
          {metrics.contacts_by_role.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-tertiary">No contacts yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={metrics.contacts_by_role.map((d) => ({ name: CRM_ROLE_TYPE_LABELS[d.role_type], value: d.count }))}
                  cx="40%"
                  cy="50%"
                  outerRadius={70}
                  dataKey="value"
                >
                  {metrics.contacts_by_role.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stale opportunities */}
        <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Stale Opportunities</h2>
          {metrics.stale_opportunities.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-tertiary">All opportunities have recent activity.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {metrics.stale_opportunities.map((opp) => (
                <Link
                  key={opp.id}
                  href={`/crm/opportunities/${opp.id}`}
                  className="flex items-center justify-between rounded-xl border border-border-default bg-surface-overlay p-3 text-sm hover:border-brand-primary/40"
                >
                  <div>
                    <p className="font-medium text-text-primary">{opp.project_name}</p>
                    <p className="text-xs text-text-tertiary">{opp.company_name} · Last: {fmtCrmDate(opp.last_activity_date)}</p>
                  </div>
                  <span className="rounded-full bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning shrink-0">
                    {opp.days_stale === 999 ? "Never" : `${opp.days_stale}d`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Open opps by account */}
        <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Open Opportunities by Account</h2>
          {metrics.open_opps_by_account.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-tertiary">No open opportunities.</p>
          ) : (
            <div className="space-y-2">
              {metrics.open_opps_by_account.slice(0, 8).map((row) => (
                <Link
                  key={row.account_id}
                  href={`/crm/accounts/${row.account_id}`}
                  className="flex items-center justify-between rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm hover:border-brand-primary/40"
                >
                  <span className="text-text-primary">{row.company_name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-tertiary">{row.count} opp{row.count !== 1 ? "s" : ""}</span>
                    <span className="font-medium text-text-primary">{fmtCrmCurrency(row.total_value)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tasks due this week */}
        <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Tasks Due This Week</h2>
            <Link href="/crm/tasks" className="text-xs text-brand-primary hover:underline">View all</Link>
          </div>
          <TaskWidget tasks={metrics.tasks_due_this_week} compact />
        </div>

        {/* PO issuers */}
        <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">PO Issuers</h2>
          {metrics.po_issuers.length === 0 ? (
            <p className="py-4 text-sm text-text-tertiary">No contacts flagged as PO issuers yet.</p>
          ) : (
            <div className="space-y-2">
              {metrics.po_issuers.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-text-primary font-medium">{c.display_name}</p>
                    <p className="text-xs text-text-tertiary">{c.company_name}</p>
                  </div>
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="text-xs text-brand-primary hover:underline">{c.email}</a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Estimating contacts by account */}
        <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Estimating Contacts by Account</h2>
          {metrics.estimating_contacts_by_account.length === 0 ? (
            <p className="py-4 text-sm text-text-tertiary">No contacts flagged for estimating yet.</p>
          ) : (
            <div className="space-y-3">
              {metrics.estimating_contacts_by_account.map((row) => (
                <div key={row.account_id}>
                  <Link href={`/crm/accounts/${row.account_id}`} className="text-xs font-medium text-brand-primary hover:underline">
                    {row.company_name}
                  </Link>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {row.contacts.map((c) => c.display_name).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Single-contact accounts */}
        {metrics.accounts_single_contact.length > 0 && (
          <div className="rounded-2xl border border-status-warning/20 bg-status-warning/5 p-5">
            <h2 className="mb-3 text-sm font-semibold text-text-primary">
              ⚠ Accounts with ≤1 Known Contact
            </h2>
            <p className="mb-3 text-xs text-text-tertiary">Relationship continuity risk — add more contacts.</p>
            <div className="space-y-1">
              {metrics.accounts_single_contact.map((a) => (
                <Link
                  key={a.id}
                  href={`/crm/accounts/${a.id}`}
                  className="flex items-center justify-between rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm hover:border-brand-primary/40"
                >
                  <span className="text-text-primary">{a.company_name}</span>
                  <span className="text-xs text-text-tertiary">{a.contact_count === 0 ? "No contacts" : "1 contact"}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
