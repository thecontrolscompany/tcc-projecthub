import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { AccountDetailClient } from "./account-detail-client";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, role")
    .maybeSingle();
  const role = profileData?.role ?? "pm";

  const [accountResult, activitiesResult, tasksResult] = await Promise.all([
    supabase
      .from("crm_accounts")
      .select(`
        *,
        relationship_owner:profiles!crm_accounts_relationship_owner_profile_id_fkey(id, full_name, email),
        contacts:crm_contacts(
          id, display_name, first_name, last_name, role_type, email, phone, mobile,
          influence_level, confidence_level, is_active, title,
          issues_purchase_orders, involved_in_estimating, involved_in_project_execution, notes
        ),
        opportunities:crm_opportunities(
          id, opportunity_number, project_name, stage,
          estimated_value, bid_due_date, expected_close_date, last_activity_date, probability
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
        contact:crm_contacts!crm_activities_contact_id_fkey(id, display_name),
        opportunity:crm_opportunities!crm_activities_opportunity_id_fkey(id, project_name, opportunity_number)
      `)
      .eq("account_id", id)
      .order("activity_date", { ascending: false })
      .limit(50),
    supabase
      .from("crm_tasks")
      .select(`
        *,
        assigned_to:profiles!crm_tasks_assigned_to_profile_id_fkey(id, full_name, email),
        opportunity:crm_opportunities!crm_tasks_opportunity_id_fkey(id, project_name, opportunity_number)
      `)
      .eq("account_id", id)
      .in("status", ["open", "in_progress"])
      .order("due_date", { ascending: true }),
  ]);

  if (accountResult.error || !accountResult.data) {
    notFound();
  }

  return (
    <AccountDetailClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      account={accountResult.data as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activities={(activitiesResult.data ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tasks={(tasksResult.data ?? []) as any}
      role={role}
      currentUserId={profileData?.id ?? ""}
    />
  );
}
