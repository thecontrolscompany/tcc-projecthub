import { createClient } from "@/lib/supabase/server";
import { ContactsList } from "./contacts-list";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .maybeSingle();

  const role = profile?.role ?? "pm";

  const { data: contacts } = await supabase
    .from("crm_contacts")
    .select(`
      id, display_name, first_name, last_name, role_type, title,
      email, phone, is_active, confidence_level, influence_level,
      issues_purchase_orders, involved_in_estimating, involved_in_project_execution,
      account_id,
      account:crm_accounts!crm_contacts_account_id_fkey(id, company_name, type)
    `)
    .order("display_name", { ascending: true });

  return (
    <ContactsList
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contacts={(contacts ?? []) as any}
      role={role}
    />
  );
}
