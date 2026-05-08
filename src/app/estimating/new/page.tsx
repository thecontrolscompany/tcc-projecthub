import { createClient } from "@/lib/supabase/server";
import { NewEstimateClient } from "./new-estimate-client";

export const dynamic = "force-dynamic";

type SearchParams = {
  opportunityId?: string;
  opportunity_id?: string;
};

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const opportunityId = params.opportunityId ?? params.opportunity_id ?? null;
  const supabase = await createClient();

  const { data: organizationId } = await supabase.rpc("current_user_default_organization_id");

  let initialEstimate = {
    organizationId: typeof organizationId === "string" ? organizationId : null,
    linkedOpportunityId: opportunityId,
    opportunityNumber: "",
    projectName: "",
    customer: "",
    notes: "",
  };

  if (opportunityId) {
    const { data: opportunity } = await supabase
      .from("crm_opportunities")
      .select(`
        id, organization_id, opportunity_number, project_name, notes,
        account:crm_accounts!crm_opportunities_account_id_fkey(company_name)
      `)
      .eq("id", opportunityId)
      .maybeSingle();

    if (opportunity) {
      const account = Array.isArray(opportunity.account) ? opportunity.account[0] : opportunity.account;
      initialEstimate = {
        organizationId: opportunity.organization_id ?? initialEstimate.organizationId,
        linkedOpportunityId: opportunity.id,
        opportunityNumber: opportunity.opportunity_number ?? "",
        projectName: opportunity.project_name ?? "",
        customer: account?.company_name ?? "",
        notes: opportunity.notes ?? "",
      };
    }
  }

  return <NewEstimateClient initialEstimate={initialEstimate} />;
}
