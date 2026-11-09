export type PocProgressInput = {
  weight: number | string | null | undefined;
  pct_complete: number | string | null | undefined;
};

export type AuthoritativePocLineItem = {
  id: string;
  category: string;
  weight: number;
  pct_complete: number;
};

export type PocProgressUpdate = {
  id: string;
  pct_complete: number;
};

/**
 * Mirrors the legacy POC workbook: each line's completion is multiplied by its
 * weight, then the contributions are divided by the total configured weight.
 * Returns null when there are no valid weighted line items so manual billing
 * percentages are not accidentally overwritten with zero.
 */
export function calcWeightedPoc(items: PocProgressInput[]): number | null {
  let totalWeight = 0;
  let weightedCompletion = 0;

  for (const item of items) {
    if (item.weight == null || item.pct_complete == null) {
      continue;
    }

    const weight = Number(item.weight);
    const rawPct = Number(item.pct_complete);

    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(rawPct)) {
      continue;
    }

    const pctComplete = Math.min(Math.max(rawPct, 0), 1);
    totalWeight += weight;
    weightedCompletion += weight * pctComplete;
  }

  return totalWeight > 0 ? weightedCompletion / totalWeight : null;
}

/**
 * Applies browser-submitted line progress only to line items already loaded for
 * the authorized project. Weights and labels always come from the database,
 * and an unknown or duplicate ID is rejected instead of being written.
 */
export function reconcilePocProgress(
  projectItems: AuthoritativePocLineItem[],
  updates: PocProgressUpdate[]
): { pctComplete: number | null; snapshot: AuthoritativePocLineItem[] | null } {
  const projectItemIds = new Set(projectItems.map((item) => item.id));
  const updatesById = new Map<string, number>();

  for (const update of updates) {
    if (!projectItemIds.has(update.id)) {
      throw new Error("A POC line item does not belong to this project.");
    }
    if (updatesById.has(update.id)) {
      throw new Error("A POC line item was submitted more than once.");
    }
    if (!Number.isFinite(update.pct_complete)) {
      throw new Error("A POC line item has an invalid completion value.");
    }

    updatesById.set(update.id, Math.min(Math.max(update.pct_complete, 0), 1));
  }

  if (projectItems.length === 0) {
    if (updates.length > 0) {
      throw new Error("No POC line items are configured for this project.");
    }
    return { pctComplete: null, snapshot: null };
  }

  const snapshot = projectItems.map((item) => ({
    ...item,
    pct_complete: updatesById.get(item.id) ?? Math.min(Math.max(item.pct_complete, 0), 1),
  }));

  return {
    pctComplete: calcWeightedPoc(snapshot),
    snapshot,
  };
}
