import assert from "node:assert/strict";
import test from "node:test";
import {
  calcBacklog,
  calcPrevBilledPct,
  calcToBill,
  filterNewBillingPeriods,
  rollForwardRows,
} from "../src/lib/billing/calculations.ts";
import { calcWeightedPoc, reconcilePocProgress } from "../src/lib/poc/calculations.ts";
import type { BillingPeriod } from "../src/types/database.ts";

test("weighted POC matches the legacy C5 calculation", () => {
  const pct = calcWeightedPoc([
    { weight: 10, pct_complete: 1 },
    { weight: 20, pct_complete: 0.4 },
    { weight: 40, pct_complete: 0.6 },
    { weight: 6, pct_complete: 0.97 },
    { weight: 4, pct_complete: 0.97 },
    { weight: 3, pct_complete: 0.5 },
    { weight: 5, pct_complete: 0.6 },
    { weight: 12, pct_complete: 0.55 },
  ]);

  assert.equal(pct, 0.628);
  assert.equal(calcWeightedPoc([]), null);
});

test("billing formulas match representative tracker rows", () => {
  assert.equal(calcBacklog(37_758, 42_396), -4_638);
  assert.equal(calcPrevBilledPct(37_758, 42_396), 42_396 / 37_758);
  assert.equal(calcPrevBilledPct(0, 12_480), 0);
  assert.equal(calcToBill(1_596_000, 0.7088959899749374, 1_032_281), 99_117);
  assert.equal(calcToBill(34_950, 0.12, 6_990), 0);
});

test("roll forward uses actual billing and carries progress into the new month", () => {
  const current = {
    id: "period-1",
    period_month: "2026-07-01",
    project_id: "project-1",
    prior_pct: 0.5,
    pct_complete: 0.65,
    prev_billed: 321_225,
    to_bill: 100_292.85,
    actual_billed: 100_292.85,
    invoice_number: "INV-1",
    estimated_income_snapshot: 648_489,
    notes: "July billing",
    synced_from_onedrive: true,
  } satisfies BillingPeriod;

  const [next] = rollForwardRows([current]);
  assert.equal(next.period_month, "2026-08-01");
  assert.equal(next.prior_pct, 0.65);
  assert.equal(next.pct_complete, 0.65);
  assert.equal(next.prev_billed, 421_517.85);
  assert.equal(next.actual_billed, null);

  const [blankActual] = rollForwardRows([{ ...current, actual_billed: null }]);
  assert.equal(blankActual.prev_billed, 321_225);
});

test("roll forward never replaces an existing project-month row", () => {
  const rows = [
    { project_id: "existing-project", period_month: "2026-08-01" },
    { project_id: "new-project", period_month: "2026-08-01" },
  ];

  assert.deepEqual(filterNewBillingPeriods(rows, ["existing-project"]), [rows[1]]);
});

test("POC reconciliation trusts project rows for weights and rejects foreign IDs", () => {
  const projectItems = [
    { id: "line-1", category: "Programming", weight: 25, pct_complete: 0.2 },
    { id: "line-2", category: "Installation", weight: 75, pct_complete: 0.4 },
  ];

  const result = reconcilePocProgress(projectItems, [
    { id: "line-1", pct_complete: 1 },
    { id: "line-2", pct_complete: 0.5 },
  ]);

  assert.equal(result.pctComplete, 0.625);
  assert.deepEqual(result.snapshot?.map((item) => item.category), ["Programming", "Installation"]);
  assert.throws(
    () => reconcilePocProgress(projectItems, [{ id: "another-project-line", pct_complete: 1 }]),
    /does not belong to this project/
  );
});
