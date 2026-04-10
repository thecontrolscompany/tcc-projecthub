import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Buffer } from "node:buffer";
import { format } from "date-fns";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

type ParsedImportRow = {
  project_name_raw: string;
  period_month: string;
  amount: number;
};

type ProjectLookup = {
  id: string;
  name: string;
  estimated_income: number | null;
};

type MatchConfidence = "exact" | "fuzzy" | "none";

type PreviewRow = ParsedImportRow & {
  matched_project_id: string | null;
  matched_project_name: string | null;
  match_confidence: MatchConfidence;
};

type OverrideRow = {
  project_name_raw: string;
  period_month: string;
  project_id: string;
};

type BillingPeriodRow = {
  id: string;
  project_id: string;
  period_month: string;
  estimated_income_snapshot: number | null;
  pct_complete: number | null;
  prior_pct: number | null;
  prev_billed: number | null;
  actual_billed: number | null;
};

function getCellText(value: ExcelJS.CellValue | undefined | null): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return format(value, "M/d/yyyy");
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value && value.result != null) return getCellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
  }
  return String(value).trim();
}

function getCellNumber(value: ExcelJS.CellValue | undefined | null): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,()\s]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && "result" in value && value.result != null) {
    return getCellNumber(value.result as ExcelJS.CellValue);
  }
  return null;
}

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const fractionalDay = serial - Math.floor(serial) + 0.0000001;
  const totalSeconds = Math.floor(utcValue + fractionalDay * 86400);
  const date = new Date(totalSeconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseExcelDate(value: ExcelJS.CellValue | undefined | null): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") return excelSerialToDate(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const [, month, day, year] = slashMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  if (typeof value === "object" && "result" in value && value.result != null) {
    return parseExcelDate(value.result as ExcelJS.CellValue);
  }
  return null;
}

function buildRowKey(projectNameRaw: string, periodMonth: string) {
  return `${projectNameRaw}__${periodMonth}`;
}

async function parseWorkbook(file: File): Promise<ParsedImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  const fileBuffer = Buffer.from(await file.arrayBuffer()) as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(fileBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("No worksheet found in workbook.");
  }

  const grouped = new Map<string, ParsedImportRow>();

  for (let rowNumber = 6; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const firstCellText = getCellText(row.getCell(1).value);

    if (!firstCellText) break;
    if (firstCellText.toUpperCase() === "TOTAL") break;

    const transactionType = getCellText(row.getCell(2).value);
    if (transactionType !== "Invoice") continue;

    const invoiceDate = parseExcelDate(row.getCell(1).value);
    if (!invoiceDate) continue;

    const nameCell = getCellText(row.getCell(4).value);
    const colonIndex = nameCell.indexOf(":");
    if (colonIndex < 0) continue;

    const projectNameRaw = nameCell.slice(colonIndex + 1).trim();
    if (!projectNameRaw) continue;

    const amount = getCellNumber(row.getCell(8).value);
    if (amount === null) continue;

    const periodMonth = format(new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), 1), "yyyy-MM-01");
    const key = buildRowKey(projectNameRaw, periodMonth);
    const existing = grouped.get(key);

    if (existing) {
      existing.amount += amount;
    } else {
      grouped.set(key, {
        project_name_raw: projectNameRaw,
        period_month: periodMonth,
        amount,
      });
    }
  }

  return [...grouped.values()].sort((a, b) => {
    if (a.project_name_raw !== b.project_name_raw) {
      return a.project_name_raw.localeCompare(b.project_name_raw);
    }
    return a.period_month.localeCompare(b.period_month);
  });
}

function scoreProjectMatch(projectNameRaw: string, projectName: string) {
  const rawLower = projectNameRaw.toLowerCase();
  const projectLower = projectName.toLowerCase();
  const words = rawLower.split(/[^a-z0-9]+/i).filter((word) => word.length > 4);
  const matchedWords = words.filter((word, index) => words.indexOf(word) === index && projectLower.includes(word));

  if (matchedWords.length === 0) {
    return 0;
  }

  return matchedWords.length * 10 + (projectLower.includes(rawLower) ? 5 : 0);
}

function matchProject(projectNameRaw: string, projects: ProjectLookup[]): {
  matched_project_id: string | null;
  matched_project_name: string | null;
  match_confidence: MatchConfidence;
} {
  const rawLower = projectNameRaw.trim().toLowerCase();
  const exactMatches = projects.filter((project) => project.name.trim().toLowerCase() === rawLower);

  if (exactMatches.length === 1) {
    return {
      matched_project_id: exactMatches[0].id,
      matched_project_name: exactMatches[0].name,
      match_confidence: "exact",
    };
  }

  const scored = projects
    .map((project) => ({
      project,
      score: scoreProjectMatch(projectNameRaw, project.name),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.project.name.localeCompare(b.project.name));

  if (scored.length === 1) {
    return {
      matched_project_id: scored[0].project.id,
      matched_project_name: scored[0].project.name,
      match_confidence: "fuzzy",
    };
  }

  if (scored.length > 1 && scored[0].score > scored[1].score) {
    return {
      matched_project_id: scored[0].project.id,
      matched_project_name: scored[0].project.name,
      match_confidence: "fuzzy",
    };
  }

  return {
    matched_project_id: null,
    matched_project_name: null,
    match_confidence: "none",
  };
}

function buildPreviewRows(rows: ParsedImportRow[], projects: ProjectLookup[]): PreviewRow[] {
  return rows.map((row) => ({
    ...row,
    ...matchProject(row.project_name_raw, projects),
  }));
}

async function recalculatePrevBilledForProjects(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  projectIds: string[]
) {
  if (projectIds.length === 0) return 0;

  const { data: billingPeriods, error } = await adminClient
    .from("billing_periods")
    .select("id, project_id, period_month, actual_billed, prev_billed")
    .in("project_id", projectIds)
    .order("project_id")
    .order("period_month");

  if (error) {
    throw new Error(error.message);
  }

  const updates: Array<{ id: string; prev_billed: number }> = [];
  const rows = (billingPeriods ?? []) as Array<{
    id: string;
    project_id: string;
    period_month: string;
    actual_billed: number | null;
    prev_billed: number | null;
  }>;

  let currentProjectId = "";
  let runningTotal = 0;

  for (const row of rows) {
    if (row.project_id !== currentProjectId) {
      currentProjectId = row.project_id;
      runningTotal = 0;
    }

    const nextPrevBilled = runningTotal;
    if ((row.prev_billed ?? 0) !== nextPrevBilled) {
      updates.push({ id: row.id, prev_billed: nextPrevBilled });
    }

    if (row.actual_billed !== null) {
      runningTotal += Number(row.actual_billed) || 0;
    }
  }

  await Promise.all(
    updates.map((update) =>
      adminClient
        .from("billing_periods")
        .update({ prev_billed: update.prev_billed })
        .eq("id", update.id)
    )
  );

  return projectIds.length;
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const profile = await resolveUserRole(user);
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const formData = await request.formData();
  const action = formData.get("action");
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Excel file is required." }, { status: 400 });
  }

  if (action !== "preview" && action !== "import") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  try {
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: rawProjects, error: projectsError } = await adminClient
      .from("projects")
      .select("id, name, estimated_income")
      .order("name");

    if (projectsError) {
      return NextResponse.json({ error: projectsError.message }, { status: 500 });
    }

    const projects = ((rawProjects ?? []) as ProjectLookup[]).sort((a, b) => a.name.localeCompare(b.name));
    const parsedRows = await parseWorkbook(file);
    const previewRows = buildPreviewRows(parsedRows, projects);

    if (action === "preview") {
      const matchedCount = previewRows.filter((row) => row.matched_project_id).length;
      const unmatchedCount = previewRows.length - matchedCount;

      return NextResponse.json({
        rows: previewRows,
        unmatched_count: unmatchedCount,
        matched_count: matchedCount,
        total_periods: previewRows.length,
        projects: projects.map((project) => ({ id: project.id, name: project.name })),
      });
    }

    const overridesRaw = formData.get("overrides");
    let overrides: OverrideRow[] = [];
    if (typeof overridesRaw === "string" && overridesRaw.trim()) {
      const parsed = JSON.parse(overridesRaw);
      if (Array.isArray(parsed)) {
        overrides = parsed.filter(
          (entry): entry is OverrideRow =>
            entry &&
            typeof entry.project_name_raw === "string" &&
            typeof entry.period_month === "string" &&
            typeof entry.project_id === "string"
        );
      }
    }

    const overrideMap = new Map<string, string>();
    for (const override of overrides) {
      if (override.project_id.trim()) {
        overrideMap.set(buildRowKey(override.project_name_raw, override.period_month), override.project_id);
      }
    }

    const resolvedRows = previewRows
      .map((row) => {
        const overrideProjectId = overrideMap.get(buildRowKey(row.project_name_raw, row.period_month));
        return {
          ...row,
          resolved_project_id: overrideProjectId ?? row.matched_project_id,
        };
      })
      .filter((row) => row.resolved_project_id);

    const groupedByResolvedProjectAndMonth = new Map<string, { project_id: string; period_month: string; amount: number }>();
    for (const row of resolvedRows) {
      const projectId = row.resolved_project_id!;
      const key = `${projectId}__${row.period_month}`;
      const existing = groupedByResolvedProjectAndMonth.get(key);
      if (existing) {
        existing.amount += row.amount;
      } else {
        groupedByResolvedProjectAndMonth.set(key, {
          project_id: projectId,
          period_month: row.period_month,
          amount: row.amount,
        });
      }
    }

    const groupedRows = [...groupedByResolvedProjectAndMonth.values()];
    const affectedProjectIds = [...new Set(groupedRows.map((row) => row.project_id))];
    const skipped = previewRows.length - groupedRows.length;

    if (groupedRows.length === 0) {
      return NextResponse.json({ imported: 0, skipped, updated_prev_billed_for: 0 });
    }

    const { data: existingPeriods, error: periodsError } = await adminClient
      .from("billing_periods")
      .select("id, project_id, period_month, estimated_income_snapshot, pct_complete, prior_pct, prev_billed, actual_billed")
      .in("project_id", affectedProjectIds);

    if (periodsError) {
      return NextResponse.json({ error: periodsError.message }, { status: 500 });
    }

    const periodRows = (existingPeriods ?? []) as BillingPeriodRow[];
    const periodMap = new Map<string, BillingPeriodRow>();
    for (const period of periodRows) {
      periodMap.set(`${period.project_id}__${period.period_month}`, period);
    }

    const projectMap = new Map(projects.map((project) => [project.id, project]));

    const upserts = groupedRows.map((row) => {
      const existingPeriod = periodMap.get(`${row.project_id}__${row.period_month}`);
      const project = projectMap.get(row.project_id);

      if (existingPeriod) {
        return {
          project_id: row.project_id,
          period_month: row.period_month,
          actual_billed: row.amount,
          estimated_income_snapshot: existingPeriod.estimated_income_snapshot ?? project?.estimated_income ?? 0,
          pct_complete: existingPeriod.pct_complete ?? 0,
          prior_pct: existingPeriod.prior_pct ?? 0,
          prev_billed: existingPeriod.prev_billed ?? 0,
        };
      }

      const prevBilled = periodRows
        .filter((period) => period.project_id === row.project_id && period.period_month < row.period_month)
        .reduce((sum, period) => sum + (period.actual_billed ?? 0), 0);

      return {
        project_id: row.project_id,
        period_month: row.period_month,
        actual_billed: row.amount,
        estimated_income_snapshot: project?.estimated_income ?? 0,
        pct_complete: 0,
        prior_pct: 0,
        prev_billed: prevBilled,
      };
    });

    const { error: upsertError } = await adminClient.from("billing_periods").upsert(upserts, {
      onConflict: "project_id,period_month",
    });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const updatedPrevBilledFor = await recalculatePrevBilledForProjects(adminClient, affectedProjectIds);

    return NextResponse.json({
      imported: groupedRows.length,
      skipped,
      updated_prev_billed_for: updatedPrevBilledFor,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Billing import failed." },
      { status: 500 }
    );
  }
}
