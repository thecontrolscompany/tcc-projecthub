export type PursuitStatus = "active" | "awarded" | "lost" | "passed" | "archived";
export type PursuitStatusFilter = "all" | PursuitStatus;

export const PURSUIT_STATUS_LABELS: Record<PursuitStatusFilter, string> = {
  all: "All",
  active: "Active",
  awarded: "Won",
  lost: "Lost",
  passed: "No Bid",
  archived: "Archived",
};

export const PURSUIT_STATUS_COLORS: Record<PursuitStatus, string> = {
  active: "bg-brand-primary/10 text-brand-primary",
  awarded: "bg-status-success/10 text-status-success",
  lost: "bg-status-danger/10 text-status-danger",
  passed: "bg-status-warning/10 text-status-warning",
  archived: "bg-surface-overlay text-text-tertiary",
};

export const PURSUIT_STATUS_OPTIONS: PursuitStatus[] = [
  "active",
  "awarded",
  "lost",
  "passed",
  "archived",
];

const STATUS_ALIASES: Record<string, PursuitStatus> = {
  active: "active",
  awarded: "awarded",
  won: "awarded",
  lost: "lost",
  archived: "archived",
  passed: "passed",
  "no bid": "passed",
  nobid: "passed",
  "no-bid": "passed",
};

export function normalizePursuitStatus(value: string | null | undefined): PursuitStatus | null {
  if (!value) return null;
  return STATUS_ALIASES[value.trim().toLowerCase()] ?? null;
}
