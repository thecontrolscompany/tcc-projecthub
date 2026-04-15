import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const reviewDecisionSchema = z.object({
  import_row_id: z.string().uuid("Import row id is required."),
  selected_action: z.enum(["link_project", "standalone", "reject", "merge_pursuit"]),
  selected_project_id: z.string().uuid().nullable().optional(),
  selected_pursuit_id: z.string().uuid().nullable().optional(),
  notes: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = reviewDecisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const { supabase, user } = auth;

  // Load the import row so we can promote it.
  const { data: importRow, error: rowFetchError } = await supabase
    .from("legacy_opportunity_import_rows")
    .select("*")
    .eq("id", parsed.data.import_row_id)
    .single();

  if (rowFetchError || !importRow) {
    return handleTableError(rowFetchError, "Import row not found.");
  }

  if (parsed.data.selected_action === "reject") {
    const { error } = await supabase
      .from("legacy_opportunity_import_rows")
      .update({ review_status: "rejected" })
      .eq("id", importRow.id);

    if (error) return handleTableError(error, "Unable to reject import row.");
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.selected_action === "merge_pursuit") {
    const targetPursuitId = parsed.data.selected_pursuit_id;
    if (!targetPursuitId) {
      return NextResponse.json({ error: "selected_pursuit_id is required for merge_pursuit." }, { status: 400 });
    }

    const { data: quoteRequest, error: quoteError } = await supabase
      .from("quote_requests")
      .insert({
        pursuit_id: targetPursuitId,
        company_name: importRow.company_name ?? "Unknown",
        contact_name: importRow.contact_name ?? null,
        project_description: importRow.legacy_opportunity_name ?? importRow.company_name ?? "Legacy opportunity",
        site_address: importRow.project_location ?? null,
        estimated_value: importRow.amount ?? null,
        bid_date: importRow.bid_date ?? null,
        proposal_date: importRow.proposal_date ?? null,
        opportunity_number: importRow.job_number ?? null,
        project_id: null,
        notes: importRow.notes ?? null,
        status: "new",
      })
      .select("id")
      .single();

    if (quoteError || !quoteRequest) {
      return handleTableError(quoteError, "Unable to promote import row to opportunity.");
    }

    await supabase
      .from("legacy_opportunity_import_rows")
      .update({
        review_status: "promoted",
        promoted_quote_request_id: quoteRequest.id,
        pursuit_id: targetPursuitId,
      })
      .eq("id", importRow.id);

    if (importRow.pursuit_id && importRow.pursuit_id !== targetPursuitId) {
      const { count } = await supabase
        .from("quote_requests")
        .select("id", { count: "exact", head: true })
        .eq("pursuit_id", importRow.pursuit_id);

      if ((count ?? 0) === 0) {
        await supabase.from("pursuits").delete().eq("id", importRow.pursuit_id);
      }
    }

    await supabase.from("legacy_opportunity_link_reviews").insert({
      import_row_id: importRow.id,
      selected_project_id: null,
      selected_pursuit_id: targetPursuitId,
      selected_action: "merge_pursuit",
      reviewed_by: user.id,
      notes: parsed.data.notes || null,
    });

    return NextResponse.json({ ok: true, quote_request_id: quoteRequest.id, pursuit_id: targetPursuitId });
  }

  // Non-reject: promote to quote_request.
  // The pursuit was created when the package was staged; ensure it exists.
  let pursuitId: string = importRow.pursuit_id;

  if (!pursuitId) {
    // Fallback: create pursuit now if staging somehow skipped it.
    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuits")
      .insert({
        project_name: importRow.legacy_opportunity_name ?? importRow.company_name ?? "Unknown Project",
        owner_name: importRow.company_name ?? null,
        project_location: importRow.project_location ?? null,
        status: "active",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (pursuitError || !pursuit) {
      return handleTableError(pursuitError, "Unable to create pursuit for import row.");
    }

    pursuitId = pursuit.id;
  }

  // Determine the project link.
  const projectId =
    parsed.data.selected_action === "link_project" ? (parsed.data.selected_project_id ?? null) : null;

  // If linking to a project, mark the pursuit as awarded and link it.
  if (projectId) {
    await supabase
      .from("pursuits")
      .update({ status: "awarded", linked_project_id: projectId })
      .eq("id", pursuitId);
  }

  // Create the quote_request promoted from the import row.
  const { data: quoteRequest, error: quoteError } = await supabase
    .from("quote_requests")
    .insert({
      pursuit_id: pursuitId,
      company_name: importRow.company_name ?? "Unknown",
      contact_name: importRow.contact_name ?? null,
      project_description: importRow.legacy_opportunity_name ?? importRow.company_name ?? "Legacy opportunity",
      site_address: importRow.project_location ?? null,
      estimated_value: importRow.amount ?? null,
      bid_date: importRow.bid_date ?? null,
      proposal_date: importRow.proposal_date ?? null,
      opportunity_number: importRow.job_number ?? null,
      project_id: projectId,
      notes: importRow.notes ?? null,
      status: projectId ? "won" : "new",
    })
    .select("id")
    .single();

  if (quoteError || !quoteRequest) {
    return handleTableError(quoteError, "Unable to promote import row to opportunity.");
  }

  // Mark the import row as promoted and record the created quote_request.
  const { error: updateError } = await supabase
    .from("legacy_opportunity_import_rows")
    .update({
      review_status: "promoted",
      promoted_quote_request_id: quoteRequest.id,
      pursuit_id: pursuitId,
    })
    .eq("id", importRow.id);

  if (updateError) {
    return handleTableError(updateError, "Promoted successfully but failed to update import row status.");
  }

  // Record the review decision for audit trail.
  await supabase.from("legacy_opportunity_link_reviews").insert({
    import_row_id: importRow.id,
    selected_project_id: projectId,
    selected_pursuit_id: pursuitId,
    selected_action: parsed.data.selected_action,
    reviewed_by: user.id,
    notes: parsed.data.notes || null,
  });

  return NextResponse.json({ ok: true, quote_request_id: quoteRequest.id, pursuit_id: pursuitId });
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }

  return { supabase, user };
}

function handleTableError(error: { code?: string; message?: string } | null, fallbackMessage: string) {
  if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
    return NextResponse.json({ error: fallbackMessage, migrationRequired: true }, { status: 409 });
  }

  return NextResponse.json({ error: error?.message ?? fallbackMessage }, { status: 400 });
}
