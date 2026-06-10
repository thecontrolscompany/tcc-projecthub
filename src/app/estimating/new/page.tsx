import { createClient } from "@/lib/supabase/server";
import { NewEstimateClient } from "./new-estimate-client";
import { normalizeEstimateScopeMode } from "@/modules/hvac-estimator/components/estimate/projectSettings";

export const dynamic = "force-dynamic";

type SearchParams = {
  opportunityId?: string;
  opportunity_id?: string;
};

function buildNextEstimateNumber(existingNumbers: Array<string | null>, year = new Date().getFullYear()) {
  const prefix = `EST-${year}-`;
  const max = existingNumbers.reduce((currentMax, value) => {
    if (!value?.startsWith(prefix)) return currentMax;
    const parsed = Number(value.slice(prefix.length));
    return Number.isFinite(parsed) ? Math.max(currentMax, parsed) : currentMax;
  }, 0);

  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

async function resolveDefaultOrganizationId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | null,
) {
  const { data: defaultOrgId } = await supabase.rpc("current_user_default_organization_id");
  if (typeof defaultOrgId === "string") return defaultOrgId;

  if (userId) {
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("profile_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membership?.organization_id) return membership.organization_id as string;
  }

  const { data: tccOrganization } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "tcc")
    .maybeSingle();

  return typeof tccOrganization?.id === "string" ? tccOrganization.id : null;
}

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const opportunityId = params.opportunityId ?? params.opportunity_id ?? null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentOrganizationId = await resolveDefaultOrganizationId(supabase, user?.id ?? null);

  let estimateNumberQuery = supabase
    .from("estimates")
    .select("number")
    .order("created_at", { ascending: false });

  if (currentOrganizationId) {
    estimateNumberQuery = estimateNumberQuery.eq("organization_id", currentOrganizationId);
  }

  const [accountsResult, estimatesResult] = await Promise.all([
    supabase
      .from("crm_accounts")
      .select("id, company_name")
      .order("company_name", { ascending: true }),
    estimateNumberQuery,
  ]);

  const nextEstimateNumber = buildNextEstimateNumber((estimatesResult.data ?? []).map((estimate) => estimate.number));

  let initialEstimate = {
    organizationId: currentOrganizationId,
    linkedOpportunityId: opportunityId,
    estimateNumber: nextEstimateNumber,
    opportunityNumber: "",
    projectName: "",
    customerAccountId: "",
    customer: "",
    notes: "",
    estimateScopeMode: normalizeEstimateScopeMode("installation"),
  };

  if (opportunityId) {
    const { data: opportunity } = await supabase
      .from("crm_opportunities")
      .select(`
        id, organization_id, opportunity_number, project_name, notes, account_id,
        account:crm_accounts!crm_opportunities_account_id_fkey(id, company_name)
      `)
      .eq("id", opportunityId)
      .maybeSingle();

    if (opportunity) {
      const account = Array.isArray(opportunity.account) ? opportunity.account[0] : opportunity.account;
      initialEstimate = {
        organizationId: opportunity.organization_id ?? initialEstimate.organizationId,
        linkedOpportunityId: opportunity.id,
        estimateNumber: nextEstimateNumber,
        opportunityNumber: opportunity.opportunity_number ?? "",
        projectName: opportunity.project_name ?? "",
        customerAccountId: opportunity.account_id ?? "",
        customer: account?.company_name ?? "",
        notes: opportunity.notes ?? "",
        estimateScopeMode: initialEstimate.estimateScopeMode,
      };
    }
  }

  return <NewEstimateClient initialEstimate={initialEstimate} accounts={accountsResult.data ?? []} />;
}
