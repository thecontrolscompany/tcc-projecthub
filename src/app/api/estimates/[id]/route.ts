import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { summarizeHvacEstimate, type HvacEstimateBody } from "@/modules/hvac-estimator/platform-adapter";
import { mapCatalogRows } from "@/modules/hvac-estimator/shared/catalogStore";
import {
  ESTIMATE_SELECT,
  canReadEstimates,
  canWriteEstimates,
  deriveEstimateLifecycleFields,
  estimateUpdateSchema,
} from "@/lib/estimates/api";

function normalizeEstimateSummary(
  estimate: {
    body?: unknown;
    total_amount: number | null;
    gross_margin_amount: number | null;
    gross_margin_pct: number | null;
  },
  controlsCatalog: Record<string, unknown>,
) {
  if (!estimate.body || typeof estimate.body !== "object") return estimate;

  const summary = summarizeHvacEstimate(estimate.body as HvacEstimateBody, controlsCatalog);
  return {
    ...estimate,
    total_amount: summary.totalAmount ?? estimate.total_amount,
    gross_margin_amount: summary.grossMarginAmount ?? estimate.gross_margin_amount,
    gross_margin_pct: summary.grossMarginPct ?? estimate.gross_margin_pct,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!canReadEstimates(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("estimates")
    .select(ESTIMATE_SELECT)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: controlsRows, error: controlsError } = await supabase
    .from("controls_assembly_catalog")
    .select("id, description, mtl_unit, mtl_per, hrs_unit, hrs_per, category, alternate_ids, part_number, manufacturer, io_type")
    .eq("organization_id", data.organization_id)
    .order("id", { ascending: true });

  if (controlsError) return NextResponse.json({ error: controlsError.message }, { status: 500 });

  const controlsCatalog = mapCatalogRows(controlsRows ?? []);

  return NextResponse.json({ estimate: normalizeEstimateSummary(data, controlsCatalog) });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!canWriteEstimates(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const body = await request.json().catch(() => null);
  const parsed = estimateUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const lifecycleFields = deriveEstimateLifecycleFields(parsed.data);
  const { data, error } = await adminClient
    .from("estimates")
    .update({
      ...parsed.data,
      ...lifecycleFields,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(ESTIMATE_SELECT)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: controlsRows, error: controlsError } = await adminClient
    .from("controls_assembly_catalog")
    .select("id, description, mtl_unit, mtl_per, hrs_unit, hrs_per, category, alternate_ids, part_number, manufacturer, io_type")
    .eq("organization_id", data.organization_id)
    .order("id", { ascending: true });

  if (controlsError) return NextResponse.json({ error: controlsError.message }, { status: 500 });

  const controlsCatalog = mapCatalogRows(controlsRows ?? []);

  return NextResponse.json({ estimate: normalizeEstimateSummary(data, controlsCatalog) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!canWriteEstimates(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { error } = await supabase
    .from("estimates")
    .update({
      archived: true,
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
