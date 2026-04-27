import type { CrmOpportunityStage } from "@/types/database";

export type StageMetadata = {
  label: string;
  description: string;
  color: string;
  entryCriteria: string[];
  requiredFields: string[];
  exitCriteria: string;
  suggestedNextAction: string;
  probabilityDefault: number;
  isClosed: boolean;
};

export const CRM_STAGES: Record<CrmOpportunityStage, StageMetadata> = {
  target_account: {
    label: "Target Account",
    description: "Company identified as a potential partner — no active contact yet.",
    color: "bg-surface-overlay text-text-secondary border-border-default",
    entryCriteria: ["Account exists in CRM", "Company identified as relevant to TCC scope"],
    requiredFields: ["account_id", "project_name"],
    exitCriteria: "First meaningful contact made (meeting, call, introduction).",
    suggestedNextAction: "Schedule introductory call or meeting.",
    probabilityDefault: 5,
    isClosed: false,
  },
  initial_contact: {
    label: "Initial Contact",
    description: "First contact made. Relationship door is open.",
    color: "bg-status-info/10 text-status-info",
    entryCriteria: ["At least one activity logged", "Contact record exists"],
    requiredFields: ["account_id", "primary_contact_id"],
    exitCriteria: "Discovery of a specific project opportunity or ongoing need.",
    suggestedNextAction: "Follow up within 2 weeks. Log any response.",
    probabilityDefault: 10,
    isClosed: false,
  },
  relationship_building: {
    label: "Relationship Building",
    description: "Regular touchpoints happening. No specific opportunity yet.",
    color: "bg-brand-primary/10 text-brand-primary",
    entryCriteria: ["2+ activities logged", "Contact confirmed interest in TCC work"],
    requiredFields: ["account_id", "primary_contact_id"],
    exitCriteria: "Specific project identified or RFP/RFQ expected.",
    suggestedNextAction: "Schedule lunch, site visit, or regular check-in.",
    probabilityDefault: 20,
    isClosed: false,
  },
  opportunity_identified: {
    label: "Opportunity Identified",
    description: "A specific project or scope of work has been identified.",
    color: "bg-status-warning/10 text-status-warning",
    entryCriteria: ["Specific project/scope identified", "Customer has confirmed interest"],
    requiredFields: ["account_id", "project_name", "primary_contact_id", "estimated_value"],
    exitCriteria: "Formal pricing request received or bid date confirmed.",
    suggestedNextAction: "Confirm bid due date and scope. Link to pursuit if applicable.",
    probabilityDefault: 30,
    isClosed: false,
  },
  request_for_pricing: {
    label: "Request for Pricing",
    description: "Customer has formally asked for a quote or estimate.",
    color: "bg-status-warning/10 text-status-warning",
    entryCriteria: ["Written or verbal RFQ received", "bid_due_date known"],
    requiredFields: ["account_id", "project_name", "bid_due_date", "estimated_value", "estimator_profile_id"],
    exitCriteria: "Estimate handed to estimating team.",
    suggestedNextAction: "Assign estimator. Link to quote_request record if one exists.",
    probabilityDefault: 40,
    isClosed: false,
  },
  estimating: {
    label: "Estimating",
    description: "Estimate is being built internally.",
    color: "bg-brand-primary/10 text-brand-primary",
    entryCriteria: ["Estimator assigned", "Scope documents received"],
    requiredFields: ["estimator_profile_id", "bid_due_date"],
    exitCriteria: "Estimate complete, proposal ready for delivery.",
    suggestedNextAction: "Check in on estimate progress. Confirm delivery method with customer.",
    probabilityDefault: 45,
    isClosed: false,
  },
  proposal_sent: {
    label: "Proposal Sent",
    description: "Proposal delivered to customer. Awaiting decision.",
    color: "bg-status-info/10 text-status-info",
    entryCriteria: ["Proposal document sent (email, SharePoint link, or hand-delivery)"],
    requiredFields: ["estimated_value", "expected_close_date"],
    exitCriteria: "Customer responds with award, rejection, or request for negotiation.",
    suggestedNextAction: "Follow up in 3–5 business days. Log the follow-up call.",
    probabilityDefault: 55,
    isClosed: false,
  },
  follow_up_negotiation: {
    label: "Follow-up / Negotiation",
    description: "Customer is engaged but has questions or counter-proposals.",
    color: "bg-status-warning/10 text-status-warning",
    entryCriteria: ["Customer responded with questions or counter-offer"],
    requiredFields: ["estimated_value", "next_step"],
    exitCriteria: "Price and scope agreed. Verbal or written award expected.",
    suggestedNextAction: "Address objections. Schedule a clarification call.",
    probabilityDefault: 65,
    isClosed: false,
  },
  verbal_award: {
    label: "Verbal Award",
    description: "Customer has verbally committed. PO not yet received.",
    color: "bg-status-success/10 text-status-success",
    entryCriteria: ["Customer said 'yes' verbally or via email", "PM handoff planned"],
    requiredFields: ["pm_profile_id", "estimated_value"],
    exitCriteria: "PO received in hand.",
    suggestedNextAction: "Initiate PM handoff. Request PO timeline from customer.",
    probabilityDefault: 85,
    isClosed: false,
  },
  po_received: {
    label: "PO Received",
    description: "Purchase order in hand. Project transitioning to execution.",
    color: "bg-status-success/10 text-status-success",
    entryCriteria: ["PO document received from customer"],
    requiredFields: ["pm_profile_id", "estimated_value"],
    exitCriteria: "Project created in ProjectHub. Link set.",
    suggestedNextAction: "Create project record. Link opportunity to project.",
    probabilityDefault: 100,
    isClosed: false,
  },
  closed_lost: {
    label: "Closed Lost",
    description: "Customer awarded to a competitor or project cancelled.",
    color: "bg-status-danger/10 text-status-danger",
    entryCriteria: ["Customer notified TCC of loss", "Or no response after extended follow-up"],
    requiredFields: ["notes"],
    exitCriteria: "N/A — closed stage.",
    suggestedNextAction: "Log a loss reason in notes. Schedule a debrief meeting if possible.",
    probabilityDefault: 0,
    isClosed: true,
  },
  on_hold: {
    label: "On Hold",
    description: "Project deferred by customer. Keep relationship warm.",
    color: "bg-surface-overlay text-text-tertiary",
    entryCriteria: ["Customer has paused or deferred the project timeline"],
    requiredFields: [],
    exitCriteria: "Customer re-engages or project is cancelled.",
    suggestedNextAction: "Set a next_scheduled_followup_date 60–90 days out on the account.",
    probabilityDefault: 20,
    isClosed: false,
  },
};

export const CRM_STAGE_ORDER: CrmOpportunityStage[] = [
  "target_account",
  "initial_contact",
  "relationship_building",
  "opportunity_identified",
  "request_for_pricing",
  "estimating",
  "proposal_sent",
  "follow_up_negotiation",
  "verbal_award",
  "po_received",
  "closed_lost",
  "on_hold",
];

export const OPEN_STAGES: CrmOpportunityStage[] = CRM_STAGE_ORDER.filter(
  (s) => !CRM_STAGES[s].isClosed
);
