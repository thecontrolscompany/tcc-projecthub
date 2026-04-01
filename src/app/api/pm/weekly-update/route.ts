import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import type { CrewLogEntry, PocSnapshotEntry, WeeklyUpdate, WeeklyUpdateStatus } from "@/types/database";

type UpdatePayload = {
  updateId?: string;
  projectId?: string;
  weekOf?: string;
  status?: WeeklyUpdateStatus;
  pctComplete?: number;
  pocSnapshot?: PocSnapshotEntry[] | null;
  crewLog?: CrewLogEntry[];
  notes?: string | null;
  blockers?: string | null;
  materialDelivered?: string | null;
  equipmentSet?: string | null;
  safetyIncidents?: string | null;
  inspectionsTests?: string | null;
  delaysImpacts?: string | null;
  otherRemarks?: string | null;
  pocUpdates?: Array<{ id: string; pct_complete: number }>;
  billingPeriodId?: string | null;
  editNote?: string | null;
};

type NormalizedPayload = {
  projectId: string;
  weekOf: string;
  status: WeeklyUpdateStatus;
  pctComplete: number;
  pocSnapshot: PocSnapshotEntry[] | null;
  crewLog: CrewLogEntry[];
  notes: string | null;
  blockers: string | null;
  materialDelivered: string | null;
  equipmentSet: string | null;
  safetyIncidents: string | null;
  inspectionsTests: string | null;
  delaysImpacts: string | null;
  otherRemarks: string | null;
  pocUpdates: Array<{ id: string; pct_complete: number }>;
  billingPeriodId: string | null;
  editNote: string | null;
};

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function authorizeProjectAccess(projectId: string, profileId: string) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("project_assignments")
    .select("id")
    .eq("project_id", projectId)
    .eq("profile_id", profileId)
    .in("role_on_project", ["pm", "lead", "ops_manager"])
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: error.message, status: 500 };
  }

  if (!data) {
    return { ok: false as const, error: "You are not assigned to this project.", status: 403 };
  }

  return { ok: true as const, admin };
}

function normalizePayload(body: UpdatePayload): { value: NormalizedPayload } | { error: string } {
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const weekOf = typeof body.weekOf === "string" ? body.weekOf : "";
  const status = body.status === "draft" || body.status === "submitted" ? body.status : null;
  const pctComplete =
    typeof body.pctComplete === "number" && Number.isFinite(body.pctComplete)
      ? Math.min(Math.max(body.pctComplete, 0), 1)
      : null;

  if (!projectId) return { error: "Missing projectId." };
  if (!weekOf) return { error: "Missing weekOf." };
  if (!status) return { error: "Missing status." };
  if (pctComplete === null) return { error: "Missing pctComplete." };

  return {
    value: {
      projectId,
      weekOf,
      status,
      pctComplete,
      pocSnapshot: Array.isArray(body.pocSnapshot) ? body.pocSnapshot : null,
      crewLog: Array.isArray(body.crewLog) ? body.crewLog : [],
      notes: typeof body.notes === "string" ? body.notes : null,
      blockers: typeof body.blockers === "string" ? body.blockers : null,
      materialDelivered: typeof body.materialDelivered === "string" ? body.materialDelivered : null,
      equipmentSet: typeof body.equipmentSet === "string" ? body.equipmentSet : null,
      safetyIncidents: typeof body.safetyIncidents === "string" ? body.safetyIncidents : null,
      inspectionsTests: typeof body.inspectionsTests === "string" ? body.inspectionsTests : null,
      delaysImpacts: typeof body.delaysImpacts === "string" ? body.delaysImpacts : null,
      otherRemarks: typeof body.otherRemarks === "string" ? body.otherRemarks : null,
      pocUpdates: Array.isArray(body.pocUpdates) ? body.pocUpdates : [],
      billingPeriodId: typeof body.billingPeriodId === "string" ? body.billingPeriodId : null,
      editNote: typeof body.editNote === "string" ? body.editNote : null,
    },
  };
}

async function applyProjectSideEffects(
  admin: ReturnType<typeof adminClient>,
  {
    pocUpdates,
    billingPeriodId,
    pctComplete,
    status,
  }: {
    pocUpdates: Array<{ id: string; pct_complete: number }>;
    billingPeriodId: string | null;
    pctComplete: number;
    status: WeeklyUpdateStatus;
  }
) {
  if (pocUpdates.length > 0) {
    const results = await Promise.all(
      pocUpdates.map((item) =>
        admin
          .from("poc_line_items")
          .update({ pct_complete: Math.min(Math.max(item.pct_complete, 0), 1) })
          .eq("id", item.id)
      )
    );

    const pocError = results.find((result) => result.error)?.error;
    if (pocError) {
      throw new Error(pocError.message);
    }
  }

  if (billingPeriodId && status === "submitted") {
    const { error } = await admin
      .from("billing_periods")
      .update({ pct_complete: pctComplete })
      .eq("id", billingPeriodId);

    if (error) {
      throw new Error(error.message);
    }
  }
}

function toRow(payload: NormalizedPayload, profileId: string) {
  return {
    project_id: payload.projectId,
    pm_id: profileId,
    week_of: payload.weekOf,
    status: payload.status,
    pct_complete: payload.pctComplete,
    poc_snapshot: payload.pocSnapshot,
    notes: payload.notes,
    blockers: payload.blockers,
    crew_log: payload.crewLog,
    material_delivered: payload.materialDelivered,
    equipment_set: payload.equipmentSet,
    safety_incidents: payload.safetyIncidents,
    inspections_tests: payload.inspectionsTests,
    delays_impacts: payload.delaysImpacts,
    other_remarks: payload.otherRemarks,
    submitted_at: payload.status === "submitted" ? new Date().toISOString() : null,
  };
}

async function loadExistingWeekRow(projectId: string, weekOf: string) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("weekly_updates")
    .select("*")
    .eq("project_id", projectId)
    .eq("week_of", weekOf)
    .order("submitted_at", { ascending: false });

  if (error) {
    return { error };
  }

  const rows = (data ?? []) as WeeklyUpdate[];
  const existingDraft = rows.find((row) => row.status === "draft") ?? null;
  const existingSubmitted = rows.find((row) => row.status === "submitted") ?? null;

  return {
    row: existingDraft ?? existingSubmitted ?? null,
  };
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const resolvedProfile = await resolveUserRole(user);
  if (!resolvedProfile || !["pm", "lead", "ops_manager", "admin"].includes(resolvedProfile.role)) {
    return NextResponse.json({ error: "PM or lead access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as UpdatePayload | null;
  if (!body) {
    return badRequest("Invalid request body.");
  }

  const normalized = normalizePayload(body);
  if ("error" in normalized) {
    return badRequest(normalized.error);
  }

  const authz = await authorizeProjectAccess(normalized.value.projectId, user.id);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  const existingLookup = await loadExistingWeekRow(normalized.value.projectId, normalized.value.weekOf);
  if ("error" in existingLookup && existingLookup.error) {
    return NextResponse.json({ error: existingLookup.error.message }, { status: 500 });
  }

  const existing = existingLookup.row;

  try {
    if (existing?.status === "submitted") {
      return NextResponse.json({ error: "A submitted report already exists for this week." }, { status: 409 });
    }

    if (existing?.status === "draft") {
      return PATCH(
        new Request(request.url, {
          method: "PATCH",
          headers: request.headers,
          body: JSON.stringify({
            ...body,
            updateId: existing.id,
          }),
        })
      );
    }

    const row = toRow(normalized.value, user.id);
    const { data, error } = await authz.admin
      .from("weekly_updates")
      .insert(row)
      .select("id, status, week_of")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await applyProjectSideEffects(authz.admin, {
      pocUpdates: normalized.value.pocUpdates,
      billingPeriodId: normalized.value.billingPeriodId,
      pctComplete: normalized.value.pctComplete,
      status: normalized.value.status,
    });

    return NextResponse.json({ update: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save weekly update." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const resolvedProfile = await resolveUserRole(user);
  if (!resolvedProfile || !["pm", "lead", "ops_manager", "admin"].includes(resolvedProfile.role)) {
    return NextResponse.json({ error: "PM or lead access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as UpdatePayload | null;
  if (!body) {
    return badRequest("Invalid request body.");
  }

  const updateId = typeof body.updateId === "string" ? body.updateId : "";
  if (!updateId) {
    return badRequest("Missing updateId.");
  }

  const normalized = normalizePayload(body);
  if ("error" in normalized) {
    return badRequest(normalized.error);
  }

  const authz = await authorizeProjectAccess(normalized.value.projectId, user.id);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  const { data: existing, error: existingError } = await authz.admin
    .from("weekly_updates")
    .select("id, status")
    .eq("id", updateId)
    .single();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  let editLogged = false;

  try {
    if (existing.status === "submitted") {
      const { error: editError } = await authz.admin
        .from("weekly_update_edits")
        .insert({
          weekly_update_id: updateId,
          edited_by_profile_id: user.id,
          edited_at: new Date().toISOString(),
          editor_name: resolvedProfile.full_name ?? resolvedProfile.email,
          note: normalized.value.editNote,
        });

      if (editError) {
        return NextResponse.json({ error: editError.message }, { status: 500 });
      }

      editLogged = true;
    }

    const nextRow = {
      ...toRow(normalized.value, user.id),
      submitted_at:
        normalized.value.status === "submitted"
          ? new Date().toISOString()
          : existing.status === "submitted"
            ? new Date().toISOString()
            : null,
    };

    const { data, error } = await authz.admin
      .from("weekly_updates")
      .update(nextRow)
      .eq("id", updateId)
      .select("id, status, week_of")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await applyProjectSideEffects(authz.admin, {
      pocUpdates: normalized.value.pocUpdates,
      billingPeriodId: normalized.value.billingPeriodId,
      pctComplete: normalized.value.pctComplete,
      status: normalized.value.status,
    });

    return NextResponse.json({ update: data, editLogged });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update weekly update." },
      { status: 500 }
    );
  }
}
