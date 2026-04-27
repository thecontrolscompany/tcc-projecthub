import { createClient } from "@/lib/supabase/server";
import { PipelineClient } from "./pipeline-client";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .maybeSingle();
  const role = profile?.role ?? "pm";

  const { data: opportunities } = await supabase
    .from("crm_opportunities")
    .select(`
      id, opportunity_number, project_name, stage, estimated_value,
      estimated_gross_margin, probability, bid_due_date, expected_close_date,
      last_activity_date, market_type, next_step, created_at,
      account:crm_accounts!crm_opportunities_account_id_fkey(id, company_name),
      primary_contact:crm_contacts!crm_opportunities_primary_contact_id_fkey(id, display_name, role_type)
    `)
    .order("created_at", { ascending: false });

  return (
    <PipelineClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      opportunities={(opportunities ?? []) as any}
      role={role}
    />
  );
}
