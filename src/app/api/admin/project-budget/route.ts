import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { computeProjectBudget, MANUAL_BUDGET_CATEGORIES, type ProjectBudgetCategory } from "@/lib/budget/calculations";

async function requireBudgetAccess() {
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

function normalizeNumber(value: unknown) {
  if (value === null || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function isManualCategory(value: unknown): value is ProjectBudgetCategory {
  return typeof value === "string" && (MANUAL_BUDGET_CATEGORIES as readonly string[]).includes(value);
}

async function loadSummary(adminClient: SupabaseClient, projectId: string) {
  const summary = await computeProjectBudget(adminClient, projectId);
  if (!summary) return null;
  return summary;
}

export async function GET(request: Request) {
  const { response, adminClient } = await requireBudgetAccess();
  if (response || !adminClient) return response;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId." }, { status: 400 });
  }

  try {
    const summary = await loadSummary(adminClient, projectId);
    if (!summary) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to load project budget:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load project budget." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { response, adminClient } = await requireBudgetAccess();
  if (response || !adminClient) return response;

  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const category = body?.category;
  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  const budgetedCost = normalizeNumber(body?.budgeted_cost) ?? 0;
  const actualCost = normalizeNumber(body?.actual_cost);
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

  if (!projectId || !isManualCategory(category)) {
    return NextResponse.json({ error: "Missing projectId or invalid category." }, { status: 400 });
  }

  try {
    const { error } = await adminClient.from("project_budget").insert({
      project_id: projectId,
      category,
      description,
      budgeted_cost: budgetedCost,
      actual_cost: actualCost,
      notes,
    });

    if (error) throw error;

    const summary = await loadSummary(adminClient, projectId);
    if (!summary) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json(summary, { status: 201 });
  } catch (error) {
    console.error("Failed to add project budget line:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to add budget line." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { response, adminClient } = await requireBudgetAccess();
  if (response || !adminClient) return response;

  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId." }, { status: 400 });
  }

  try {
    if ("laborRate" in (body ?? {})) {
      const laborRate = normalizeNumber(body?.laborRate);
      if (laborRate === null || laborRate < 0) {
        return NextResponse.json({ error: "Invalid labor rate." }, { status: 400 });
      }

      const { error } = await adminClient
        .from("projects")
        .update({ labor_rate: laborRate })
        .eq("id", projectId);

      if (error) throw error;
    }

    const lineId = typeof body?.id === "string" ? body.id : null;
    if (lineId) {
      const payload: Record<string, unknown> = {};
      if ("description" in body) payload.description = typeof body.description === "string" ? body.description.trim() || null : null;
      if ("budgeted_cost" in body) payload.budgeted_cost = normalizeNumber(body.budgeted_cost) ?? 0;
      if ("actual_cost" in body) payload.actual_cost = normalizeNumber(body.actual_cost);
      if ("notes" in body) payload.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

      if (Object.keys(payload).length > 0) {
        const { error } = await adminClient
          .from("project_budget")
          .update(payload)
          .eq("id", lineId)
          .eq("project_id", projectId);

        if (error) throw error;
      }
    }

    const summary = await loadSummary(adminClient, projectId);
    if (!summary) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to update project budget:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update budget." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { response, adminClient } = await requireBudgetAccess();
  if (response || !adminClient) return response;

  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const id = typeof body?.id === "string" ? body.id : "";

  if (!projectId || !id) {
    return NextResponse.json({ error: "Missing projectId or id." }, { status: 400 });
  }

  try {
    const { error } = await adminClient.from("project_budget").delete().eq("id", id).eq("project_id", projectId);
    if (error) throw error;

    const summary = await loadSummary(adminClient, projectId);
    if (!summary) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to delete project budget line:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete budget line." }, { status: 500 });
  }
}
