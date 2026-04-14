import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveTimeRange } from "@/lib/time/date-range";
import type { ProjectHoursRow, ProjectWorkerHoursRow, TimeDayHoursRow } from "@/types/database";

type MappingWithProjectRow = {
  project_id: string;
  qb_jobcode_id: number;
  project: { id: string; name: string } | { id: string; name: string }[] | null;
};

type ProjectMappingRow = {
  project_id: string;
  qb_jobcode_id: number;
};

type TimesheetRow = {
  qb_user_id: number;
  qb_jobcode_id: number | null;
  duration_seconds: number | null;
  timesheet_date?: string;
};

type UserRow = {
  qb_user_id: number;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

function adminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function roundHours(seconds: number) {
  return Math.round((seconds / 3600) * 10) / 10;
}

function resolveDisplayName(user: UserRow | undefined) {
  if (!user) {
    return "Unknown worker";
  }

  return (
    user.display_name?.trim() ||
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    `Worker ${user.qb_user_id}`
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
  const projectId = searchParams.get("project_id")?.trim() ?? "";
  const qbUserIdParam = searchParams.get("qb_user_id")?.trim() ?? "";
  const parsedQbUserId = qbUserIdParam ? Number(qbUserIdParam) : null;
  const range = resolveTimeRange({
    startDate: searchParams.get("start_date"),
    endDate: searchParams.get("end_date"),
    weekStart: searchParams.get("week_start"),
  });
  const admin = adminClient();

  try {
    if (projectId) {
      const { data: mappings, error: mappingsError } = await admin
        .from("project_qb_time_mappings")
        .select("project_id, qb_jobcode_id")
        .eq("project_id", projectId);

      if (mappingsError) {
        throw mappingsError;
      }

      const mappingRows = (mappings ?? []) as ProjectMappingRow[];
      const jobcodeIds = [...new Set(mappingRows.map((row) => row.qb_jobcode_id))];

      if (jobcodeIds.length === 0) {
        return NextResponse.json({
          startDate: range.startDate,
          endDate: range.endDate,
          projectId,
          rows: [] satisfies ProjectWorkerHoursRow[] | TimeDayHoursRow[]
        });
      }

      if (parsedQbUserId !== null) {
        if (!Number.isInteger(parsedQbUserId) || parsedQbUserId <= 0) {
          return NextResponse.json({ error: "Invalid qb_user_id." }, { status: 400 });
        }

        const { data: timesheets, error: timesheetsError } = await admin
          .from("qb_time_timesheets")
          .select("timesheet_date, duration_seconds")
          .in("qb_jobcode_id", jobcodeIds)
          .eq("qb_user_id", parsedQbUserId)
          .gte("timesheet_date", range.startDate)
          .lt("timesheet_date", range.endExclusive)
          .gt("duration_seconds", 0)
          .order("timesheet_date", { ascending: true });

        if (timesheetsError) {
          throw timesheetsError;
        }

        const dayTotals = new Map<string, number>();
        for (const row of (timesheets ?? []) as TimesheetRow[]) {
          if (!row.timesheet_date) continue;
          dayTotals.set(row.timesheet_date, (dayTotals.get(row.timesheet_date) ?? 0) + (row.duration_seconds ?? 0));
        }

        const rows: TimeDayHoursRow[] = [...dayTotals.entries()].map(([work_date, totalSeconds]) => ({
          work_date,
          total_hours: roundHours(totalSeconds),
        }));

        return NextResponse.json({
          startDate: range.startDate,
          endDate: range.endDate,
          projectId,
          qbUserId: parsedQbUserId,
          rows,
        });
      }

      const { data: timesheets, error: timesheetsError } = await admin
        .from("qb_time_timesheets")
        .select("qb_user_id, duration_seconds, qb_jobcode_id")
        .in("qb_jobcode_id", jobcodeIds)
        .gte("timesheet_date", range.startDate)
        .lt("timesheet_date", range.endExclusive)
        .gt("duration_seconds", 0);

      if (timesheetsError) {
        throw timesheetsError;
      }

      const workerTotals = new Map<number, number>();
      for (const row of (timesheets ?? []) as TimesheetRow[]) {
        const qbUserId = row.qb_user_id;
        if (typeof qbUserId !== "number") {
          continue;
        }

        workerTotals.set(qbUserId, (workerTotals.get(qbUserId) ?? 0) + (row.duration_seconds ?? 0));
      }

      const userIds = [...workerTotals.keys()];
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

      const usersById = new Map(
        ((usersResult.data ?? []) as UserRow[]).map((row) => [row.qb_user_id, row])
      );

      const rows: ProjectWorkerHoursRow[] = [...workerTotals.entries()]
        .map(([qb_user_id, totalSeconds]) => ({
          qb_user_id,
          display_name: resolveDisplayName(usersById.get(qb_user_id)),
          total_hours: roundHours(totalSeconds)
        }))
        .sort((a, b) => b.total_hours - a.total_hours || a.display_name.localeCompare(b.display_name));

      return NextResponse.json({
        startDate: range.startDate,
        endDate: range.endDate,
        projectId,
        rows
      });
    }

    const { data: mappings, error: mappingsError } = await admin
      .from("project_qb_time_mappings")
      .select("project_id, qb_jobcode_id, project:projects!inner(id, name)");

    if (mappingsError) {
      throw mappingsError;
    }

    const mappingRows = (mappings ?? []) as MappingWithProjectRow[];
    const jobcodeIds = [...new Set(mappingRows.map((row) => row.qb_jobcode_id))];

    if (jobcodeIds.length === 0) {
      return NextResponse.json({
        startDate: range.startDate,
        endDate: range.endDate,
        rows: [] satisfies ProjectHoursRow[]
      });
    }

    const { data: timesheets, error: timesheetsError } = await admin
      .from("qb_time_timesheets")
      .select("qb_user_id, qb_jobcode_id, duration_seconds")
      .in("qb_jobcode_id", jobcodeIds)
      .gte("timesheet_date", range.startDate)
      .lt("timesheet_date", range.endExclusive)
      .gt("duration_seconds", 0);

    if (timesheetsError) {
      throw timesheetsError;
    }

    const projectMap = new Map<
      string,
      { project_name: string; total_seconds: number; workers: Set<number> }
    >();
    const projectIdsByJobcode = new Map<number, string[]>();

    for (const mapping of mappingRows) {
      const project = Array.isArray(mapping.project) ? mapping.project[0] : mapping.project;
      if (!project?.id || !project.name) {
        continue;
      }

      projectMap.set(project.id, projectMap.get(project.id) ?? {
        project_name: project.name,
        total_seconds: 0,
        workers: new Set<number>()
      });

      const existing = projectIdsByJobcode.get(mapping.qb_jobcode_id) ?? [];
      existing.push(project.id);
      projectIdsByJobcode.set(mapping.qb_jobcode_id, existing);
    }

    for (const row of (timesheets ?? []) as TimesheetRow[]) {
      if (typeof row.qb_jobcode_id !== "number") {
        continue;
      }

      const projectIds = projectIdsByJobcode.get(row.qb_jobcode_id) ?? [];
      for (const mappedProjectId of projectIds) {
        const project = projectMap.get(mappedProjectId);
        if (!project) {
          continue;
        }

        project.total_seconds += row.duration_seconds ?? 0;
        if (typeof row.qb_user_id === "number") {
          project.workers.add(row.qb_user_id);
        }
      }
    }

    const rows: ProjectHoursRow[] = [...projectMap.entries()]
      .filter(([, project]) => project.total_seconds > 0 && project.workers.size > 0)
      .map(([project_id, project]) => ({
        project_id,
        project_name: project.project_name,
        total_hours: roundHours(project.total_seconds),
        worker_count: project.workers.size
      }))
      .sort((a, b) => b.total_hours - a.total_hours || a.project_name.localeCompare(b.project_name));

    return NextResponse.json({
      startDate: range.startDate,
      endDate: range.endDate,
      rows
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load weekly project hours." },
      { status: 500 }
    );
  }
}
