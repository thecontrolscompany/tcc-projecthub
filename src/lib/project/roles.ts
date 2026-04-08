import type { ProjectAssignmentRole } from "@/types/database";

export const ROLE_LABELS: Record<ProjectAssignmentRole, string> = {
  pm: "PM",
  lead: "Lead",
  installer: "Installer",
  ops_manager: "Ops Manager",
};

export const ROLE_BADGE_STYLES: Record<ProjectAssignmentRole, string> = {
  pm: "bg-status-info/10 text-status-info",
  lead: "bg-status-warning/10 text-status-warning",
  installer: "bg-brand-primary/10 text-brand-primary",
  ops_manager: "bg-surface-overlay text-text-primary",
};

export const ROLE_BADGE_STYLES_WITH_BORDER: Record<ProjectAssignmentRole, string> = {
  pm: "bg-status-info/10 text-status-info border-status-info/20",
  lead: "bg-status-warning/10 text-status-warning border-status-warning/20",
  installer: "bg-brand-primary/10 text-brand-primary border-brand-primary/20",
  ops_manager: "bg-surface-overlay text-text-primary border-border-default",
};
