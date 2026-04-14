import { notFound, redirect } from "next/navigation";
import { OpportunityDetailClient } from "@/components/opportunity-detail-client";
import { createClient } from "@/lib/supabase/server";
import type { QuoteRequest } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function QuoteOpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data } = await supabase
    .from("quote_requests")
    .select("*, project:projects(name, job_number)")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  return <OpportunityDetailClient initialQuote={data as QuoteRequest} />;
}
