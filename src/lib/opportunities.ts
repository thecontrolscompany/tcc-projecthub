import type { OpportunityStage, QuoteRequest, QuoteRequestStatus } from "@/types/database";

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
  new: "New",
  under_review: "Under review",
  waiting_on_info: "Waiting on info",
  assigned: "Assigned",
  estimating: "Estimating",
  proposal_ready: "Proposal ready",
  submitted: "Submitted",
  won: "Won",
  lost: "Lost",
  archived: "Archived",
};

export const OPPORTUNITY_STAGE_BADGES: Record<OpportunityStage, string> = {
  new: "bg-status-warning/10 text-status-warning",
  under_review: "bg-status-info/10 text-status-info",
  waiting_on_info: "bg-status-danger/10 text-status-danger",
  assigned: "bg-brand-primary/10 text-brand-primary",
  estimating: "bg-brand-primary/10 text-brand-primary",
  proposal_ready: "bg-status-success/10 text-status-success",
  submitted: "bg-status-info/10 text-status-info",
  won: "bg-status-success/10 text-status-success",
  lost: "bg-surface-overlay text-text-secondary",
  archived: "bg-surface-overlay text-text-tertiary",
};

const STATUS_TO_STAGE: Record<QuoteRequestStatus, OpportunityStage> = {
  new: "new",
  reviewing: "under_review",
  quoted: "submitted",
  won: "won",
  lost: "lost",
};

export function deriveOpportunityStage(quote: Pick<QuoteRequest, "status" | "stage">): OpportunityStage {
  return quote.stage ?? STATUS_TO_STAGE[quote.status];
}

export function isArchivedWon(quote: Pick<QuoteRequest, "status" | "stage">) {
  return quote.status === "won" && deriveOpportunityStage(quote) === "archived";
}

export function getOpportunityStageLabel(quote: Pick<QuoteRequest, "status" | "stage">) {
  if (isArchivedWon(quote)) return "Archived Won";
  return OPPORTUNITY_STAGE_LABELS[deriveOpportunityStage(quote)];
}

export function getOpportunityStageBadge(quote: Pick<QuoteRequest, "status" | "stage">) {
  if (isArchivedWon(quote)) return "bg-status-success/10 text-text-secondary";
  return OPPORTUNITY_STAGE_BADGES[deriveOpportunityStage(quote)];
}

export function isOpportunityClosed(quote: Pick<QuoteRequest, "status" | "stage">) {
  return quote.status === "won" || quote.status === "lost";
}

export function getOpportunityLabel(quote: QuoteRequest) {
  return quote.project_name?.trim() || quote.project_description?.trim() || quote.company_name;
}

export function getOpportunityLocation(quote: QuoteRequest) {
  return quote.project_location?.trim() || quote.site_address?.trim() || null;
}

export function getOpportunityAmount(quote: QuoteRequest) {
  return quote.final_price_amount ?? quote.base_bid_amount ?? quote.opportunity_value ?? quote.estimated_value ?? null;
}

export function isOpportunityLinked(quote: QuoteRequest) {
  return Boolean(quote.project_id || quote.linked_project_id);
}

export function getOpportunityProjectName(quote: QuoteRequest) {
  if (quote.project?.name) return quote.project.name;
  if (quote.linked_project?.name) return quote.linked_project.name;
  return null;
}
