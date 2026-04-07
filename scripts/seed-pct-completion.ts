import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

type PctRow = {
  periodMonth: string;
  projectName: string;
  pctComplete: number;
};

type ProjectRow = {
  id: string;
  name: string;
  estimated_income: number | null;
};

type BillingPeriodRow = {
  id: string;
  project_id: string;
  period_month: string;
  actual_billed: number | null;
  prev_billed: number;
  pct_complete: number;
  prior_pct: number;
};

const PCT_DATA: PctRow[] = [
  { periodMonth: "2026-01-01", projectName: "Crestview Elementary", pctComplete: 0.46 },
  { periodMonth: "2026-01-01", projectName: "Cytiva Belt 8", pctComplete: 0.88 },
  { periodMonth: "2026-01-01", projectName: "Daphne Elementary South", pctComplete: 0.4 },
  { periodMonth: "2026-01-01", projectName: "Daphne HS Additions", pctComplete: 0.1 },
  { periodMonth: "2026-01-01", projectName: "Destin Elementary", pctComplete: 0.19 },
  { periodMonth: "2026-01-01", projectName: "Eglin Airman", pctComplete: 0.94 },
  { periodMonth: "2026-01-01", projectName: "Eglin Wildcat Facility", pctComplete: 0.74 },
  { periodMonth: "2026-01-01", projectName: "Elberta Elementary", pctComplete: 0.7 },
  { periodMonth: "2026-01-01", projectName: "Elberta Middle School", pctComplete: 0.05 },
  { periodMonth: "2026-01-01", projectName: "Hurlburt Dorms B90369", pctComplete: 0.0 },
  { periodMonth: "2026-01-01", projectName: "Magnolia Elementary", pctComplete: 0.85 },
  { periodMonth: "2026-01-01", projectName: "Mobile Arena", pctComplete: 0.09 },
  { periodMonth: "2026-01-01", projectName: "NAS Fitness Center", pctComplete: 0.1 },
  { periodMonth: "2026-01-01", projectName: "SOF Human Performance", pctComplete: 0.29 },
  { periodMonth: "2026-01-01", projectName: "Soundside High School", pctComplete: 1.0 },
  { periodMonth: "2026-01-01", projectName: "Titan Hangar 3", pctComplete: 0.31 },
  { periodMonth: "2026-02-01", projectName: "Arena Toilet Controls", pctComplete: 0.2 },
  { periodMonth: "2026-02-01", projectName: "Crestview Elementary", pctComplete: 0.57 },
  { periodMonth: "2026-02-01", projectName: "Cytiva Belt 8", pctComplete: 0.88 },
  { periodMonth: "2026-02-01", projectName: "Daphne Elementary South", pctComplete: 0.5 },
  { periodMonth: "2026-02-01", projectName: "Daphne HS Additions", pctComplete: 0.1 },
  { periodMonth: "2026-02-01", projectName: "Destin Elementary", pctComplete: 0.2192 },
  { periodMonth: "2026-02-01", projectName: "Eglin 1416", pctComplete: 0.1717 },
  { periodMonth: "2026-02-01", projectName: "Eglin Airman", pctComplete: 0.96 },
  { periodMonth: "2026-02-01", projectName: "Eglin Wildcat Facility", pctComplete: 0.81 },
  { periodMonth: "2026-02-01", projectName: "Elberta Elementary", pctComplete: 0.7 },
  { periodMonth: "2026-02-01", projectName: "Elberta Middle School", pctComplete: 0.05 },
  { periodMonth: "2026-02-01", projectName: "Hurlburt Dorms B90369", pctComplete: 0.0 },
  { periodMonth: "2026-02-01", projectName: "Magnolia Elementary", pctComplete: 0.85 },
  { periodMonth: "2026-02-01", projectName: "Mobile Arena", pctComplete: 0.12 },
  { periodMonth: "2026-02-01", projectName: "Mobile Arena CO-2", pctComplete: 0.75 },
  { periodMonth: "2026-02-01", projectName: "NAS Fitness Center", pctComplete: 0.3875 },
  { periodMonth: "2026-02-01", projectName: "Pivotal Healthcare", pctComplete: 0.2 },
  { periodMonth: "2026-02-01", projectName: "SOF Human Performance", pctComplete: 0.6 },
  { periodMonth: "2026-02-01", projectName: "Soundside High School", pctComplete: 1.0 },
  { periodMonth: "2026-02-01", projectName: "Titan Hangar 3", pctComplete: 0.84 },
  { periodMonth: "2026-02-01", projectName: "Titan Lighting", pctComplete: 0.25 },
  { periodMonth: "2026-03-01", projectName: "Arena Toilet Controls", pctComplete: 0.12 },
  { periodMonth: "2026-03-01", projectName: "Crestview Elementary", pctComplete: 0.63 },
  { periodMonth: "2026-03-01", projectName: "Cytiva Belt 8", pctComplete: 0.88 },
  { periodMonth: "2026-03-01", projectName: "Daphne Elementary South", pctComplete: 0.66 },
  { periodMonth: "2026-03-01", projectName: "Daphne HS Additions", pctComplete: 0.1 },
  { periodMonth: "2026-03-01", projectName: "Destin Elementary", pctComplete: 0.0 },
  { periodMonth: "2026-03-01", projectName: "Eastern Shore Transportation", pctComplete: 0.0 },
  { periodMonth: "2026-03-01", projectName: "Eglin 1416", pctComplete: 0.2214 },
  { periodMonth: "2026-03-01", projectName: "Eglin Airman", pctComplete: 1.0 },
  { periodMonth: "2026-03-01", projectName: "Eglin Wildcat Facility", pctComplete: 0.9 },
  { periodMonth: "2026-03-01", projectName: "Elberta Elementary", pctComplete: 0.7 },
  { periodMonth: "2026-03-01", projectName: "Elberta Middle School", pctComplete: 0.05 },
  { periodMonth: "2026-03-01", projectName: "Hurlburt Dorms B90369", pctComplete: 0.0 },
  { periodMonth: "2026-03-01", projectName: "Magnolia Elementary", pctComplete: 1.0 },
  { periodMonth: "2026-03-01", projectName: "Mobile Arena", pctComplete: 0.16 },
  { periodMonth: "2026-03-01", projectName: "NAS Fitness Center", pctComplete: 0.3875 },
  { periodMonth: "2026-03-01", projectName: "Pivotal Healthcare", pctComplete: 0.45 },
  { periodMonth: "2026-03-01", projectName: "Robertsdale Elementary", pctComplete: 0.15 },
  { periodMonth: "2026-03-01", projectName: "Rutherford High School Building 1", pctComplete: 0.0 },
  { periodMonth: "2026-03-01", projectName: "SOF Human Performance", pctComplete: 0.84 },
  { periodMonth: "2026-03-01", projectName: "Soundside High School", pctComplete: 1.0 },
  { periodMonth: "2026-03-01", projectName: "Titan Hangar 3", pctComplete: 0.98 },
  { periodMonth: "2026-03-01", projectName: "Titan Lighting", pctComplete: 0.6 },
  { periodMonth: "2026-03-01", projectName: "Triple H Labor", pctComplete: 1.0 },
];

const PROJECT_NAME_ALIASES: Record<string, string[]> = {
  "SOF Human Performance": ["SOF Human Performance Training"],
  "NAS Fitness Center": ["2023-015 - NAS B832 Fitness Center"],
  "Daphne Elementary South": ["2024-006 - Daphne South Elem"],
  "Robertsdale Elementary": ["Robertsdale Elementary Chiller Upgrade"],
  "Rutherford High School Building 1": ["Rutherford High School"],
};

const EXCLUDED_PROJECT_NAMES = new Set([
  "Mobile Arena CO-2",
  "Triple H Labor",
]);

const dryRun = process.argv.includes("--dry-run");

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function billingKey(projectId: string, periodMonth: string) {
  return `${projectId}::${periodMonth}`;
}

function matchByRule(projects: ProjectRow[], candidateName: string) {
  const normalizedCandidate = normalizeName(candidateName);
  const exactMatch = projects.find((project) => normalizeName(project.name) === normalizedCandidate);
  if (exactMatch) return exactMatch;

  const containsMatches = projects.filter((project) => {
    const normalizedProjectName = normalizeName(project.name);
    return (
      normalizedProjectName.includes(normalizedCandidate) ||
      normalizedCandidate.includes(normalizedProjectName)
    );
  });

  if (containsMatches.length === 1) return containsMatches[0];
  return null;
}

function matchProject(projects: ProjectRow[], projectName: string) {
  const candidates = [projectName, ...(PROJECT_NAME_ALIASES[projectName] ?? [])];
  for (const candidate of candidates) {
    const match = matchByRule(projects, candidate);
    if (match) return match;
  }
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
    .select("id, name, estimated_income");

  if (projectsError) {
    throw new Error(`Failed to load projects: ${projectsError.message}`);
  }

  const { data: billingPeriods, error: billingPeriodsError } = await supabase
    .from("billing_periods")
    .select("id, project_id, period_month, actual_billed, prev_billed, pct_complete, prior_pct")
    .order("period_month", { ascending: true });

  if (billingPeriodsError) {
    throw new Error(`Failed to load billing periods: ${billingPeriodsError.message}`);
  }

  const allProjects = (projects ?? []) as ProjectRow[];
  const allBillingPeriods = (billingPeriods ?? []) as BillingPeriodRow[];
  const billingPeriodsByKey = new Map<string, BillingPeriodRow>();

  for (const period of allBillingPeriods) {
    billingPeriodsByKey.set(billingKey(period.project_id, period.period_month), period);
  }

  const excludedRows = PCT_DATA.filter((row) => EXCLUDED_PROJECT_NAMES.has(row.projectName));
  const rowsToProcess = PCT_DATA.filter((row) => !EXCLUDED_PROJECT_NAMES.has(row.projectName));

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

  console.log(dryRun ? "Running pct completion seed in DRY RUN mode." : "Running pct completion seed.");
  if (excludedRows.length > 0) {
    console.log(
      `Excluding ${excludedRows.length} row(s): ${Array.from(new Set(excludedRows.map((row) => row.projectName))).join(", ")}`
    );
  }

  for (const row of sortedRows) {
    const matchedProject = matchProject(allProjects, row.projectName);

    if (!matchedProject) {
      skippedCount += 1;
      unmatchedNames.add(row.projectName);
      console.warn(`WARNING unmatched project: ${row.projectName}`);
      continue;
    }

    const projectPeriods = Array.from(billingPeriodsByKey.values())
      .filter((period) => period.project_id === matchedProject.id)
      .sort((a, b) => a.period_month.localeCompare(b.period_month));

    const priorPeriod = [...projectPeriods]
      .filter((period) => period.period_month < row.periodMonth)
      .sort((a, b) => b.period_month.localeCompare(a.period_month))[0] ?? null;

    const priorPct = priorPeriod ? priorPeriod.pct_complete : 0;
    const periodKey = billingKey(matchedProject.id, row.periodMonth);
    const existingPeriod = billingPeriodsByKey.get(periodKey);

    if (existingPeriod) {
      if (!dryRun) {
        const { error } = await supabase
          .from("billing_periods")
          .update({
            pct_complete: row.pctComplete,
            prior_pct: priorPct,
          })
          .eq("id", existingPeriod.id);

        if (error) {
          throw new Error(
            `Failed to update billing period for ${matchedProject.name} ${row.periodMonth}: ${error.message}`
          );
        }
      }

      billingPeriodsByKey.set(periodKey, {
        ...existingPeriod,
        pct_complete: row.pctComplete,
        prior_pct: priorPct,
      });
      updatedCount += 1;
      console.log(`UPDATED ${matchedProject.name} ${row.periodMonth} pct_complete = ${row.pctComplete}`);
      continue;
    }

    const prevBilled = roundCurrency(
      projectPeriods
        .filter((period) => period.period_month < row.periodMonth)
        .reduce((sum, period) => sum + (period.actual_billed ?? 0), 0)
    );

    const newPeriod: BillingPeriodRow = {
      id: dryRun ? `dry-run:${periodKey}` : "",
      project_id: matchedProject.id,
      period_month: row.periodMonth,
      actual_billed: null,
      prev_billed: prevBilled,
      pct_complete: row.pctComplete,
      prior_pct: priorPct,
    };

    if (!dryRun) {
      const { data: createdPeriod, error } = await supabase
        .from("billing_periods")
        .insert({
          project_id: matchedProject.id,
          period_month: row.periodMonth,
          pct_complete: row.pctComplete,
          prior_pct: priorPct,
          prev_billed: prevBilled,
          actual_billed: null,
          estimated_income_snapshot: roundCurrency(matchedProject.estimated_income ?? 0),
          synced_from_onedrive: false,
          notes: null,
        })
        .select("id, project_id, period_month, actual_billed, prev_billed, pct_complete, prior_pct")
        .single();

      if (error) {
        throw new Error(
          `Failed to create billing period for ${matchedProject.name} ${row.periodMonth}: ${error.message}`
        );
      }

      billingPeriodsByKey.set(periodKey, createdPeriod as BillingPeriodRow);
    } else {
      billingPeriodsByKey.set(periodKey, newPeriod);
    }

    createdCount += 1;
    console.log(`CREATED ${matchedProject.name} ${row.periodMonth} pct_complete = ${row.pctComplete}`);
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
