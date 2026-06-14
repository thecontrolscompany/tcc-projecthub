import type { SupabaseClient } from "@supabase/supabase-js";

export type ProjectBudgetCategory = "labor" | "material" | "subcontractor" | "other";

export const MANUAL_BUDGET_CATEGORIES = ["labor", "subcontractor", "other"] as const;

export interface ProjectBudgetLine {
  id: string;
  project_id: string;
  category: ProjectBudgetCategory;
  description: string | null;
  budgeted_cost: number;
  actual_cost: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectBudgetCategoryTotal {
  budgeted: number;
  actual: number;
}

export interface ProjectBudgetSummary {
  laborRate: number;
  lines: ProjectBudgetLine[];
  totals: {
    labor: ProjectBudgetCategoryTotal & { actualHours: number };
    material: ProjectBudgetCategoryTotal;
    subcontractor: ProjectBudgetCategoryTotal;
    other: ProjectBudgetCategoryTotal;
  };
}

const DEFAULT_LABOR_RATE = 42.95;

function roundHours(seconds: number) {
  return Math.round((seconds / 3600) * 10) / 10;
}

/**
 * Computes budget vs actual totals for a project:
 * - Labor budgeted from project_budget rows; actual = QB Time hours x labor_rate
 * - Material budgeted/actual derived from bom_items.unit_cost x qty_required / receipts
 * - Subcontractor/other budgeted+actual from project_budget rows (manual, no QBO yet)
 */
export async function computeProjectBudget(
  adminClient: SupabaseClient,
  projectId: string
): Promise<ProjectBudgetSummary | null> {
  const { data: project, error: projectError } = await adminClient
    .from("projects")
    .select("id, labor_rate")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) throw projectError;
  if (!project) return null;

  const laborRate = Number(project.labor_rate ?? DEFAULT_LABOR_RATE);

  const [budgetResult, bomResult, mappingsResult] = await Promise.all([
    adminClient
      .from("project_budget")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    adminClient
      .from("bom_items")
      .select("id, qty_required, unit_cost")
      .eq("project_id", projectId),
    adminClient
      .from("project_qb_time_mappings")
      .select("qb_jobcode_id")
      .eq("project_id", projectId),
  ]);

  if (budgetResult.error) throw budgetResult.error;
  if (bomResult.error) throw bomResult.error;
  if (mappingsResult.error) throw mappingsResult.error;

  const lines = (budgetResult.data ?? []) as ProjectBudgetLine[];
  const bomItems = (bomResult.data ?? []) as Array<{ id: string; qty_required: number; unit_cost: number | null }>;

  const materialBudgeted = bomItems.reduce(
    (sum, item) => sum + Number(item.qty_required ?? 0) * Number(item.unit_cost ?? 0),
    0
  );

  let materialActual = 0;
  if (bomItems.length > 0) {
    const unitCostById = new Map(bomItems.map((item) => [item.id, Number(item.unit_cost ?? 0)]));

    const { data: receipts, error: receiptsError } = await adminClient
      .from("material_receipts")
      .select("bom_item_id, qty_received")
      .in("bom_item_id", bomItems.map((item) => item.id));

    if (receiptsError) throw receiptsError;

    for (const receipt of receipts ?? []) {
      const unitCost = unitCostById.get(receipt.bom_item_id) ?? 0;
      materialActual += Number(receipt.qty_received ?? 0) * unitCost;
    }
  }

  const jobcodeIds = [...new Set((mappingsResult.data ?? []).map((row) => row.qb_jobcode_id as number))];

  let actualHours = 0;
  if (jobcodeIds.length > 0) {
    const { data: timesheets, error: timesheetsError } = await adminClient
      .from("qb_time_timesheets")
      .select("duration_seconds")
      .in("qb_jobcode_id", jobcodeIds)
      .gt("duration_seconds", 0);

    if (timesheetsError) throw timesheetsError;

    const totalSeconds = (timesheets ?? []).reduce((sum, row) => sum + (row.duration_seconds ?? 0), 0);
    actualHours = roundHours(totalSeconds);
  }

  const manualTotals: Record<"labor" | "subcontractor" | "other", ProjectBudgetCategoryTotal> = {
    labor: { budgeted: 0, actual: 0 },
    subcontractor: { budgeted: 0, actual: 0 },
    other: { budgeted: 0, actual: 0 },
  };

  for (const line of lines) {
    if (line.category === "labor" || line.category === "subcontractor" || line.category === "other") {
      manualTotals[line.category].budgeted += Number(line.budgeted_cost ?? 0);
      manualTotals[line.category].actual += Number(line.actual_cost ?? 0);
    }
  }

  return {
    laborRate,
    lines,
    totals: {
      labor: {
        budgeted: manualTotals.labor.budgeted,
        actual: actualHours * laborRate,
        actualHours,
      },
      material: {
        budgeted: materialBudgeted,
        actual: materialActual,
      },
      subcontractor: manualTotals.subcontractor,
      other: manualTotals.other,
    },
  };
}
