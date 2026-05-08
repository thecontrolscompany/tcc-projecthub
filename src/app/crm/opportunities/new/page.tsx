import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NewOpportunityClient } from "./new-opportunity-client";

export const dynamic = "force-dynamic";

export default async function NewOpportunityPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role ?? "pm";

  if (role !== "admin" && role !== "ops_manager") {
    redirect("/crm/opportunities");
  }

  const [accountsResult, contactsResult, profilesResult] = await Promise.all([
    supabase
      .from("crm_accounts")
      .select("id, company_name")
      .order("company_name", { ascending: true }),
    supabase
      .from("crm_contacts")
      .select("id, account_id, display_name, role_type")
      .eq("is_active", true)
      .order("display_name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["admin", "ops_manager", "pm"])
      .order("full_name", { ascending: true }),
  ]);

  return (
    <NewOpportunityClient
      accounts={accountsResult.data ?? []}
      contacts={contactsResult.data ?? []}
      profiles={profilesResult.data ?? []}
      role={role}
    />
  );
}
