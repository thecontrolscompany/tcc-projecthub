import { createClient } from "@/lib/supabase/server";
import { NewEstimateClient } from "./new-estimate-client";

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

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const opportunityId = params.opportunityId ?? params.opportunity_id ?? null;
  const supabase = await createClient();

  const { data: organizationId } = await supabase.rpc("current_user_default_organization_id");
  const currentOrganizationId = typeof organizationId === "string" ? organizationId : null;

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
      };
    }
  }

  return <NewEstimateClient initialEstimate={initialEstimate} accounts={accountsResult.data ?? []} />;
}
