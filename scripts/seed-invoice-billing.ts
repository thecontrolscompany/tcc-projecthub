import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

type InvoiceRow = {
  periodMonth: string;
  projectName: string;
  actualBilled: number;
};

type ProjectRow = {
  id: string;
  name: string;
  estimated_income: number | null;
  is_active: boolean;
};

type BillingPeriodRow = {
  id: string;
  project_id: string;
  period_month: string;
  actual_billed: number | null;
  prev_billed: number;
};

const INVOICE_DATA: InvoiceRow[] = [
  { periodMonth: "2026-01-01", projectName: "Eglin 1416", actualBilled: 209852.0 },
  { periodMonth: "2026-01-01", projectName: "Pivotal Healthcare", actualBilled: 4972.65 },
  { periodMonth: "2026-01-01", projectName: "SOF Human Performance Training", actualBilled: 21750.87 },
  { periodMonth: "2026-02-01", projectName: "Crestview Elementary", actualBilled: 33826.32 },
  { periodMonth: "2026-02-01", projectName: "Eglin Wildcat Facility", actualBilled: 15665.32 },
  { periodMonth: "2026-02-01", projectName: "Titan Hangar 3", actualBilled: 11354.08 },
  { periodMonth: "2026-02-01", projectName: "Daphne Elementary South", actualBilled: 15529.11 },
  { periodMonth: "2026-02-01", projectName: "Mobile Arena", actualBilled: 45000.0 },
  { periodMonth: "2026-02-01", projectName: "Soundside High School", actualBilled: 6659.14 },
  { periodMonth: "2026-02-01", projectName: "Eglin Airman", actualBilled: 20135.58 },
  { periodMonth: "2026-02-01", projectName: "Triple H Labor", actualBilled: 13476.06 },
  { periodMonth: "2026-02-01", projectName: "SOF Human Performance Training", actualBilled: 12000.0 },
  { periodMonth: "2026-02-01", projectName: "Eglin 1416", actualBilled: 64231.0 },
  { periodMonth: "2026-03-01", projectName: "Arena Toilet Controls", actualBilled: 6990.0 },
  { periodMonth: "2026-03-01", projectName: "Daphne Elementary South", actualBilled: 33199.51 },
  { periodMonth: "2026-03-01", projectName: "Mobile Arena", actualBilled: 69394.32 },
  { periodMonth: "2026-03-01", projectName: "Titan Lighting", actualBilled: 29448.0 },
  { periodMonth: "2026-03-01", projectName: "NAS Fitness Center B832", actualBilled: 10035.0 },
  { periodMonth: "2026-03-01", projectName: "Crestview Elementary", actualBilled: 52277.04 },
  { periodMonth: "2026-03-01", projectName: "Destin Elementary", actualBilled: 12595.68 },
  { periodMonth: "2026-03-01", projectName: "Eglin Wildcat Facility", actualBilled: 11392.96 },
  { periodMonth: "2026-03-01", projectName: "Pivotal Healthcare", actualBilled: 9945.3 },
  { periodMonth: "2026-03-01", projectName: "Titan Hangar 3", actualBilled: 47545.21 },
  { periodMonth: "2026-03-01", projectName: "Eglin Airman", actualBilled: 2188.65 },
  { periodMonth: "2026-03-01", projectName: "SOF Human Performance Training", actualBilled: 29250.93 },
  { periodMonth: "2026-03-01", projectName: "Magnolia Elementary", actualBilled: 1717.5 },
  { periodMonth: "2026-03-01", projectName: "Robertsdale Elementary Chiller Upgrade", actualBilled: 2584.65 },
  { periodMonth: "2026-04-01", projectName: "Triple H Labor", actualBilled: 15951.78 },
];

const PROJECT_NAME_ALIASES: Record<string, string> = {
  "Daphne Elementary South": "2024-006 - Daphne South Elem",
  "NAS Fitness Center B832": "2023-015 - NAS B832 Fitness Center",
};

const EXCLUDED_PROJECT_NAMES = new Set(["Triple H Labor"]);

const dryRun = process.argv.includes("--dry-run");

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function billingKey(projectId: string, periodMonth: string) {
  return `${projectId}::${periodMonth}`;
}

function matchProject(projects: ProjectRow[], invoiceProjectName: string) {
  const normalizedInvoiceName = normalizeName(invoiceProjectName);
  const exactMatch = projects.find((project) => normalizeName(project.name) === normalizedInvoiceName);
  if (exactMatch) return exactMatch;

  const containsMatches = projects.filter((project) => {
    const normalizedProjectName = normalizeName(project.name);
    return (
      normalizedProjectName.includes(normalizedInvoiceName) ||
      normalizedInvoiceName.includes(normalizedProjectName)
    );
  });

  if (containsMatches.length === 1) return containsMatches[0];
  return null;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name, estimated_income, is_active");

  if (projectsError) {
    throw new Error(`Failed to load projects: ${projectsError.message}`);
  }

  const { data: billingPeriods, error: billingPeriodsError } = await supabase
    .from("billing_periods")
    .select("id, project_id, period_month, actual_billed, prev_billed")
    .order("period_month", { ascending: true });

  if (billingPeriodsError) {
    throw new Error(`Failed to load billing periods: ${billingPeriodsError.message}`);
  }

  const allProjects = (projects ?? []) as ProjectRow[];
  const allBillingPeriods = (billingPeriods ?? []) as BillingPeriodRow[];
  const billingPeriodsByKey = new Map<string, BillingPeriodRow>();
  const billedAmountsByProjectMonth = new Map<string, number>();

  for (const period of allBillingPeriods) {
    billingPeriodsByKey.set(billingKey(period.project_id, period.period_month), period);
    billedAmountsByProjectMonth.set(
      billingKey(period.project_id, period.period_month),
      roundCurrency(period.actual_billed ?? 0)
    );
  }

  const excludedRows = INVOICE_DATA.filter((row) => EXCLUDED_PROJECT_NAMES.has(row.projectName));
  const rowsToProcess = INVOICE_DATA.filter((row) => !EXCLUDED_PROJECT_NAMES.has(row.projectName));

  const sortedRows = [...rowsToProcess].sort((a, b) => {
    if (a.periodMonth === b.periodMonth) {
      return a.projectName.localeCompare(b.projectName);
    }
    return a.periodMonth.localeCompare(b.periodMonth);
  });

  let updatedCount = 0;
  let createdCount = 0;
  let skippedCount = 0;
  const unmatchedNames = new Set<string>();

  console.log(dryRun ? "Running invoice billing seed in DRY RUN mode." : "Running invoice billing seed.");
  if (excludedRows.length > 0) {
    console.log(
      `Excluding ${excludedRows.length} row(s): ${Array.from(new Set(excludedRows.map((row) => row.projectName))).join(", ")}`
    );
  }

  for (const row of sortedRows) {
    const amount = roundCurrency(row.actualBilled);
    const projectNameToMatch = PROJECT_NAME_ALIASES[row.projectName] ?? row.projectName;
    const matchedProject = matchProject(allProjects, projectNameToMatch);

    if (!matchedProject) {
      skippedCount += 1;
      unmatchedNames.add(row.projectName);
      console.warn(`WARNING unmatched project: ${row.projectName}`);
      continue;
    }

    const periodKey = billingKey(matchedProject.id, row.periodMonth);
    const existingPeriod = billingPeriodsByKey.get(periodKey);

    if (existingPeriod) {
      if (!dryRun) {
        const { error } = await supabase
          .from("billing_periods")
          .update({ actual_billed: amount })
          .eq("id", existingPeriod.id);

        if (error) {
          throw new Error(
            `Failed to update billing period for ${matchedProject.name} ${row.periodMonth}: ${error.message}`
          );
        }
      }

      billedAmountsByProjectMonth.set(periodKey, amount);
      updatedCount += 1;
      console.log(`UPDATED ${matchedProject.name} ${row.periodMonth} actual_billed = ${formatCurrency(amount)}`);
      continue;
    }

    let prevBilled = 0;
    for (const [existingKey, existingAmount] of billedAmountsByProjectMonth.entries()) {
      const [projectId, periodMonth] = existingKey.split("::");
      if (projectId === matchedProject.id && periodMonth < row.periodMonth) {
        prevBilled += existingAmount;
      }
    }
    prevBilled = roundCurrency(prevBilled);

    if (!dryRun) {
      const { data: createdPeriod, error } = await supabase
        .from("billing_periods")
        .insert({
          project_id: matchedProject.id,
          period_month: row.periodMonth,
          actual_billed: amount,
          prev_billed: prevBilled,
          pct_complete: 0,
          prior_pct: 0,
          estimated_income_snapshot: roundCurrency(matchedProject.estimated_income ?? 0),
          synced_from_onedrive: false,
          notes: null,
        })
        .select("id, project_id, period_month, actual_billed, prev_billed")
        .single();

      if (error) {
        throw new Error(
          `Failed to create billing period for ${matchedProject.name} ${row.periodMonth}: ${error.message}`
        );
      }

      billingPeriodsByKey.set(periodKey, createdPeriod as BillingPeriodRow);
    } else {
      billingPeriodsByKey.set(periodKey, {
        id: `dry-run:${periodKey}`,
        project_id: matchedProject.id,
        period_month: row.periodMonth,
        actual_billed: amount,
        prev_billed: prevBilled,
      });
    }

    billedAmountsByProjectMonth.set(periodKey, amount);
    createdCount += 1;
    console.log(
      `CREATED ${matchedProject.name} ${row.periodMonth} actual_billed = ${formatCurrency(amount)} prev_billed = ${formatCurrency(prevBilled)}`
    );
  }

  console.log("");
  console.log("Summary");
  console.log(`Total rows processed: ${sortedRows.length}`);
  console.log(`Excluded count: ${excludedRows.length}`);
  console.log(`Updated count: ${updatedCount}`);
  console.log(`Created count: ${createdCount}`);
  console.log(`Skipped/unmatched count: ${skippedCount}`);
  if (unmatchedNames.size > 0) {
    console.log(`Unmatched project names: ${Array.from(unmatchedNames).sort().join(", ")}`);
  } else {
    console.log("Unmatched project names: none");
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
