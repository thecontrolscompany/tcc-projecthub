import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWeekBounds } from "@/lib/time/data";
import type { EmployeeHoursRow, EmployeeProjectHoursRow } from "@/types/database";

type TimesheetRow = {
  qb_user_id: number;
  qb_jobcode_id: number | null;
  duration_seconds: number | null;
};

type UserRow = {
  qb_user_id: number;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ProjectMappingRow = {
  project_id: string;
  qb_jobcode_id: number;
  project: { id: string; name: string } | { id: string; name: string }[] | null;
};

type JobcodeRow = {
  qb_jobcode_id: number;
  name: string | null;
};

function adminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function parseWeekStart(value: string | null) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      const weekEnd = new Date(parsed);
      weekEnd.setDate(weekEnd.getDate() + 7);

      return {
        weekStartIso: value,
        weekEndIso: weekEnd.toISOString().slice(0, 10)
      };
    }
  }

  const { weekStart, weekEnd } = getCurrentWeekBounds();
  return {
    weekStartIso: weekStart.toISOString().slice(0, 10),
    weekEndIso: weekEnd.toISOString().slice(0, 10)
  };
}

function roundHours(seconds: number) {
  return Math.round((seconds / 3600) * 10) / 10;
}

function resolveDisplayName(user: UserRow | undefined, qbUserId: number) {
  if (!user) {
    return `Worker ${qbUserId}`;
  }

  return (
    user.display_name?.trim() ||
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    `Worker ${qbUserId}`
  );
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const qbUserIdParam = searchParams.get("qb_user_id")?.trim() ?? "";
  const parsedQbUserId = qbUserIdParam ? Number(qbUserIdParam) : null;
  const { weekStartIso, weekEndIso } = parseWeekStart(searchParams.get("week_start"));
  const admin = adminClient();

  try {
    if (parsedQbUserId !== null) {
      if (!Number.isInteger(parsedQbUserId) || parsedQbUserId <= 0) {
        return NextResponse.json({ error: "Invalid qb_user_id." }, { status: 400 });
      }

      const { data: timesheets, error: timesheetsError } = await admin
        .from("qb_time_timesheets")
        .select("qb_user_id, qb_jobcode_id, duration_seconds")
        .eq("qb_user_id", parsedQbUserId)
        .gte("timesheet_date", weekStartIso)
        .lt("timesheet_date", weekEndIso)
        .gt("duration_seconds", 0);

      if (timesheetsError) {
        throw timesheetsError;
      }

      const jobcodeIds = [
        ...new Set(
          ((timesheets ?? []) as TimesheetRow[])
            .map((row) => row.qb_jobcode_id)
            .filter((value): value is number => typeof value === "number")
        )
      ];

      const [mappingsResult, jobcodesResult] = await Promise.all([
        jobcodeIds.length > 0
          ? admin
              .from("project_qb_time_mappings")
              .select("project_id, qb_jobcode_id, project:projects(id, name)")
              .in("qb_jobcode_id", jobcodeIds)
          : Promise.resolve({ data: [] as ProjectMappingRow[], error: null }),
        jobcodeIds.length > 0
          ? admin
              .from("qb_time_jobcodes")
              .select("qb_jobcode_id, name")
              .in("qb_jobcode_id", jobcodeIds)
          : Promise.resolve({ data: [] as JobcodeRow[], error: null })
      ]);

      if (mappingsResult.error) {
        throw mappingsResult.error;
      }

      if (jobcodesResult.error) {
        throw jobcodesResult.error;
      }

      const projectIdByJobcode = new Map<number, { project_id: string; project_name: string }>();
      for (const mapping of (mappingsResult.data ?? []) as ProjectMappingRow[]) {
        const project = Array.isArray(mapping.project) ? mapping.project[0] : mapping.project;
        if (!project?.id || !project.name) {
          continue;
        }
        projectIdByJobcode.set(mapping.qb_jobcode_id, {
          project_id: project.id,
          project_name: project.name
        });
      }

      const jobcodeNameById = new Map(
        ((jobcodesResult.data ?? []) as JobcodeRow[]).map((row) => [row.qb_jobcode_id, row.name ?? "Unmapped jobcode"])
      );

      const totals = new Map<string, EmployeeProjectHoursRow & { total_seconds: number }>();
      for (const row of (timesheets ?? []) as TimesheetRow[]) {
        if (typeof row.qb_jobcode_id !== "number") {
          continue;
        }

        const mappedProject = projectIdByJobcode.get(row.qb_jobcode_id);
        const key = mappedProject ? mappedProject.project_id : `unmapped:${row.qb_jobcode_id}`;
        const existing = totals.get(key) ?? {
          project_id: mappedProject?.project_id ?? null,
          project_name: mappedProject?.project_name ?? jobcodeNameById.get(row.qb_jobcode_id) ?? "Unmapped jobcode",
          total_hours: 0,
          total_seconds: 0
        };

        existing.total_seconds += row.duration_seconds ?? 0;
        totals.set(key, existing);
      }

      const rows: EmployeeProjectHoursRow[] = [...totals.values()]
        .map(({ total_seconds, ...row }) => ({
          ...row,
          total_hours: roundHours(total_seconds)
        }))
        .sort((a, b) => b.total_hours - a.total_hours || a.project_name.localeCompare(b.project_name));

      return NextResponse.json({
        weekStart: weekStartIso,
        weekEnd: weekEndIso,
        qbUserId: parsedQbUserId,
        rows
      });
    }

    const { data: timesheets, error: timesheetsError } = await admin
      .from("qb_time_timesheets")
      .select("qb_user_id, qb_jobcode_id, duration_seconds")
      .gte("timesheet_date", weekStartIso)
      .lt("timesheet_date", weekEndIso)
      .gt("duration_seconds", 0);

    if (timesheetsError) {
      throw timesheetsError;
    }

    const rowsByUserId = new Map<number, { total_seconds: number; jobcodes: Set<number> }>();
    for (const row of (timesheets ?? []) as TimesheetRow[]) {
      const qbUserId = row.qb_user_id;
      if (typeof qbUserId !== "number") {
        continue;
      }

      const current = rowsByUserId.get(qbUserId) ?? { total_seconds: 0, jobcodes: new Set<number>() };
      current.total_seconds += row.duration_seconds ?? 0;
      if (typeof row.qb_jobcode_id === "number") {
        current.jobcodes.add(row.qb_jobcode_id);
      }
      rowsByUserId.set(qbUserId, current);
    }

    const userIds = [...rowsByUserId.keys()];
    const usersResult =
      userIds.length > 0
        ? await admin
            .from("qb_time_users")
            .select("qb_user_id, display_name, first_name, last_name")
            .in("qb_user_id", userIds)
        : { data: [] as UserRow[], error: null };

    if (usersResult.error) {
      throw usersResult.error;
    }

    const userRowsById = new Map(
      ((usersResult.data ?? []) as UserRow[]).map((row) => [row.qb_user_id, row])
    );

    const rows: EmployeeHoursRow[] = [...rowsByUserId.entries()]
      .map(([qb_user_id, summary]) => ({
        qb_user_id,
        display_name: resolveDisplayName(userRowsById.get(qb_user_id), qb_user_id),
        total_hours: roundHours(summary.total_seconds),
        jobcode_count: summary.jobcodes.size
      }))
      .sort((a, b) => b.total_hours - a.total_hours || a.display_name.localeCompare(b.display_name));

    return NextResponse.json({
      weekStart: weekStartIso,
      weekEnd: weekEndIso,
      rows
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load weekly employee hours." },
      { status: 500 }
    );
  }
}
