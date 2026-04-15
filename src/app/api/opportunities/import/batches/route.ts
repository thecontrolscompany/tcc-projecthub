import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  createMappedRecord,
  inferImportMapping,
  type ParsedImportPreview,
} from "@/lib/opportunity-import";

const previewSchema = z.object({
  delimiter: z.enum(["comma", "tab"]),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

const createBatchSchema = z.object({
  source_name: z.string().trim().min(1, "Source name is required."),
  source_file_name: z.string().trim().optional(),
  source_file_size_bytes: z.number().nonnegative().optional(),
  notes: z.string().trim().optional(),
  preview: previewSchema,
});

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { supabase } = auth;
  const { data, error } = await supabase
    .from("legacy_opportunity_import_batches")
    .select("*")
    .order("imported_at", { ascending: false })
    .limit(10);

  if (error) {
    return handleTableError(error, "Legacy import tables are not available yet. Run migrations 045 and 046.");
  }

  const batches = data ?? [];

  const batchIds = batches.map((b) => b.id);
  const pendingCounts: Record<string, number> = {};

  if (batchIds.length > 0) {
    const { data: pendingRows } = await supabase
      .from("legacy_opportunity_import_rows")
      .select("batch_id")
      .in("batch_id", batchIds)
      .eq("review_status", "pending");

    for (const row of pendingRows ?? []) {
      pendingCounts[row.batch_id] = (pendingCounts[row.batch_id] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    batches: batches.map((b) => ({ ...b, pending_row_count: pendingCounts[b.id] ?? 0 })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = createBatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const { supabase, user } = auth;
  const preview = parsed.data.preview as ParsedImportPreview;
  const mapping = inferImportMapping(preview.headers);

  const { data: batch, error: batchError } = await supabase
    .from("legacy_opportunity_import_batches")
    .insert({
      source_name: parsed.data.source_name,
      source_file_name: parsed.data.source_file_name ?? null,
      source_file_size_bytes: parsed.data.source_file_size_bytes ?? null,
      imported_by: user.id,
      row_count: preview.rows.length,
      notes: parsed.data.notes || null,
      source_metadata: {
        delimiter: preview.delimiter,
        headers: preview.headers,
      },
    })
    .select("*")
    .single();

  if (batchError || !batch) {
    return handleTableError(batchError, "Unable to create import batch.");
  }

  const rows = preview.rows.map((row, index) => {
    const normalized = createMappedRecord(preview.headers, row, mapping);
    const validationIssues: string[] = [];

    if (!normalized.opportunity_name) validationIssues.push("Missing opportunity name");
    if (!normalized.company_name) validationIssues.push("Missing company");
    if (!normalized.amount) validationIssues.push("No amount");

    return {
      batch_id: batch.id,
      source_row_number: index + 2,
      source_external_id: null,
      legacy_opportunity_name: normalized.opportunity_name || null,
      company_name: normalized.company_name || null,
      contact_name: normalized.contact_name || null,
      estimator_name: normalized.estimator_name || null,
      project_location: normalized.project_location || null,
      job_number: normalized.job_number || null,
      bid_date: normalized.bid_date || null,
      proposal_date: normalized.proposal_date || null,
      amount: parseCurrency(normalized.amount),
      status: normalized.status || null,
      outcome: normalized.status || null,
      notes: normalized.notes || null,
      raw_payload: Object.fromEntries(preview.headers.map((header, headerIndex) => [header, row[headerIndex] ?? ""])),
      normalized_payload: normalized,
      validation_issues: validationIssues,
    };
  });

  const { error: rowError } = await supabase.from("legacy_opportunity_import_rows").insert(rows);
  if (rowError) {
    await supabase.from("legacy_opportunity_import_batches").delete().eq("id", batch.id);
    return handleTableError(rowError, "Unable to stage import rows.");
  }

  return NextResponse.json({ batch });
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

function parseCurrency(value: string) {
  const cleaned = value.replace(/[$,]/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function handleTableError(error: { code?: string; message?: string } | null, fallbackMessage: string) {
  if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
    return NextResponse.json({ error: fallbackMessage, migrationRequired: true }, { status: 409 });
  }

  return NextResponse.json({ error: error?.message ?? fallbackMessage }, { status: 400 });
}
