import { subDays } from "date-fns";
import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

type MappingRow = {
  qb_jobcode_id: number;
};

type TimesheetRow = {
  qb_user_id: number;
  timesheet_date: string;
  duration_seconds: number | null;
  qb_time_users: { display_name: string | null } | { display_name: string | null }[] | null;
};

type WorkerHours = {
  display_name: string;
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  sat: number;
  total: number;
};

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function roundToHalf(hours: number): number {
  return Math.round(hours * 2) / 2;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getDayKey(timesheetDate: string): keyof Omit<WorkerHours, "display_name" | "total"> | null {
  const day = parseDateOnly(timesheetDate).getDay();
  if (day === 1) return "mon";
  if (day === 2) return "tue";
  if (day === 3) return "wed";
  if (day === 4) return "thu";
  if (day === 5) return "fri";
  if (day === 6) return "sat";
  return null;
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

  return { ok: true as const };
}

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const resolvedProfile = await resolveUserRole(user);
  if (!resolvedProfile || !["pm", "admin"].includes(resolvedProfile.role)) {
    return NextResponse.json({ error: "PM or admin access required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId")?.trim() ?? "";
  const weekOf = searchParams.get("weekOf")?.trim() ?? "";

  if (!projectId || !weekOf) {
    return NextResponse.json({ error: "projectId and weekOf are required." }, { status: 400 });
  }

  if (resolvedProfile.role !== "admin") {
    const authz = await authorizeProjectAccess(projectId, user.id);
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status });
    }
  }

  const admin = adminClient();
  const { data: mappings, error: mappingsError } = await admin
    .from("project_qb_time_mappings")
    .select("qb_jobcode_id")
    .eq("project_id", projectId)
    .eq("is_active", true);

  if (mappingsError) {
    return NextResponse.json({ error: mappingsError.message }, { status: 500 });
  }

  const mappingRows = (mappings ?? []) as MappingRow[];
  if (mappingRows.length === 0) {
    return NextResponse.json({ hasMapping: false, hours: null, lastSyncedAt: null, workers: [] });
  }

  const jobcodeIds = mappingRows.map((mapping) => mapping.qb_jobcode_id);
  const weekStart = subDays(parseDateOnly(weekOf), 6).toISOString().slice(0, 10);

  const { data: sheets, error: sheetsError } = await admin
    .from("qb_time_timesheets")
    .select("qb_user_id, timesheet_date, duration_seconds, qb_time_users!inner(display_name)")
    .in("qb_jobcode_id", jobcodeIds)
    .gte("timesheet_date", weekStart)
    .lte("timesheet_date", weekOf)
    .or("state.is.null,state.neq.deleted")
    .order("timesheet_date", { ascending: true });

  if (sheetsError) {
    return NextResponse.json({ error: sheetsError.message }, { status: 500 });
  }

  const grouped = new Map<number, WorkerHours>();

  for (const row of (sheets ?? []) as TimesheetRow[]) {
    const dayKey = getDayKey(row.timesheet_date);
    if (!dayKey) continue;

    const userRecord = Array.isArray(row.qb_time_users) ? row.qb_time_users[0] : row.qb_time_users;
    const existing = grouped.get(row.qb_user_id) ?? {
      display_name: userRecord?.display_name ?? `Worker ${row.qb_user_id}`,
      mon: 0,
      tue: 0,
      wed: 0,
      thu: 0,
      fri: 0,
      sat: 0,
      total: 0,
    };

    existing[dayKey] = roundToHalf(existing[dayKey] + (row.duration_seconds ?? 0) / 3600);
    existing.total = roundToHalf(
      existing.mon + existing.tue + existing.wed + existing.thu + existing.fri + existing.sat
    );
    grouped.set(row.qb_user_id, existing);
  }

  const workers = Array.from(grouped.values()).sort((a, b) => a.display_name.localeCompare(b.display_name));
  const totalHours = roundToHalf(workers.reduce((sum, worker) => sum + worker.total, 0));

  const { data: latestTimesheetSync, error: latestTimesheetSyncError } = await admin
    .from("qb_time_timesheets")
    .select("last_synced_at")
    .in("qb_jobcode_id", jobcodeIds)
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestTimesheetSyncError) {
    return NextResponse.json({ error: latestTimesheetSyncError.message }, { status: 500 });
  }

  let lastSyncedAt = latestTimesheetSync?.last_synced_at ?? null;
  if (!lastSyncedAt) {
    const { data: latestRun, error: latestRunError } = await admin
      .from("integration_sync_runs")
      .select("completed_at")
      .eq("integration_target", "quickbooks_time")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestRunError) {
      return NextResponse.json({ error: latestRunError.message }, { status: 500 });
    }

    lastSyncedAt = latestRun?.completed_at ?? null;
  }

  return NextResponse.json({
    hasMapping: true,
    hours: totalHours,
    lastSyncedAt,
    workers,
  });
}
