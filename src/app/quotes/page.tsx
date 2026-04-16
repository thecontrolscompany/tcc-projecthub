import { createClient } from "@/lib/supabase/server";
import { QuotesPageClient } from "@/components/quotes-page-client";
import type { QuoteRequest } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role = "customer";

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    role = profile?.role ?? "customer";
  }

  if (role === "admin") {
    const { data, error } = await supabase
      .from("quote_requests")
      .select(
        "*, project:projects!quote_requests_project_id_fkey(name, job_number), linked_project:projects!quote_requests_linked_project_id_fkey(name, job_number)"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Unable to load quote pipeline:", error.message);
    }

    return <QuotesPageClient mode="admin" initialQuotes={(data as QuoteRequest[]) ?? []} />;
  }

  return <QuotesPageClient mode="public" />;
}
