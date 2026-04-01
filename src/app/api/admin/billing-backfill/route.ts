import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

type BillingBackfillUpdate = {
  id: string;
  estimated_income_snapshot?: number;
  prior_pct?: number;
  pct_complete?: number;
  prev_billed?: number;
  actual_billed?: number | null;
  notes?: string | null;
};

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }), adminClient: null };
  }

  const resolvedProfile = await resolveUserRole(user);
  if (resolvedProfile?.role !== "admin") {
    return { response: NextResponse.json({ error: "Admin access required." }, { status: 403 }), adminClient: null };
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  return { response: null, adminClient };
}

export async function GET(request: Request) {
  const { response, adminClient } = await requireAdmin();
  if (response || !adminClient) return response;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId." }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from("billing_periods")
    .select("id, period_month, estimated_income_snapshot, prior_pct, pct_complete, prev_billed, actual_billed, notes")
    .eq("project_id", projectId)
    .order("period_month", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ periods: data ?? [] });
}

export async function POST(request: Request) {
  const { response, adminClient } = await requireAdmin();
  if (response || !adminClient) return response;

  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const periodMonth = typeof body?.periodMonth === "string" ? body.periodMonth : "";

  if (!projectId || !periodMonth) {
    return NextResponse.json({ error: "Missing projectId or periodMonth." }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from("billing_periods")
    .insert({
      project_id: projectId,
      period_month: periodMonth,
      estimated_income_snapshot: 0,
      prior_pct: 0,
      pct_complete: 0,
      prev_billed: 0,
      actual_billed: null,
      notes: null,
      synced_from_onedrive: false,
    })
    .select("id, period_month, estimated_income_snapshot, prior_pct, pct_complete, prev_billed, actual_billed, notes")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ period: data });
}

export async function PATCH(request: Request) {
  const { response, adminClient } = await requireAdmin();
  if (response || !adminClient) return response;

  const body = await request.json().catch(() => null);
  const updates = Array.isArray(body?.updates) ? (body.updates as BillingBackfillUpdate[]) : [];

  if (updates.length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  for (const update of updates) {
    if (!update.id) continue;

    const payload: Record<string, number | string | null> = {};
    if (typeof update.estimated_income_snapshot === "number") payload.estimated_income_snapshot = update.estimated_income_snapshot;
    if (typeof update.prior_pct === "number") payload.prior_pct = update.prior_pct;
    if (typeof update.pct_complete === "number") payload.pct_complete = update.pct_complete;
    if (typeof update.prev_billed === "number") payload.prev_billed = update.prev_billed;
    if ("actual_billed" in update) payload.actual_billed = update.actual_billed ?? null;
    if ("notes" in update) payload.notes = update.notes ?? null;

    const { error } = await adminClient
      .from("billing_periods")
      .update(payload)
      .eq("id", update.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
