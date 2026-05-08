"use client";

import { useState } from "react";
import Link from "next/link";
import type { CrmOpportunity, CrmActivity, CrmOpportunityStage } from "@/types/database";
import { CrmSubnav } from "@/components/crm/crm-subnav";
import { OpportunityStageBadge } from "@/components/crm/opportunity-stage-badge";
import { ContactBadge } from "@/components/crm/contact-badge";
import { ActivityLog } from "@/components/crm/activity-log";
import { ActivityQuickLog } from "@/components/crm/activity-quick-log";
import { CRM_STAGE_ORDER, CRM_STAGES } from "@/lib/crm/stages";
import { fmtCrmDate, fmtCrmCurrency } from "@/lib/crm/utils";

type Props = {
  opportunity: CrmOpportunity & {
    account?: { id: string; company_name: string; relationship_health: string } | null;
    primary_contact?: { id: string; display_name: string; role_type: string; email: string | null; phone: string | null } | null;
    estimator?: { id: string; full_name: string | null; email: string } | null;
    pm?: { id: string; full_name: string | null; email: string } | null;
    internal_owner?: { id: string; full_name: string | null; email: string } | null;
    opportunity_contacts?: Array<{
      id: string;
      contact_role_on_opportunity: string;
      contact: { id: string; display_name: string; role_type: string; confidence_level: string; email: string | null } | null;
    }>;
  };
  activities: CrmActivity[];
  role: string;
};

export function OpportunityDetailClient({ opportunity, activities: initialActivities, role }: Props) {
  const [activities, setActivities] = useState(initialActivities);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [currentStage, setCurrentStage] = useState<CrmOpportunityStage>(opportunity.stage);
  const isWriteRole = role === "admin" || role === "ops_manager";
  const estimatorUrl =
    "https://estimates.thecontrolscompany.com/?" +
    new URLSearchParams({
      opportunityId: opportunity.id,
      opportunityNumber: opportunity.opportunity_number ?? "",
      projectName: opportunity.project_name,
      customer: opportunity.account?.company_name ?? "",
    }).toString();

  async function handleStageChange(newStage: CrmOpportunityStage) {
    if (!isWriteRole || newStage === currentStage) return;
    setUpdatingStage(true);
    try {
      const res = await fetch(`/api/crm/opportunities/${opportunity.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (res.ok) setCurrentStage(newStage);
    } finally {
      setUpdatingStage(false);
    }
  }

  const stageMeta = CRM_STAGES[currentStage];
  const currentStageIndex = CRM_STAGE_ORDER.indexOf(currentStage);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <CrmSubnav role={role} />

      {/* Header */}
      <div className="mb-6">
        <Link href="/crm/opportunities" className="text-sm text-text-tertiary hover:text-text-primary">← Pipeline</Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">{opportunity.project_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-text-tertiary">
              <span>{opportunity.opportunity_number}</span>
              {opportunity.account && (
                <Link href={`/crm/accounts/${opportunity.account.id}`} className="text-brand-primary hover:underline">
                  {opportunity.account.company_name}
                </Link>
              )}
              {opportunity.market_type && <span>· {opportunity.market_type}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={estimatorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover"
            >
              Estimate in HVAC Estimator
            </a>
            <OpportunityStageBadge stage={currentStage} />
          </div>
        </div>
      </div>

      {/* Stage stepper */}
      <div className="mb-6 rounded-2xl border border-border-default bg-surface-raised p-4 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {CRM_STAGE_ORDER.filter((s) => s !== "closed_lost" && s !== "on_hold").map((s, i) => {
            const idx = CRM_STAGE_ORDER.indexOf(s);
            const isActive = s === currentStage;
            const isPast = idx < currentStageIndex && currentStage !== "closed_lost";
            return (
              <div key={s} className="flex items-center gap-1">
                <button
                  onClick={() => handleStageChange(s)}
                  disabled={!isWriteRole || updatingStage}
                  className={[
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    isActive ? "bg-brand-primary text-text-inverse" :
                    isPast ? "bg-status-success/10 text-status-success" :
                    "bg-surface-overlay text-text-tertiary hover:text-text-primary hover:bg-surface-overlay",
                    !isWriteRole ? "cursor-default" : "",
                  ].join(" ")}
                >
                  {CRM_STAGES[s].label}
                </button>
                {i < CRM_STAGE_ORDER.filter((s) => s !== "closed_lost" && s !== "on_hold").length - 1 && (
                  <span className="text-text-tertiary text-xs">›</span>
                )}
              </div>
            );
          })}
          <div className="ml-2 flex gap-1">
            <button
              onClick={() => handleStageChange("closed_lost")}
              disabled={!isWriteRole || updatingStage}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                currentStage === "closed_lost"
                  ? "bg-status-danger text-white"
                  : "bg-surface-overlay text-text-tertiary hover:text-text-primary"
              } ${!isWriteRole ? "cursor-default" : ""}`}
            >
              Lost
            </button>
            <button
              onClick={() => handleStageChange("on_hold")}
              disabled={!isWriteRole || updatingStage}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                currentStage === "on_hold"
                  ? "bg-surface-overlay text-text-primary border border-border-default"
                  : "bg-surface-overlay text-text-tertiary hover:text-text-primary"
              } ${!isWriteRole ? "cursor-default" : ""}`}
            >
              On Hold
            </button>
          </div>
        </div>
        <div className="mt-3 text-xs text-text-tertiary border-t border-border-default pt-3">
          <span className="font-medium text-text-secondary">Suggested next: </span>
          {stageMeta.suggestedNextAction}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: details + activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key details */}
          <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <h2 className="mb-4 text-sm font-semibold text-text-primary">Opportunity Details</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {opportunity.estimated_value != null && (
                <div>
                  <dt className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Est. Value</dt>
                  <dd className="mt-0.5 font-semibold text-text-primary">{fmtCrmCurrency(opportunity.estimated_value)}</dd>
                </div>
              )}
              {opportunity.estimated_gross_margin != null && (
                <div>
                  <dt className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Est. Gross Margin</dt>
                  <dd className="mt-0.5 font-semibold text-text-primary">{fmtCrmCurrency(opportunity.estimated_gross_margin)}</dd>
                </div>
              )}
              {opportunity.probability != null && (
                <div>
                  <dt className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Probability</dt>
                  <dd className="mt-0.5 text-text-primary">{opportunity.probability}%</dd>
                </div>
              )}
              {opportunity.bid_due_date && (
                <div>
                  <dt className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Bid Due</dt>
                  <dd className="mt-0.5 text-text-primary">{fmtCrmDate(opportunity.bid_due_date)}</dd>
                </div>
              )}
              {opportunity.expected_close_date && (
                <div>
                  <dt className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Expected Close</dt>
                  <dd className="mt-0.5 text-text-primary">{fmtCrmDate(opportunity.expected_close_date)}</dd>
                </div>
              )}
              {opportunity.lead_source && (
                <div>
                  <dt className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Lead Source</dt>
                  <dd className="mt-0.5 text-text-primary">{opportunity.lead_source}</dd>
                </div>
              )}
            </dl>
            {opportunity.next_step && (
              <div className="mt-4 border-t border-border-default pt-4">
                <dt className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1">Next Step</dt>
                <p className="text-sm text-text-secondary">{opportunity.next_step}</p>
              </div>
            )}
            {opportunity.notes && (
              <div className="mt-4 border-t border-border-default pt-4">
                <dt className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1">Notes</dt>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">{opportunity.notes}</p>
              </div>
            )}
          </div>

          {/* Activity */}
          {isWriteRole && (
            <ActivityQuickLog
              accountId={opportunity.account_id}
              opportunityId={opportunity.id}
              onLogged={(activity) => setActivities((prev) => [activity, ...prev])}
            />
          )}
          <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <h2 className="mb-4 text-sm font-semibold text-text-primary">Activity Log</h2>
            <ActivityLog activities={activities} showAccount emptyMessage="No activities logged for this opportunity." />
          </div>
        </div>

        {/* Right: people */}
        <div className="space-y-6">
          {/* Team */}
          <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <h2 className="mb-4 text-sm font-semibold text-text-primary">Team</h2>
            <div className="space-y-3 text-sm">
              {opportunity.primary_contact && (
                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1">Primary Contact</p>
                  <ContactBadge contact={{ ...opportunity.primary_contact, confidence_level: "confirmed" }} size="sm" />
                  {opportunity.primary_contact.email && (
                    <p className="mt-1 text-xs text-text-tertiary">{opportunity.primary_contact.email}</p>
                  )}
                </div>
              )}
              {opportunity.estimator && (
                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1">Estimator</p>
                  <p className="text-text-secondary">{opportunity.estimator.full_name ?? opportunity.estimator.email}</p>
                </div>
              )}
              {opportunity.pm && (
                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1">PM</p>
                  <p className="text-text-secondary">{opportunity.pm.full_name ?? opportunity.pm.email}</p>
                </div>
              )}
              {opportunity.internal_owner && (
                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1">Internal Owner</p>
                  <p className="text-text-secondary">{opportunity.internal_owner.full_name ?? opportunity.internal_owner.email}</p>
                </div>
              )}
            </div>
          </div>

          {/* Additional contacts */}
          {(opportunity.opportunity_contacts?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
              <h2 className="mb-4 text-sm font-semibold text-text-primary">All Contacts</h2>
              <div className="space-y-2">
                {opportunity.opportunity_contacts?.map((oc) =>
                  oc.contact ? (
                    <div key={oc.id} className="flex items-center justify-between gap-2">
                      <ContactBadge
                        contact={{
                          id: oc.contact.id,
                          display_name: oc.contact.display_name,
                          role_type: oc.contact.role_type as import("@/types/database").CrmContactRoleType,
                          confidence_level: oc.contact.confidence_level as "confirmed" | "partially_confirmed" | "needs_verification",
                        }}
                        size="sm"
                      />
                      <span className="text-xs text-text-tertiary capitalize">
                        {oc.contact_role_on_opportunity.replace("_", " ")}
                      </span>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* Stage guidance */}
          <div className="rounded-2xl border border-border-default bg-surface-overlay p-5">
            <h2 className="mb-3 text-sm font-semibold text-text-primary">Stage: {stageMeta.label}</h2>
            <div className="space-y-3 text-xs text-text-secondary">
              <div>
                <p className="font-medium text-text-tertiary uppercase tracking-wide mb-1">Exit Criteria</p>
                <p>{stageMeta.exitCriteria}</p>
              </div>
              {stageMeta.requiredFields.length > 0 && (
                <div>
                  <p className="font-medium text-text-tertiary uppercase tracking-wide mb-1">Required Fields</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {stageMeta.requiredFields.map((f) => (
                      <li key={f}>{f.replace(/_/g, " ")}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
