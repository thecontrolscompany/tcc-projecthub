import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findProjectMatchSuggestions } from "@/lib/opportunity-match";
import type {
  LegacyOpportunityImportRow,
  OpportunityDocument,
  OpportunityEstimateSummary,
  OpportunityEquipmentGroup,
  OpportunityPricingItem,
  OpportunityScopeItem,
  Project,
} from "@/types/database";

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
    .not("review_status", "in", '("rejected","promoted")')
    .order("source_row_number", { ascending: true });

  if (rowError) {
    return handleTableError(rowError, "Unable to load staged import rows.");
  }

  // Count processed rows so the UI can offer a reset option when the queue is empty.
  const { count: processedCount } = await supabase
    .from("legacy_opportunity_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", selectedBatch.id)
    .in("review_status", ["rejected", "promoted"]);

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

  const rowIds = reviewRows.map((row) => row.id);

  const [documentsResult, pricingResult, scopeResult, equipmentResult, estimateResult] = await Promise.all([
    rowIds.length
      ? supabase
          .from("opportunity_documents")
          .select("*")
          .in("legacy_import_row_id", rowIds)
          .order("uploaded_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    rowIds.length
      ? supabase
          .from("opportunity_pricing_items")
          .select("*")
          .in("legacy_import_row_id", rowIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    rowIds.length
      ? supabase
          .from("opportunity_scope_items")
          .select("*")
          .in("legacy_import_row_id", rowIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    rowIds.length
      ? supabase
          .from("opportunity_equipment_groups")
          .select("*")
          .in("legacy_import_row_id", rowIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    rowIds.length
      ? supabase
          .from("opportunity_estimate_summaries")
          .select("*")
          .in("legacy_import_row_id", rowIds)
          .order("extracted_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const documents = ((documentsResult.data ?? []) as OpportunityDocument[]);
  const pricingItems = ((pricingResult.data ?? []) as OpportunityPricingItem[]);
  const scopeItems = ((scopeResult.data ?? []) as OpportunityScopeItem[]);
  const equipmentGroups = ((equipmentResult.data ?? []) as OpportunityEquipmentGroup[]);
  const estimateSummaries = ((estimateResult.data ?? []) as OpportunityEstimateSummary[]);

  function dedupePricingItems(items: OpportunityPricingItem[]): OpportunityPricingItem[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.legacy_import_row_id}|${item.label.toLowerCase()}|${item.amount ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const enrichedRows = reviewRows.map((row) => ({
    ...row,
    documents: documents.filter((document) => document.legacy_import_row_id === row.id),
    pricing_items: dedupePricingItems(pricingItems.filter((item) => item.legacy_import_row_id === row.id)),
    scope_items: scopeItems.filter((item) => item.legacy_import_row_id === row.id),
    equipment_groups: equipmentGroups.filter((item) => item.legacy_import_row_id === row.id),
    estimate_summary: estimateSummaries.find((item) => item.legacy_import_row_id === row.id) ?? null,
  }));

  const summary = {
    pending: enrichedRows.filter((row) => row.review_status === "pending").length,
    matched: enrichedRows.filter((row) => row.review_status === "matched").length,
    rejected: enrichedRows.filter((row) => row.review_status === "rejected").length,
    noSuggestions: enrichedRows.filter((row) => row.project_matches.length === 0).length,
  };

  return NextResponse.json({
    batches: batches ?? [],
    selectedBatch,
    rows: enrichedRows,
    summary,
    processedCount: processedCount ?? 0,
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
