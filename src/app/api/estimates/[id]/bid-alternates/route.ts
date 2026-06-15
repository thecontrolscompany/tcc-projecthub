import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { mapCatalogRows } from "@/modules/hvac-estimator/shared/catalogStore";
import { summarizeHvacEstimate, type HvacEstimateBody } from "@/modules/hvac-estimator/platform-adapter";
import { ESTIMATE_SELECT, canWriteEstimates } from "@/lib/estimates/api";

const bidAlternateCreateSchema = z.object({
  name: z.string().trim().min(1, "Bid alternate name is required."),
  scopeMode: z.string().trim().min(1).default("installation"),
  seedWithCurrentItems: z.boolean().default(false),
});

function getDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const metadata = user.user_metadata ?? {};
  const name =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    "";
  return name || user.email || null;
}

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!canWriteEstimates(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { id } = await params;
  const parsed = bidAlternateCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: estimate, error: estimateError } = await adminClient
    .from("estimates")
    .select(ESTIMATE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (estimateError) {
    return NextResponse.json({ error: estimateError.message }, { status: 500 });
  }

  if (!estimate) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!estimate.body || typeof estimate.body !== "object") {
    return NextResponse.json({ error: "Estimate body is missing." }, { status: 400 });
  }

  const currentBody = estimate.body as HvacEstimateBody;
  const now = new Date().toISOString();
  const alternate = {
    id: crypto.randomUUID(),
    name: parsed.data.name,
    settings: {
      ...(currentBody.settings || {}),
      estimateScopeMode: parsed.data.scopeMode,
    },
    items: parsed.data.seedWithCurrentItems ? structuredClone(currentBody.items || []) : [],
    createdAt: now,
    updatedAt: now,
    createdBy: {
      id: user.id,
      email: user.email ?? null,
      name: getDisplayName(user),
    },
    updatedBy: {
      id: user.id,
      email: user.email ?? null,
      name: getDisplayName(user),
    },
  };

  const updatedBody: HvacEstimateBody = {
    ...currentBody,
    alternates: [...(Array.isArray(currentBody.alternates) ? currentBody.alternates : []), alternate],
    updatedAt: now,
    updatedBy: {
      id: user.id,
      email: user.email ?? null,
      name: getDisplayName(user),
    },
  };

  const { data: controlsRows, error: controlsError } = await adminClient
    .from("controls_assembly_catalog")
    .select("id, description, mtl_unit, mtl_per, hrs_unit, hrs_per, category, alternate_ids, part_number, manufacturer, io_type")
    .eq("organization_id", estimate.organization_id)
    .order("id", { ascending: true });

  if (controlsError) {
    return NextResponse.json({ error: controlsError.message }, { status: 500 });
  }

  const controlsCatalog = mapCatalogRows(controlsRows ?? []);
  const summary = summarizeHvacEstimate(updatedBody, controlsCatalog);

  const { data: updatedEstimate, error: updateError } = await adminClient
    .from("estimates")
    .update({
      body: updatedBody,
      total_amount: summary.totalAmount,
      gross_margin_amount: summary.grossMarginAmount,
      gross_margin_pct: summary.grossMarginPct,
      updated_at: now,
    })
    .eq("id", id)
    .select(ESTIMATE_SELECT)
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updatedEstimate) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({
    estimate: normalizeEstimateSummary(updatedEstimate, controlsCatalog),
    alternate,
  }, { status: 201 });
}
