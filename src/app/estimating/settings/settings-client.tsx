"use client";

import Link from "next/link";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import { AiConnectionsContent } from "@/modules/hvac-estimator/components/estimate/AiConnectionsContent";

type Props = {
  organizationId: string;
};

export function EstimatingSettingsClient({ organizationId }: Props) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <OpportunityHubSubnav />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/estimating" className="text-sm font-semibold text-text-secondary hover:text-text-primary">
            Back to Estimating
          </Link>
          <h1 className="mt-2 font-heading text-2xl font-bold text-text-primary">Estimating AI Settings</h1>
          <p className="mt-1 max-w-3xl text-sm text-text-secondary">
            Connect organization-wide AI providers here. The estimator parser and future ProjectHub AI tools will reuse these saved connections.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-border-default bg-surface-raised shadow-sm">
        <div className="border-b border-border-default px-6 py-5">
          <div className="text-sm font-semibold text-text-primary">Organization AI connections</div>
          <div className="mt-1 text-sm text-text-secondary">
            Keys are stored per organization. You can add one connection per provider and reuse them across estimating workflows.
          </div>
        </div>
        <AiConnectionsContent organizationId={organizationId} />
      </div>
    </div>
  );
}
