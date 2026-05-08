import { notFound } from "next/navigation";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { canReadEstimates, ESTIMATE_SELECT } from "@/lib/estimates/api";
import type { EstimateRecord } from "@/types/database";
import { EstimateDetailClient } from "./estimate-detail-client";

export const dynamic = "force-dynamic";

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const profile = await resolveUserRole(user);
  if (!canReadEstimates(profile?.role ?? "")) notFound();

  const { data: estimate, error } = await supabase
    .from("estimates")
    .select(ESTIMATE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !estimate) notFound();

  return (
    <div className="mx-auto w-full max-w-none px-2 py-2 md:px-3 md:py-3">
      <OpportunityHubSubnav />
      <EstimateDetailClient estimate={estimate as EstimateRecord} />
    </div>
  );
}
