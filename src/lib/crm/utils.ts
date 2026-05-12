import type {
  CrmRelationshipHealth,
  CrmConfidenceLevel,
  CrmTaskPriority,
  CrmContactRoleType,
  CrmAccountType,
  CrmActivityType,
  CrmOpportunityStage,
} from "@/types/database";
import { CRM_STAGES } from "./stages";

export const CRM_HEALTH_BADGES: Record<CrmRelationshipHealth, string> = {
  strong:  "bg-status-success/10 text-status-success",
  good:    "bg-brand-primary/10 text-brand-primary",
  at_risk: "bg-status-danger/10 text-status-danger",
  dormant: "bg-status-warning/10 text-status-warning",
  unknown: "bg-surface-overlay text-text-tertiary",
};

export const CRM_HEALTH_LABELS: Record<CrmRelationshipHealth, string> = {
  strong:  "Strong",
  good:    "Good",
  at_risk: "At Risk",
  dormant: "Dormant",
  unknown: "Unknown",
};

export const CRM_CONFIDENCE_BADGES: Record<CrmConfidenceLevel, string> = {
  confirmed:            "bg-status-success/10 text-status-success",
  partially_confirmed:  "bg-status-warning/10 text-status-warning",
  needs_verification:   "bg-surface-overlay text-text-tertiary",
};

export const CRM_CONFIDENCE_LABELS: Record<CrmConfidenceLevel, string> = {
  confirmed:           "Confirmed",
  partially_confirmed: "Partial",
  needs_verification:  "Unverified",
};

export const CRM_TASK_PRIORITY_BADGES: Record<CrmTaskPriority, string> = {
  low:    "bg-surface-overlay text-text-tertiary",
  medium: "bg-status-info/10 text-status-info",
  high:   "bg-status-warning/10 text-status-warning",
  urgent: "bg-status-danger/10 text-status-danger",
};

export const CRM_TASK_PRIORITY_LABELS: Record<CrmTaskPriority, string> = {
  low: "Low", medium: "Medium", high: "High", urgent: "Urgent",
};

export const CRM_ROLE_TYPE_LABELS: Record<CrmContactRoleType, string> = {
  salesperson:            "Salesperson",
  sales_manager:          "Sales Manager",
  estimator:              "Estimator",
  project_manager:        "Project Manager",
  senior_project_manager: "Senior PM",
  operations_manager:     "Ops Manager",
  owner:                  "Owner",
  cfo:                    "CFO",
  cfo_estimator:          "CFO / Estimator",
  unknown:                "Unknown",
};

export const CRM_ACCOUNT_TYPE_LABELS: Record<CrmAccountType, string> = {
  general_contractor:    "General Contractor",
  mechanical_contractor: "Mechanical Contractor",
  electrical_contractor: "Electrical Contractor",
  tab_commissioning:     "TAB / Commissioning",
  controls_contractor:   "Controls Contractor",
  hvac_oem:              "HVAC OEM",
  controls_oem:          "Controls OEM",
  owner:                 "Owner",
  other:                 "Other",
};

export function fmtAccountTypes(account: { type: CrmAccountType; types?: CrmAccountType[] }): string {
  const all = account.types?.length ? account.types : [account.type];
  return all.map((t) => CRM_ACCOUNT_TYPE_LABELS[t]).join(" / ");
}

export const CRM_ACCOUNT_TYPE_OPTIONS: Array<{ value: CrmAccountType; label: string }> = [
  { value: "general_contractor",    label: "General Contractor" },
  { value: "mechanical_contractor", label: "Mechanical Contractor" },
  { value: "electrical_contractor", label: "Electrical Contractor" },
  { value: "tab_commissioning",     label: "TAB / Commissioning" },
  { value: "controls_contractor",   label: "Controls Contractor" },
  { value: "owner",                 label: "Owner" },
  { value: "hvac_oem",              label: "HVAC OEM" },
  { value: "controls_oem",          label: "Controls OEM" },
  { value: "other",                 label: "Other" },
];

export const CRM_ACTIVITY_TYPE_LABELS: Record<CrmActivityType, string> = {
  meeting:           "Meeting",
  call:              "Call",
  email:             "Email",
  site_visit:        "Site Visit",
  lunch:             "Lunch",
  estimate_request:  "Estimate Request",
  proposal_followup: "Proposal Follow-up",
  pm_handoff:        "PM Handoff",
  other:             "Other",
};

export const CRM_STAGE_LABELS: Record<CrmOpportunityStage, string> = Object.fromEntries(
  Object.entries(CRM_STAGES).map(([k, v]) => [k, v.label])
) as Record<CrmOpportunityStage, string>;

export const CRM_STAGE_BADGES: Record<CrmOpportunityStage, string> = Object.fromEntries(
  Object.entries(CRM_STAGES).map(([k, v]) => [k, v.color])
) as Record<CrmOpportunityStage, string>;

export function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function fmtCrmDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtCrmCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getStartOfWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export function getEndOfWeek(): Date {
  const start = getStartOfWeek();
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}
