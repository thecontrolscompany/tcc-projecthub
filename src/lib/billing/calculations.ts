import { addMonths, format, startOfMonth } from "date-fns";
import type { BillingPeriod, BillingRow } from "@/types/database";

/**
 * Core billing formula from legacy Excel tracker.
 * Column J: To Bill This Period = MAX(EstIncome × %Complete - PrevBilled, 0)
 */
export function calcToBill(
  estimatedIncome: number,
  pctComplete: number,
  prevBilled: number
): number {
  return Math.max(estimatedIncome * pctComplete - prevBilled, 0);
}

/**
 * Backlog = Estimated Income - Previously Billed
 */
export function calcBacklog(estimatedIncome: number, prevBilled: number): number {
  return Math.max(estimatedIncome - prevBilled, 0);
}

/**
 * Previously Billed % = PrevBilled / EstimatedIncome
 */
export function calcPrevBilledPct(estimatedIncome: number, prevBilled: number): number {
  if (estimatedIncome === 0) return 0;
  return prevBilled / estimatedIncome;
}

/**
 * Derives computed fields for a billing row.
 */
export function computeBillingRow(
  period: BillingPeriod & {
    customer_name?: string;
    project_name?: string;
    pm_email?: string;
    pm_name?: string;
  }
): BillingRow {
  const est = period.estimated_income_snapshot;
  return {
    billing_period_id: period.id,
    project_id: period.project_id,
    customer_name: period.customer_name ?? "",
    project_name: period.project_name ?? "",
    pm_email: period.pm_email ?? "",
    pm_name: period.pm_name ?? "",
    estimated_income: est,
    backlog: calcBacklog(est, period.prev_billed),
    prior_pct: period.prior_pct,
    pct_complete: period.pct_complete,
    prev_billed: period.prev_billed,
    prev_billed_pct: calcPrevBilledPct(est, period.prev_billed),
    to_bill: calcToBill(est, period.pct_complete, period.prev_billed),
    actual_billed: period.actual_billed,
    synced_from_onedrive: period.synced_from_onedrive,
  };
}

/**
 * Roll-forward: given the current period's billing rows, generate
 * the next period's initial values. Called by the admin "Roll Forward" action.
 *
 * Rules (from legacy Module2):
 * - period_month → next month
 * - prior_pct    → current pct_complete
 * - pct_complete → same as prior_pct (carries forward, PM updates it)
 * - prev_billed  → prev_billed + (actual_billed ?? to_bill)
 * - estimated_income_snapshot → carries forward unchanged
 */
export function rollForwardRows(
  currentPeriod: BillingPeriod[]
): Omit<BillingPeriod, "id" | "updated_at">[] {
  const nextMonth = format(
    startOfMonth(addMonths(new Date(currentPeriod[0]?.period_month ?? new Date()), 1)),
    "yyyy-MM-dd"
  );

  return currentPeriod.map((row) => {
    const billedThisPeriod = row.actual_billed ?? calcToBill(
      row.estimated_income_snapshot,
      row.pct_complete,
      row.prev_billed
    );

    return {
      period_month: nextMonth,
      project_id: row.project_id,
      estimated_income_snapshot: row.estimated_income_snapshot,
      prior_pct: row.pct_complete,
      pct_complete: row.pct_complete, // PM will update
      prev_billed: row.prev_billed + billedThisPeriod,
      actual_billed: null,
      notes: null,
      synced_from_onedrive: false,
      to_bill: 0, // recalculated after PM updates pct
    };
  });
}

/**
 * Generate PM email bodies grouped by PM email.
 * Mirrors legacy Module5 GenerateBillingEmailText.
 */
export function generatePmEmailDrafts(
  rows: BillingRow[]
): Array<{ pmEmail: string; pmName: string; subject: string; body: string }> {
  const byPm = new Map<string, { pmName: string; rows: BillingRow[] }>();

  for (const row of rows) {
    if (!row.pm_email) continue;
    const entry = byPm.get(row.pm_email) ?? { pmName: row.pm_name, rows: [] };
    entry.rows.push(row);
    byPm.set(row.pm_email, entry);
  }

  return Array.from(byPm.entries()).map(([pmEmail, { pmName, rows: pmRows }]) => {
    const firstName = pmName.split(" ")[0] || pmName;
    const total = pmRows.reduce((sum, r) => sum + r.to_bill, 0);
    const bullets = pmRows
      .map((r) => `  • ${r.project_name} – ${formatCurrency(r.to_bill)}`)
      .join("\n");

    const body = `Hi ${firstName},

I wanted to reach out regarding the billing for your current projects. Below is a summary of what we intend to bill for this period:

${bullets}

Total: ${formatCurrency(total)}

Please let me know if you have any questions or if any of these amounts need adjustment.

Thank you,
The Controls Company`;

    return {
      pmEmail,
      pmName,
      subject: `Billing Update — ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
      body,
    };
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
