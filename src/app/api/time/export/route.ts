import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

type MappingRow = {
  qb_jobcode_id: number;
};

type TimesheetRow = {
  timesheet_date: string;
  duration_seconds: number | null;
  notes: string | null;
  qb_user_id: number;
  state: string | null;
};

type UserRow = {
  qb_user_id: number;
  display_name: string | null;
};

type ProjectRow = {
  name: string | null;
  job_number: string | null;
};

function roundHours(seconds: number | null | undefined) {
  const hours = (seconds ?? 0) / 3600;
  return Math.round(hours * 100) / 100;
}

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const profile = await resolveUserRole(user);
  if (!["admin", "ops_manager"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId")?.trim() ?? "";
  const start = searchParams.get("start")?.trim() ?? "";
  const end = searchParams.get("end")?.trim() ?? "";

  if (!projectId || !start || !end) {
    return NextResponse.json({ error: "projectId, start, and end are required." }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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
    return NextResponse.json({ warning: "No QB Time jobcode mapped to this project." });
  }

  const jobcodeIds = mappingRows.map((mapping) => mapping.qb_jobcode_id);
  const { data: sheets, error: sheetsError } = await admin
    .from("qb_time_timesheets")
    .select("timesheet_date, duration_seconds, notes, qb_user_id, state")
    .in("qb_jobcode_id", jobcodeIds)
    .gte("timesheet_date", start)
    .lte("timesheet_date", end)
    .neq("state", "deleted")
    .order("timesheet_date", { ascending: true });

  if (sheetsError) {
    return NextResponse.json({ error: sheetsError.message }, { status: 500 });
  }

  const timesheets = (sheets ?? []) as TimesheetRow[];
  const userIds = [...new Set(timesheets.map((sheet) => sheet.qb_user_id))];

  const usersResult = userIds.length > 0
    ? await admin
        .from("qb_time_users")
        .select("qb_user_id, display_name")
        .in("qb_user_id", userIds)
    : { data: [] as UserRow[], error: null };

  if (usersResult.error) {
    return NextResponse.json({ error: usersResult.error.message }, { status: 500 });
  }

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("name, job_number")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  const userRows = (usersResult.data ?? []) as UserRow[];
  const nameMap = Object.fromEntries(userRows.map((u) => [u.qb_user_id, u.display_name]));
  const projectRow = project as ProjectRow | null;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Time Export");
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Employee", key: "employee", width: 28 },
    { header: "Hours", key: "hours", width: 10 },
    { header: "Notes", key: "notes", width: 50 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEEF8F6" },
    };
  });

  let totalHours = 0;
  for (const sheet of timesheets) {
    const hours = roundHours(sheet.duration_seconds);
    totalHours += hours;

    worksheet.addRow({
      date: format(new Date(sheet.timesheet_date), "MM/dd/yyyy"),
      employee: nameMap[sheet.qb_user_id] ?? "Unknown",
      hours,
      notes: sheet.notes ?? "",
    });
  }

  worksheet.addRow({});
  const totalRow = worksheet.addRow({
    date: "Total Hours",
    hours: Math.round(totalHours * 100) / 100,
  });
  totalRow.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `time-export-${projectRow?.job_number ?? projectId}-${start}-to-${end}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
