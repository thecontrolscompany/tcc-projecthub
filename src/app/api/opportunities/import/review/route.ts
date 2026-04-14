import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findProjectMatchSuggestions } from "@/lib/opportunity-match";
import type { LegacyOpportunityImportRow, Project } from "@/types/database";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { supabase } = auth;
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batch_id");

  let batchQuery = supabase
    .from("legacy_opportunity_import_batches")
    .select("*")
    .order("imported_at", { ascending: false })
    .limit(10);

  if (batchId) {
    batchQuery = supabase
      .from("legacy_opportunity_import_batches")
      .select("*")
      .eq("id", batchId)
      .limit(1);
  }

  const { data: batches, error: batchError } = await batchQuery;
  if (batchError) {
    return handleTableError(batchError, "Legacy import review tables are not available yet. Run migrations 045 and 046.");
  }

  const selectedBatch = batchId ? batches?.[0] : batches?.[0];
  if (!selectedBatch) {
    return NextResponse.json({ batches: batches ?? [], selectedBatch: null, rows: [] });
  }

  const { data: rows, error: rowError } = await supabase
    .from("legacy_opportunity_import_rows")
    .select("*")
    .eq("batch_id", selectedBatch.id)
    .order("source_row_number", { ascending: true });

  if (rowError) {
    return handleTableError(rowError, "Unable to load staged import rows.");
  }

  const { data: projects, error: projectError } = await supabase
    .from("projects")
    .select("id, name, job_number, site_address, contract_price")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 400 });
  }

  const reviewRows = ((rows ?? []) as LegacyOpportunityImportRow[]).map((row) => ({
    ...row,
    project_matches: findProjectMatchSuggestions(row, (projects ?? []) as Project[]),
  }));

  return NextResponse.json({
    batches: batches ?? [],
    selectedBatch,
    rows: reviewRows,
  });
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
