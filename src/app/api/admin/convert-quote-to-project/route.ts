import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { format, startOfMonth } from "date-fns";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const profile = await resolveUserRole(user);
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const quoteId = typeof body?.quote_id === "string" ? body.quote_id : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const siteAddress = typeof body?.site_address === "string" ? body.site_address.trim() : "";
  const estimatedIncome = Number(body?.estimated_income ?? 0);

  if (!quoteId) {
    return NextResponse.json({ error: "Quote id is required." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Project name is required." }, { status: 400 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data: quote, error: quoteError } = await adminClient
      .from("quote_requests")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      throw new Error(quoteError?.message ?? "Quote not found.");
    }

    if (quote.project_id) {
      return NextResponse.json({ error: "Quote is already linked to a project." }, { status: 400 });
    }

    let customerId: string | null = null;
    const companyName = String(quote.company_name ?? "").trim();

    if (companyName) {
      const { data: existingCustomers } = await adminClient
        .from("customers")
        .select("id, name")
        .ilike("name", companyName)
        .limit(1);

      customerId = existingCustomers?.[0]?.id ?? null;

      if (!customerId) {
        const { data: newCustomer, error: customerError } = await adminClient
          .from("customers")
          .insert({
            name: companyName,
            contact_email: quote.contact_email ?? null,
          })
          .select("id")
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }
    }

    const year = new Date().getFullYear();
    const { data: lastProjects, error: lastProjectError } = await adminClient
      .from("projects")
      .select("job_number")
      .like("job_number", `${year}-%`)
      .order("job_number", { ascending: false })
      .limit(1);

    if (lastProjectError) throw lastProjectError;

    const last = lastProjects?.[0]?.job_number ?? `${year}-000`;
    const sequence = Number(String(last).split("-")[1] ?? "0") + 1;
    const jobNumber = `${year}-${String(sequence).padStart(3, "0")}`;
    const projectName = `${jobNumber} - ${name}`;

    const { data: newProject, error: projectError } = await adminClient
      .from("projects")
      .insert({
        name: projectName,
        job_number: jobNumber,
        customer_id: customerId,
        site_address: siteAddress || quote.site_address || null,
        estimated_income: Number.isFinite(estimatedIncome) ? estimatedIncome : 0,
        contract_price: Number.isFinite(estimatedIncome) ? estimatedIncome : 0,
        source_estimate_id: null,
        is_active: true,
      })
      .select("id")
      .single();

    if (projectError) throw projectError;

    const { error: periodError } = await adminClient.from("billing_periods").insert({
      project_id: newProject.id,
      period_month: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      estimated_income_snapshot: Number.isFinite(estimatedIncome) ? estimatedIncome : 0,
      pct_complete: 0,
      prev_billed: 0,
    });
    if (periodError) throw periodError;

    const { error: updateQuoteError } = await adminClient
      .from("quote_requests")
      .update({ project_id: newProject.id })
      .eq("id", quoteId);

    if (updateQuoteError) throw updateQuoteError;

    return NextResponse.json({ project_id: newProject.id, job_number: jobNumber });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to convert quote to project." },
      { status: 500 }
    );
  }
}
