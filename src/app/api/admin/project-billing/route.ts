import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

type AdminClient = SupabaseClient;

type BillingPeriodRow = {
  id: string;
  project_id: string;
  period_month: string;
  estimated_income_snapshot: number;
  prior_pct: number;
  pct_complete: number;
  prev_billed: number;
  actual_billed: number | null;
  notes: string | null;
  synced_from_onedrive: boolean;
};

type BillingPeriodUpdate = {
  id: string;
  actual_billed?: number | null;
  pct_complete?: number;
  notes?: string | null;
};

async function requireBillingAccess() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }), adminClient: null };
  }

  const resolvedProfile = await resolveUserRole(user);
  if (!["admin", "ops_manager"].includes(resolvedProfile?.role ?? "")) {
    return { response: NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 }), adminClient: null };
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  return { response: null, adminClient };
}

function normalizeMonth(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed.slice(0, 7)}-01`;
  return null;
}

function normalizeNumber(value: unknown) {
  if (value === null || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

async function recalculateProjectBilling(
  adminClient: AdminClient,
  projectId: string
) {
  const { data, error } = await adminClient
    .from("billing_periods")
    .select("id, period_month, pct_complete, actual_billed")
    .eq("project_id", projectId)
    .order("period_month", { ascending: true });

  if (error) throw error;

  let runningBilled = 0;
  let priorPct = 0;

  for (const period of data ?? []) {
    const { error: updateError } = await adminClient
      .from("billing_periods")
      .update({
        prev_billed: runningBilled,
        prior_pct: priorPct,
      })
      .eq("id", period.id);

    if (updateError) throw updateError;

    runningBilled += Number(period.actual_billed ?? 0);
    priorPct = Number(period.pct_complete ?? priorPct);
  }
}

async function loadProjectBilling(adminClient: AdminClient, projectId: string) {
  const { data: project, error: projectError } = await adminClient
    .from("projects")
    .select("id, name, estimated_income, contract_price")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) throw projectError;
  if (!project) return { project: null, periods: [] as BillingPeriodRow[] };

  const { data: periods, error } = await adminClient
    .from("billing_periods")
    .select("id, project_id, period_month, estimated_income_snapshot, prior_pct, pct_complete, prev_billed, actual_billed, notes, synced_from_onedrive")
    .eq("project_id", projectId)
    .order("period_month", { ascending: true });

  if (error) throw error;

  return { project, periods: (periods ?? []) as BillingPeriodRow[] };
}

export async function GET(request: Request) {
  const { response, adminClient } = await requireBillingAccess();
  if (response || !adminClient) return response;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId." }, { status: 400 });
  }

  try {
    const result = await loadProjectBilling(adminClient, projectId);
    if (!result.project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to load project billing:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load project billing." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { response, adminClient } = await requireBillingAccess();
  if (response || !adminClient) return response;

  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const periodMonth = typeof body?.periodMonth === "string" ? normalizeMonth(body.periodMonth) : null;
  const actualBilled = normalizeNumber(body?.actual_billed);
  const pctCompleteInput = normalizeNumber(body?.pct_complete);
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

  if (!projectId || !periodMonth) {
    return NextResponse.json({ error: "Missing projectId or billing month." }, { status: 400 });
  }

  try {
    const { data: project, error: projectError } = await adminClient
      .from("projects")
      .select("id, estimated_income, contract_price")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const estimatedIncome = Number(project.contract_price ?? project.estimated_income ?? 0);
    const pctComplete = pctCompleteInput === null ? 0 : Math.max(0, Math.min(1, pctCompleteInput));

    const { error } = await adminClient
      .from("billing_periods")
      .upsert(
        {
          project_id: projectId,
          period_month: periodMonth,
          estimated_income_snapshot: estimatedIncome,
          pct_complete: pctComplete,
          actual_billed: actualBilled,
          notes,
          synced_from_onedrive: false,
        },
        { onConflict: "project_id,period_month" }
      );

    if (error) throw error;

    await recalculateProjectBilling(adminClient, projectId);
    const result = await loadProjectBilling(adminClient, projectId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to add project billing period:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to add billing period." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { response, adminClient } = await requireBillingAccess();
  if (response || !adminClient) return response;

  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const updates = Array.isArray(body?.updates) ? (body.updates as BillingPeriodUpdate[]) : [];

  if (!projectId || updates.length === 0) {
    return NextResponse.json({ error: "Missing projectId or updates." }, { status: 400 });
  }

  try {
    for (const update of updates) {
      if (!update.id) continue;

      const payload: Record<string, number | string | null> = {};
      if ("actual_billed" in update) payload.actual_billed = normalizeNumber(update.actual_billed);
      if ("pct_complete" in update) {
        const pctComplete = normalizeNumber(update.pct_complete);
        if (pctComplete !== null) payload.pct_complete = Math.max(0, Math.min(1, pctComplete));
      }
      if ("notes" in update) payload.notes = update.notes?.trim() || null;

      if (Object.keys(payload).length === 0) continue;

      const { error } = await adminClient
        .from("billing_periods")
        .update(payload)
        .eq("id", update.id)
        .eq("project_id", projectId);

      if (error) throw error;
    }

    await recalculateProjectBilling(adminClient, projectId);
    const result = await loadProjectBilling(adminClient, projectId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to save project billing periods:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save project billing." }, { status: 500 });
  }
}
