"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { CrmOpportunity, CrmOpportunityStage } from "@/types/database";
import { CrmSubnav } from "@/components/crm/crm-subnav";
import { OpportunityStageBadge } from "@/components/crm/opportunity-stage-badge";
import { PipelineSummary } from "@/components/crm/pipeline-summary";
import { CRM_STAGE_ORDER, CRM_STAGES, OPEN_STAGES } from "@/lib/crm/stages";
import { fmtCrmDate, fmtCrmCurrency, daysSince } from "@/lib/crm/utils";

type OppListItem = Pick<
  CrmOpportunity,
  "id" | "opportunity_number" | "project_name" | "stage" | "estimated_value" |
  "probability" | "bid_due_date" | "expected_close_date" | "last_activity_date" |
  "market_type" | "next_step"
> & {
  account?: { id: string; company_name: string } | null;
  primary_contact?: { id: string; display_name: string; role_type: string } | null;
};

type PipelineClientProps = {
  opportunities: OppListItem[];
  role: string;
};

const INPUT = "rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

export function PipelineClient({ opportunities, role }: PipelineClientProps) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<CrmOpportunityStage | "open" | "">("");
  const [showChart, setShowChart] = useState(false);
  const isWriteRole = role === "admin" || role === "ops_manager";

  const filtered = useMemo(() => {
    return opportunities.filter((opp) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !opp.project_name.toLowerCase().includes(q) &&
          !opp.account?.company_name.toLowerCase().includes(q) &&
          !opp.opportunity_number.toLowerCase().includes(q)
        ) return false;
      }
      if (stageFilter === "open") {
        if (!OPEN_STAGES.includes(opp.stage)) return false;
      } else if (stageFilter) {
        if (opp.stage !== stageFilter) return false;
      }
      return true;
    });
  }, [opportunities, search, stageFilter]);

  const pipelineByStage = useMemo(() => {
    const map = new Map<CrmOpportunityStage, { count: number; total_value: number }>();
    for (const opp of opportunities) {
      if (!OPEN_STAGES.includes(opp.stage)) continue;
      const existing = map.get(opp.stage) ?? { count: 0, total_value: 0 };
      existing.count++;
      existing.total_value += opp.estimated_value ?? 0;
      map.set(opp.stage, existing);
    }
    return OPEN_STAGES
      .filter((s) => map.has(s))
      .map((s) => ({ stage: s, ...map.get(s)! }));
  }, [opportunities]);

  const totalValue = filtered.reduce((sum, o) => sum + (o.estimated_value ?? 0), 0);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <CrmSubnav role={role} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Pipeline</h1>
          <p className="text-sm text-text-tertiary">
            {filtered.length} opportunities · {fmtCrmCurrency(totalValue)} pipeline value
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowChart((p) => !p)}
            className="rounded-xl border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-surface-overlay"
          >
            {showChart ? "Hide Chart" : "Pipeline Chart"}
          </button>
          {isWriteRole && (
            <Link
              href="/crm/opportunities/new"
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover"
            >
              + New Opportunity
            </Link>
          )}
        </div>
      </div>

      {showChart && (
        <div className="mb-6 rounded-2xl border border-border-default bg-surface-raised p-5">
          <PipelineSummary data={pipelineByStage} />
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search opportunities…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${INPUT} w-64`}
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as CrmOpportunityStage | "open" | "")}
          className={INPUT}
        >
          <option value="">All Stages</option>
          <option value="open">Open Only</option>
          <optgroup label="─────">
            {CRM_STAGE_ORDER.map((s) => (
              <option key={s} value={s}>{CRM_STAGES[s].label}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-tertiary">No opportunities match your filters.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((opp) => {
            const stale = daysSince(opp.last_activity_date);
            const bidDueSoon = opp.bid_due_date &&
              new Date(opp.bid_due_date) > new Date() &&
              (new Date(opp.bid_due_date).getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000;

            return (
              <Link
                key={opp.id}
                href={`/crm/opportunities/${opp.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-border-default bg-surface-raised p-4 transition hover:border-brand-primary/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-text-primary text-sm">{opp.project_name}</p>
                    <span className="text-xs text-text-tertiary">{opp.opportunity_number}</span>
                    {stale !== null && stale > 30 && (
                      <span className="rounded-full bg-status-warning/10 px-1.5 py-0.5 text-xs text-status-warning">
                        {stale}d stale
                      </span>
                    )}
                    {bidDueSoon && (
                      <span className="rounded-full bg-status-danger/10 px-1.5 py-0.5 text-xs text-status-danger">
                        Bid due {fmtCrmDate(opp.bid_due_date!)}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-text-tertiary">
                    {opp.account && <span>{opp.account.company_name}</span>}
                    {opp.market_type && <span>· {opp.market_type}</span>}
                    {opp.next_step && <span>· Next: {opp.next_step}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {opp.estimated_value != null && (
                    <span className="text-sm font-medium text-text-primary">{fmtCrmCurrency(opp.estimated_value)}</span>
                  )}
                  <OpportunityStageBadge stage={opp.stage} size="sm" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
