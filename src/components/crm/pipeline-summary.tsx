"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { CrmOpportunityStage } from "@/types/database";
import { CRM_STAGES } from "@/lib/crm/stages";
import { fmtCrmCurrency } from "@/lib/crm/utils";

type PipelineSummaryProps = {
  data: Array<{
    stage: CrmOpportunityStage;
    count: number;
    total_value: number;
  }>;
};

const STAGE_COLORS: Partial<Record<CrmOpportunityStage, string>> = {
  target_account: "#94a3b8",
  initial_contact: "#60a5fa",
  relationship_building: "#818cf8",
  opportunity_identified: "#fb923c",
  request_for_pricing: "#f59e0b",
  estimating: "#6366f1",
  proposal_sent: "#3b82f6",
  follow_up_negotiation: "#f97316",
  verbal_award: "#22c55e",
  po_received: "#16a34a",
};

export function PipelineSummary({ data }: PipelineSummaryProps) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-text-tertiary">No open opportunities.</p>;
  }

  const chartData = data.map((d) => ({
    name: CRM_STAGES[d.stage].label,
    stage: d.stage,
    count: d.count,
    value: d.total_value,
  }));

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <XAxis
            type="number"
            tickFormatter={(v: unknown) => fmtCrmCurrency(v as number)}
            tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: unknown) => [fmtCrmCurrency(value as number), "Pipeline Value"]}
            contentStyle={{ background: "var(--color-surface-overlay)", border: "1px solid var(--color-border-default)", borderRadius: "12px", fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] ?? "#6366f1"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-xs font-medium text-text-tertiary uppercase tracking-wide">
              <th className="pb-2 pr-4">Stage</th>
              <th className="pb-2 pr-4 text-right">Opps</th>
              <th className="pb-2 text-right">Pipeline Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {data.map((row) => (
              <tr key={row.stage}>
                <td className="py-2 pr-4 text-text-primary">{CRM_STAGES[row.stage].label}</td>
                <td className="py-2 pr-4 text-right text-text-secondary">{row.count}</td>
                <td className="py-2 text-right font-medium text-text-primary">{fmtCrmCurrency(row.total_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
