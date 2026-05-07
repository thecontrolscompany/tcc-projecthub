"use client";

import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";

// Thin wrapper — all OpportunityHub pages share one unified subnav.
export function CrmSubnav({ role: _role }: { role: string }) {
  return <OpportunityHubSubnav />;
}
