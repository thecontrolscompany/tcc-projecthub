const EXACT_ALIAS_MAP = new Map<string, string>([
  ["ecs", "Engineered Cooling Services"],
  ["engineered cooling", "Engineered Cooling Services"],
  ["engineered cooling service", "Engineered Cooling Services"],
  ["engineered cooling services", "Engineered Cooling Services"],
  ["engineered cooling system", "Engineered Cooling Services"],
  ["engineered cooling systems", "Engineered Cooling Services"],
  ["engineered coolins services", "Engineered Cooling Services"],
  ["johnson controls inc", "Johnson Controls"],
  ["johnson controls incorporated", "Johnson Controls"],
]);

function canonicalLookupKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[&.,/()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeStoredCustomerName(value: string | null | undefined) {
  if (!value) return null;

  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;

  return EXACT_ALIAS_MAP.get(canonicalLookupKey(trimmed)) ?? trimmed;
}
