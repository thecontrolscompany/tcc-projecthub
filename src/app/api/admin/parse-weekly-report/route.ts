import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

type ParsedWeeklyUpdate = {
  sheetName: string;
  weekOf: string | null;
  pmName: string | null;
  crewLog: Array<{ day: string; men: number; hours: number; activities: string }>;
  materialDelivered: string | null;
  equipmentSet: string | null;
  safetyIncidents: string | null;
  inspectionsTests: string | null;
  totalMen: number;
  totalHours: number;
  alreadyExists: boolean;
  parseError: string | null;
};

const DAY_NAMES = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);

function excelSerialToDate(serial: number) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getCellText(value: ExcelJS.CellValue | undefined | null): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value && value.result != null) return getCellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
  }
  return String(value).trim();
}

function findLabeledRow(ws: ExcelJS.Worksheet, label: string) {
  for (const row of ws.getRows(1, ws.rowCount) ?? []) {
    const cellA = getCellText(row.getCell(1).value);
    if (cellA.toLowerCase().includes(label.toLowerCase())) {
      return row;
    }
  }
  return null;
}

function parseDateFromSheetName(sheetName: string) {
  const match = sheetName.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = match[3].length === 2 ? Number(`20${match[3]}`) : Number(match[3]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseWeekOf(row: ExcelJS.Row | null, sheetName: string) {
  if (row) {
    const rawValue = row.getCell(3).value;
    if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
      return formatIsoDate(rawValue);
    }
    if (typeof rawValue === "number") {
      const excelDate = excelSerialToDate(rawValue);
      if (!Number.isNaN(excelDate.getTime())) {
        return formatIsoDate(excelDate);
      }
    }

    const dateText = getCellText(rawValue);
    if (dateText) {
      const parsed = new Date(dateText);
      if (!Number.isNaN(parsed.getTime())) {
        return formatIsoDate(parsed);
      }
    }
  }

  const sheetDate = parseDateFromSheetName(sheetName);
  return sheetDate ? formatIsoDate(sheetDate) : null;
}

function parseWorksheet(ws: ExcelJS.Worksheet): ParsedWeeklyUpdate {
  const reportDateRow = findLabeledRow(ws, "Report Date:");
  const pmRow = findLabeledRow(ws, "Project Manager:");

  const weekOf = parseWeekOf(reportDateRow, ws.name);
  const crewLog: ParsedWeeklyUpdate["crewLog"] = [];

  for (const row of ws.getRows(1, ws.rowCount) ?? []) {
    const dayValue = getCellText(row.getCell(3).value);
    if (!DAY_NAMES.has(dayValue)) continue;

    const men = Number(getCellText(row.getCell(1).value)) || 0;
    const hours = Number(getCellText(row.getCell(2).value)) || 0;
    const activities = getCellText(row.getCell(4).value);

    if (men > 0 || hours > 0 || activities) {
      crewLog.push({
        day: dayValue,
        men,
        hours,
        activities,
      });
    }
  }

  return {
    sheetName: ws.name,
    weekOf,
    pmName: pmRow ? getCellText(pmRow.getCell(3).value) || null : null,
    crewLog,
    materialDelivered: findLabeledRow(ws, "Material Delivered") ? getCellText(findLabeledRow(ws, "Material Delivered")?.getCell(3).value) || null : null,
    equipmentSet: findLabeledRow(ws, "Equipment Set") ? getCellText(findLabeledRow(ws, "Equipment Set")?.getCell(3).value) || null : null,
    safetyIncidents: findLabeledRow(ws, "Safety Incidents") ? getCellText(findLabeledRow(ws, "Safety Incidents")?.getCell(3).value) || null : null,
    inspectionsTests: findLabeledRow(ws, "Inspections & Tests") ? getCellText(findLabeledRow(ws, "Inspections & Tests")?.getCell(3).value) || null : null,
    totalMen: crewLog.reduce((sum, row) => sum + row.men, 0),
    totalHours: crewLog.reduce((sum, row) => sum + row.hours, 0),
    alreadyExists: false,
    parseError: weekOf ? null : "Could not parse report date",
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const resolvedProfile = await resolveUserRole(user);
  if (!["admin", "ops_manager"].includes(resolvedProfile?.role ?? "")) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const projectId = String(formData.get("projectId") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  if (!projectId) {
    return NextResponse.json({ error: "Missing project ID." }, { status: 400 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const rows = workbook.worksheets.map((worksheet) => parseWorksheet(worksheet));
    const parsedWeekDates = rows.map((row) => row.weekOf).filter((value): value is string => Boolean(value));

    const { data: existingRows, error } = parsedWeekDates.length
      ? await adminClient
          .from("weekly_updates")
          .select("week_of")
          .eq("project_id", projectId)
          .in("week_of", parsedWeekDates)
      : { data: [], error: null };

    if (error) {
      throw error;
    }

    const existingWeekSet = new Set((existingRows ?? []).map((row) => row.week_of));

    return NextResponse.json({
      filename: file.name,
      rows: rows.map((row) => ({
        ...row,
        alreadyExists: row.weekOf ? existingWeekSet.has(row.weekOf) : false,
      })),
    });
  } catch (error) {
    console.error("Failed to parse weekly report:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to parse weekly report.",
    }, { status: 500 });
  }
}
