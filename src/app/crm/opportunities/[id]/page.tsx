import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { OpportunityDetailClient } from "./opportunity-detail-client";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .maybeSingle();
  const role = profile?.role ?? "pm";

  const [oppResult, activitiesResult] = await Promise.all([
    supabase
      .from("crm_opportunities")
      .select(`
        *,
        account:crm_accounts!crm_opportunities_account_id_fkey(id, company_name, relationship_health),
        primary_contact:crm_contacts!crm_opportunities_primary_contact_id_fkey(id, display_name, role_type, email, phone),
        estimator:profiles!crm_opportunities_estimator_profile_id_fkey(id, full_name, email),
        pm:profiles!crm_opportunities_pm_profile_id_fkey(id, full_name, email),
        internal_owner:profiles!crm_opportunities_internal_owner_profile_id_fkey(id, full_name, email),
        opportunity_contacts:crm_opportunity_contacts(
          id, contact_role_on_opportunity,
          contact:crm_contacts!crm_opportunity_contacts_contact_id_fkey(id, display_name, role_type, confidence_level, email)
        )
      `)
      .eq("id", id)
      .single(),
    supabase
      .from("crm_activities")
      .select(`
        id, activity_type, activity_date, summary, key_decisions,
        follow_up_actions, follow_up_due_date, attendees_text,
        account_id, contact_id, opportunity_id, logged_by_profile_id, created_at, updated_at,
        logged_by:profiles!crm_activities_logged_by_profile_id_fkey(id, full_name, email),
        contact:crm_contacts!crm_activities_contact_id_fkey(id, display_name)
      `)
      .eq("opportunity_id", id)
      .order("activity_date", { ascending: false })
      .limit(30),
  ]);

  if (oppResult.error || !oppResult.data) notFound();

  return (
    <OpportunityDetailClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      opportunity={oppResult.data as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activities={(activitiesResult.data ?? []) as any}
      role={role}
    />
  );
}
