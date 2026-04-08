/**
 * Unwraps a value that PostgREST may return as T, T[], or null/undefined.
 * Always returns a single T or null.
 */
export function normalizeSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
