import { calcEstimate } from "./components/estimate/estimateCalc";
import { computeCosts, DEFAULT_SETTINGS, normalizeEstimateScopeMode } from "./components/estimate/projectSettings";

export type HvacEstimateStatus = "draft" | "in_progress" | "ready" | "proposal_exported" | "awarded" | "archived";

export type HvacEstimateBody = {
  id: string;
  organizationId?: string | null;
  linkedOpportunityId?: string | null;
  linkedProjectId?: string | null;
  platformContext?: Record<string, unknown> | null;
  name: string;
  number: string;
  customerAccountId?: string | null;
  customer: string;
  bidder?: string | null;
  version: string;
  notes: string;
  settings: Record<string, unknown>;
  alternates?: Array<Record<string, unknown>>;
  sharepointFolder?: string | null;
  sharepointItemId?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: Record<string, unknown> | null;
  updatedBy?: Record<string, unknown> | null;
  items: Array<Record<string, unknown>>;
};

export type HvacEstimateCreateInput = {
  organizationId?: string | null;
  linkedOpportunityId?: string | null;
  linkedProjectId?: string | null;
  estimateNumber?: string | null;
  opportunityNumber?: string | null;
  projectName: string;
  customerAccountId?: string | null;
  customer?: string | null;
  notes?: string | null;
  estimateScopeMode?: string | null;
  user?: { id: string; email?: string | null; name?: string | null } | null;
};

export function buildHvacEstimateBody(input: HvacEstimateCreateInput): HvacEstimateBody {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const user = input.user
    ? { id: input.user.id, email: input.user.email ?? null, name: input.user.name ?? null }
    : null;

  return {
    id,
    organizationId: input.organizationId ?? null,
    linkedOpportunityId: input.linkedOpportunityId ?? null,
    linkedProjectId: input.linkedProjectId ?? null,
    platformContext: {
      source: "platform_native",
      opportunityNumber: input.opportunityNumber ?? "",
    },
    name: input.projectName || "New Estimate",
    number: input.estimateNumber ?? input.opportunityNumber ?? "",
    customerAccountId: input.customerAccountId ?? null,
    customer: input.customer ?? "",
    version: "1.0",
    notes: input.notes ?? "",
    settings: {
      ...DEFAULT_SETTINGS,
      estimateScopeMode: normalizeEstimateScopeMode(input.estimateScopeMode ?? "both"),
    },
    alternates: [],
    createdAt: now,
    updatedAt: now,
    createdBy: user,
    updatedBy: user,
    items: [],
  };
}

export function summarizeHvacEstimate(body: HvacEstimateBody) {
  const raw = calcEstimate(body) as { mtl: number; lbrHrs: number };
  const costs = computeCosts(raw.mtl, raw.lbrHrs, body.settings, body.items) as {
    total?: number;
    profit?: number;
  };
  const totalAmount = costs.total ?? null;
  const grossMarginAmount = costs.profit ?? null;

  return {
    rawMaterial: raw.mtl,
    rawLaborHours: raw.lbrHrs,
    totalAmount,
    grossMarginAmount,
    grossMarginPct:
      totalAmount && grossMarginAmount !== null && totalAmount > 0
        ? grossMarginAmount / totalAmount
        : null,
  };
}

export function toPlatformEstimatePayload(body: HvacEstimateBody, status: HvacEstimateStatus = "draft") {
  const summary = summarizeHvacEstimate(body);

  return {
    id: body.id,
    organization_id: body.organizationId ?? undefined,
    linked_opportunity_id: body.linkedOpportunityId ?? null,
    linked_project_id: body.linkedProjectId ?? null,
    status,
    archived: status === "archived",
    body,
    total_amount: summary.totalAmount,
    gross_margin_amount: summary.grossMarginAmount,
    gross_margin_pct: summary.grossMarginPct,
  };
}
