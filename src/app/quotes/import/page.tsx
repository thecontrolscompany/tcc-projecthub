import { redirect } from "next/navigation";
import { LegacyOpportunityImportWorkspace } from "@/components/legacy-opportunity-import-workspace";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OpportunityImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role = "customer";

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    role = profile?.role ?? "customer";
  }

  if (role !== "admin") {
    redirect("/quotes");
  }

  return <LegacyOpportunityImportWorkspace />;
}
