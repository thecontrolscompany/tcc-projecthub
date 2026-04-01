import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import type { ChangeOrder, ChangeOrderStatus, UserRole } from "@/types/database";

type RouteContext =
  | {
      ok: true;
      adminClient: ReturnType<typeof adminClient>;
      user: { id: string; email: string | null };
      role: UserRole;
    }
  | {
      ok: false;
      response: NextResponse;
    };

type ChangeOrderPayload = {
  projectId?: string;
  coNumber?: string;
  title?: string;
  description?: string;
  amount?: number;
  status?: ChangeOrderStatus;
  submittedDate?: string;
  approvedDate?: string;
  referenceDoc?: string;
  notes?: string;
};

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getRouteContext(): Promise<RouteContext> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  const resolved = await resolveUserRole(user);

  return {
    ok: true,
    adminClient: adminClient(),
    user: { id: user.id, email: user.email ?? null },
    role: resolved?.role ?? "customer",
  };
}

async function canReadProject(admin: ReturnType<typeof adminClient>, projectId: string, userId: string, role: UserRole) {
  if (role === "admin" || role === "ops_manager") return true;

  const { data: directRows, error: directError } = await admin
    .from("project_assignments")
    .select("profile_id")
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .limit(1);

  if (directError) {
    throw directError;
  }

  if ((directRows?.length ?? 0) > 0) return true;

  const { data: assignmentRows, error: assignmentError } = await admin
    .from("project_assignments")
    .select("pm_directory_id")
    .eq("project_id", projectId)
    .not("pm_directory_id", "is", null);

  if (assignmentError) {
    throw assignmentError;
  }

  const directoryIds = (assignmentRows ?? [])
    .map((row) => row.pm_directory_id)
    .filter(Boolean) as string[];

  if (directoryIds.length > 0) {
    const { data: dirRows, error: directoryError } = await admin
      .from("pm_directory")
      .select("id")
      .in("id", directoryIds)
      .eq("profile_id", userId)
      .limit(1);

    if (directoryError) {
      throw directoryError;
    }

    if ((dirRows?.length ?? 0) > 0) return true;
  }

  const { data: customerContactRows, error: customerContactError } = await admin
    .from("project_customer_contacts")
    .select("id")
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .eq("portal_access", true)
    .limit(1);

  if (customerContactError) {
    throw customerContactError;
  }

  return (customerContactRows?.length ?? 0) > 0;
}

function toChangeOrder(row: Record<string, unknown>): ChangeOrder {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    co_number: String(row.co_number),
    title: String(row.title),
    description: typeof row.description === "string" ? row.description : null,
    amount: Number(row.amount ?? 0),
    status: row.status as ChangeOrderStatus,
    submitted_date: typeof row.submitted_date === "string" ? row.submitted_date : null,
    approved_date: typeof row.approved_date === "string" ? row.approved_date : null,
    submitted_by: typeof row.submitted_by === "string" ? row.submitted_by : null,
    approved_by: typeof row.approved_by === "string" ? row.approved_by : null,
    reference_doc: typeof row.reference_doc === "string" ? row.reference_doc : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function generateCoNumber(admin: ReturnType<typeof adminClient>, projectId: string, status: ChangeOrderStatus) {
  const prefix = status === "approved" ? "CO" : "PCO";
  const { data, error } = await admin
    .from("change_orders")
    .select("co_number")
    .eq("project_id", projectId);

  if (error) throw error;

  const maxNumber = (data ?? []).reduce((max, row) => {
    const coNumber = typeof row.co_number === "string" ? row.co_number : "";
    if (!coNumber.startsWith(`${prefix}-`)) return max;
    const parsed = Number.parseInt(coNumber.slice(prefix.length + 1), 10);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);

  return `${prefix}-${String(maxNumber + 1).padStart(3, "0")}`;
}

export async function GET(request: Request) {
  const context = await getRouteContext();
  if (!context.ok) return context.response;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId." }, { status: 400 });
  }

  try {
    const allowed = await canReadProject(context.adminClient, projectId, context.user.id, context.role);
    if (!allowed) {
      return NextResponse.json({ error: "Project access required." }, { status: 403 });
    }

    const { data, error } = await context.adminClient
      .from("change_orders")
      .select("*")
      .eq("project_id", projectId)
      .order("co_number");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const changeOrders = (data ?? []).map((row) => toChangeOrder(row as Record<string, unknown>));
    const approvedTotal = changeOrders
      .filter((co) => co.status === "approved")
      .reduce((sum, co) => sum + co.amount, 0);
    const pendingTotal = changeOrders
      .filter((co) => co.status === "pending")
      .reduce((sum, co) => sum + co.amount, 0);

    return NextResponse.json({ changeOrders, approvedTotal, pendingTotal });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load change orders." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const context = await getRouteContext();
  if (!context.ok) return context.response;

  if (!(context.role === "admin" || context.role === "ops_manager")) {
    return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as ChangeOrderPayload | null;
  const projectId = body?.projectId?.trim();
  const title = body?.title?.trim();
  const status = body?.status ?? "pending";

  if (!projectId || !title) {
    return NextResponse.json({ error: "projectId and title are required." }, { status: 400 });
  }

  try {
    const coNumber = body?.coNumber?.trim() || (await generateCoNumber(context.adminClient, projectId, status));
    const approvedDate =
      status === "approved"
        ? body?.approvedDate?.trim() || new Date().toISOString().slice(0, 10)
        : body?.approvedDate?.trim() || null;

    const payload = {
      project_id: projectId,
      co_number: coNumber,
      title,
      description: body?.description?.trim() || null,
      amount: Number(body?.amount ?? 0),
      status,
      submitted_date: body?.submittedDate?.trim() || null,
      approved_date: approvedDate,
      submitted_by: context.user.id,
      approved_by: status === "approved" ? context.user.id : null,
      reference_doc: body?.referenceDoc?.trim() || null,
      notes: body?.notes?.trim() || null,
    };

    const { data, error } = await context.adminClient
      .from("change_orders")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ changeOrder: toChangeOrder(data as Record<string, unknown>) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create change order." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const context = await getRouteContext();
  if (!context.ok) return context.response;

  if (!(context.role === "admin" || context.role === "ops_manager")) {
    return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";

  if (!id) {
    return NextResponse.json({ error: "Missing change order id." }, { status: 400 });
  }

  const payload: Record<string, string | number | null> = {};
  if (typeof body?.coNumber === "string") payload.co_number = body.coNumber.trim();
  if (typeof body?.title === "string") payload.title = body.title.trim();
  if ("description" in (body ?? {})) payload.description = typeof body?.description === "string" ? body.description.trim() || null : null;
  if (typeof body?.amount === "number") payload.amount = body.amount;
  if (typeof body?.status === "string") payload.status = body.status;
  if ("submittedDate" in (body ?? {})) payload.submitted_date = typeof body?.submittedDate === "string" ? body.submittedDate || null : null;
  if ("approvedDate" in (body ?? {})) payload.approved_date = typeof body?.approvedDate === "string" ? body.approvedDate || null : null;
  if ("referenceDoc" in (body ?? {})) payload.reference_doc = typeof body?.referenceDoc === "string" ? body.referenceDoc.trim() || null : null;
  if ("notes" in (body ?? {})) payload.notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

  if (payload.status === "approved") {
    if (!payload.approved_date) payload.approved_date = new Date().toISOString().slice(0, 10);
    payload.approved_by = context.user.id;
  }

  const { data, error } = await context.adminClient
    .from("change_orders")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ changeOrder: toChangeOrder(data as Record<string, unknown>) });
}

export async function DELETE(request: Request) {
  const context = await getRouteContext();
  if (!context.ok) return context.response;

  if (!(context.role === "admin" || context.role === "ops_manager")) {
    return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const id = body?.id?.trim();

  if (!id) {
    return NextResponse.json({ error: "Missing change order id." }, { status: 400 });
  }

  const { error } = await context.adminClient
    .from("change_orders")
    .update({ status: "void" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
