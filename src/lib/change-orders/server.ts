import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { normalizeSingle } from "@/lib/utils/normalize";
import type {
  ChangeOrder,
  ChangeOrderAttachment,
  ChangeOrderAttachmentKind,
  ChangeOrderLineItem,
  ChangeOrderLineItemCategory,
  ChangeOrderPricingMode,
  ChangeOrderStatusHistory,
  ChangeOrderUiStatus,
  Project,
  UserRole,
} from "@/types/database";
import { createClient as createServerClient } from "@/lib/supabase/server";

export type ChangeOrderRequestContextSuccess = {
  ok: true;
  adminClient: SupabaseClient;
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  user: User;
  role: UserRole;
};

export type ChangeOrderRequestContextFailure = {
  ok: false;
  response: NextResponse;
};

export type ChangeOrderRequestContext = ChangeOrderRequestContextSuccess | ChangeOrderRequestContextFailure;

export const CHANGE_ORDER_UI_STATUSES = [
  "draft",
  "needs_pricing",
  "ready_to_submit",
  "submitted",
  "in_review",
  "approved",
  "rejected",
  "voided",
  "superseded",
  "executed",
  "billed",
  "paid",
] as const satisfies readonly ChangeOrderUiStatus[];

export const CHANGE_ORDER_LEGACY_STATUS_MAP = {
  pending: "in_review",
  needs_revision: "needs_pricing",
  approved_po: "approved",
  approved_email: "approved",
  void: "voided",
  combined: "superseded",
} as const satisfies Record<string, ChangeOrderUiStatus>;

const CHANGE_ORDER_STATUS_LABELS: Record<ChangeOrderUiStatus, string> = {
  draft: "Draft",
  needs_pricing: "Needs Pricing",
  ready_to_submit: "Ready to Submit",
  submitted: "Submitted",
  in_review: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  voided: "Voided",
  superseded: "Superseded",
  executed: "Executed",
  billed: "Billed",
  paid: "Paid",
};

const CHANGE_ORDER_ATTACHMENT_KINDS: readonly ChangeOrderAttachmentKind[] = [
  "backup",
  "supporting",
  "photo",
  "pdf",
  "signed",
  "customer",
];

const CHANGE_ORDER_LINE_ITEM_CATEGORIES: readonly ChangeOrderLineItemCategory[] = [
  "labor",
  "material",
  "equipment",
  "subcontractor",
  "other",
];

const CHANGE_ORDER_PRICING_MODES: readonly ChangeOrderPricingMode[] = ["quick_total", "detailed"];

function adminClient() {
  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function asText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableText(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toCustomerVisibleAttachment(attachment: ChangeOrderAttachment): ChangeOrderAttachment {
  return {
    ...attachment,
    storage_provider: "customer",
    storage_path: null,
  };
}

function normalizeAttachmentKind(value: unknown): ChangeOrderAttachmentKind {
  const kind = asText(value, "backup").toLowerCase();
  return (CHANGE_ORDER_ATTACHMENT_KINDS as readonly string[]).includes(kind) ? (kind as ChangeOrderAttachmentKind) : "backup";
}

function normalizeLineItemCategory(value: unknown): ChangeOrderLineItemCategory {
  const category = asText(value, "other").toLowerCase();
  return (CHANGE_ORDER_LINE_ITEM_CATEGORIES as readonly string[]).includes(category)
    ? (category as ChangeOrderLineItemCategory)
    : "other";
}

function normalizePricingMode(value: unknown): ChangeOrderPricingMode {
  const mode = asText(value, "quick_total").toLowerCase();
  return (CHANGE_ORDER_PRICING_MODES as readonly string[]).includes(mode)
    ? (mode as ChangeOrderPricingMode)
    : "quick_total";
}

export function normalizeChangeOrderStatus(rawStatus: string | null | undefined): ChangeOrderUiStatus {
  const normalized = asText(rawStatus, "draft").trim().toLowerCase();

  if (!normalized) return "draft";
  if (normalized in CHANGE_ORDER_LEGACY_STATUS_MAP) {
    return CHANGE_ORDER_LEGACY_STATUS_MAP[normalized as keyof typeof CHANGE_ORDER_LEGACY_STATUS_MAP];
  }
  if ((CHANGE_ORDER_UI_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as ChangeOrderUiStatus;
  }

  return "draft";
}

export function changeOrderStatusLabel(status: string | null | undefined) {
  return CHANGE_ORDER_STATUS_LABELS[normalizeChangeOrderStatus(status)] ?? "Draft";
}

export function displayChangeOrderNumber(changeOrder: Pick<ChangeOrder, "cor_number" | "co_number">) {
  return changeOrder.cor_number?.trim() || changeOrder.co_number?.trim() || "—";
}

export function canReadChangeOrders(
  admin: SupabaseClient,
  projectId: string,
  userId: string,
  role: UserRole
) {
  if (role === "admin" || role === "ops_manager") return Promise.resolve(true);

  const directAssignment = admin
    .from("project_assignments")
    .select("id")
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .limit(1)
    .then(({ data, error }) => {
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    });

  const customerPortalAccess = admin
    .from("project_customer_contacts")
    .select("id")
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .eq("portal_access", true)
    .limit(1)
    .then(({ data, error }) => {
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    });

  if (role === "customer") {
    return customerPortalAccess;
  }

  const pmDirectoryAccess = admin
    .from("project_assignments")
    .select("pm_directory_id")
    .eq("project_id", projectId)
    .not("pm_directory_id", "is", null)
    .then(async ({ data, error }) => {
      if (error) throw error;

      const directoryIds = (data ?? [])
        .map((row) => row.pm_directory_id)
        .filter(Boolean) as string[];

      if (directoryIds.length === 0) return false;

      const { data: matches, error: matchError } = await admin
        .from("pm_directory")
        .select("id")
        .in("id", directoryIds)
        .eq("profile_id", userId)
        .limit(1);

      if (matchError) throw matchError;
      return (matches?.length ?? 0) > 0;
    });

  return Promise.all([directAssignment, pmDirectoryAccess]).then(([direct, viaDirectory]) => direct || viaDirectory || customerPortalAccess);
}

export async function canWriteChangeOrders(
  admin: SupabaseClient,
  projectId: string,
  userId: string,
  role: UserRole
) {
  if (role === "admin" || role === "ops_manager") return true;
  if (!["pm", "lead"].includes(role)) return false;

  const { data: directRows, error: directError } = await admin
    .from("project_assignments")
    .select("id")
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .in("role_on_project", ["pm", "lead"])
    .limit(1);

  if (directError) {
    throw directError;
  }

  if ((directRows?.length ?? 0) > 0) return true;

  const { data: assignmentRows, error: assignmentError } = await admin
    .from("project_assignments")
    .select("pm_directory_id")
    .eq("project_id", projectId)
    .in("role_on_project", ["pm", "lead"])
    .not("pm_directory_id", "is", null);

  if (assignmentError) {
    throw assignmentError;
  }

  const directoryIds = (assignmentRows ?? [])
    .map((row) => row.pm_directory_id)
    .filter(Boolean) as string[];

  if (directoryIds.length === 0) return false;

  const { data: matches, error: matchError } = await admin
    .from("pm_directory")
    .select("id")
    .in("id", directoryIds)
    .eq("profile_id", userId)
    .limit(1);

  if (matchError) {
    throw matchError;
  }

  return (matches?.length ?? 0) > 0;
}

export async function getChangeOrderRequestContext() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const resolved = await resolveUserRole(user);

  return {
    ok: true as const,
    adminClient: adminClient(),
    supabase,
    user,
    role: (resolved?.role ?? "customer") as UserRole,
  };
}

export function mapChangeOrderRow(row: Record<string, unknown>): ChangeOrder {
  const status = normalizeChangeOrderStatus(asText(row.status, "draft"));
  const requestedAmount = asNumber(row.requested_amount, asNumber(row.amount, 0));
  const approvedAmount = asNumber(row.approved_amount, requestedAmount);

  return {
    id: asText(row.id),
    project_id: asText(row.project_id),
    cor_number: asText(row.cor_number, asText(row.co_number)),
    co_number: asText(row.co_number, asText(row.cor_number)),
    sequence_number: asNumber(row.sequence_number, 0),
    number_prefix: asText(row.number_prefix, "COR"),
    number_padding: asNumber(row.number_padding, 4),
    title: asText(row.title),
    description: asNullableText(row.description),
    amount: asNumber(row.amount, requestedAmount),
    status,
    pricing_mode: normalizePricingMode(row.pricing_mode),
    requested_amount: requestedAmount,
    approved_amount: approvedAmount,
    requested_days: asNumber(row.requested_days, 0),
    approved_days: asNumber(row.approved_days, 0),
    requested_by_name: asNullableText(row.requested_by_name),
    customer_contact_name: asNullableText(row.customer_contact_name),
    customer_contact_email: asNullableText(row.customer_contact_email),
    source: asNullableText(row.source),
    what_happened: asNullableText(row.what_happened),
    work_required: asNullableText(row.work_required),
    reason: asNullableText(row.reason),
    terms_note: asNullableText(row.terms_note),
    status_reason: asNullableText(row.status_reason),
    internal_notes: asNullableText(row.internal_notes),
    submitted_date: asNullableText(row.submitted_date),
    approved_date: asNullableText(row.approved_date),
    submitted_by: asNullableText(row.submitted_by),
    approved_by: asNullableText(row.approved_by),
    reference_doc: asNullableText(row.reference_doc),
    notes: asNullableText(row.notes),
    submitted_at: asNullableText(row.submitted_at),
    approved_at: asNullableText(row.approved_at),
    executed_at: asNullableText(row.executed_at),
    billed_at: asNullableText(row.billed_at),
    paid_at: asNullableText(row.paid_at),
    voided_at: asNullableText(row.voided_at),
    rejected_at: asNullableText(row.rejected_at),
    superseded_at: asNullableText(row.superseded_at),
    combined_at: asNullableText(row.combined_at),
    superseded_by_change_order_id: asNullableText(row.superseded_by_change_order_id),
    combined_into_change_order_id: asNullableText(row.combined_into_change_order_id),
    modified_by: asNullableText(row.modified_by),
    labor_amount: asNumber(row.labor_amount, 0),
    material_amount: asNumber(row.material_amount, 0),
    equipment_amount: asNumber(row.equipment_amount, 0),
    subcontractor_amount: asNumber(row.subcontractor_amount, 0),
    other_amount: asNumber(row.other_amount, 0),
    created_at: asText(row.created_at, new Date().toISOString()),
    updated_at: asText(row.updated_at, new Date().toISOString()),
    project: undefined,
    line_items: undefined,
    attachments: undefined,
    status_history: undefined,
  };
}

export function mapChangeOrderLineItemRow(row: Record<string, unknown>): ChangeOrderLineItem {
  return {
    id: asText(row.id),
    change_order_id: asText(row.change_order_id),
    category: normalizeLineItemCategory(row.category),
    sort_order: asNumber(row.sort_order, 0),
    description: asText(row.description),
    role: asNullableText(row.role),
    people_count: asNullableNumber(row.people_count),
    hours_per_person: asNullableNumber(row.hours_per_person),
    days: asNullableNumber(row.days),
    hourly_rate: asNullableNumber(row.hourly_rate),
    quantity: asNullableNumber(row.quantity),
    unit: asNullableText(row.unit),
    unit_cost: asNullableNumber(row.unit_cost),
    lump_sum: asNullableNumber(row.lump_sum),
    markup_percent: asNumber(row.markup_percent, 0),
    base_amount: asNumber(row.base_amount, 0),
    total: asNumber(row.total, 0),
    created_at: asText(row.created_at, new Date().toISOString()),
    updated_at: asText(row.updated_at, new Date().toISOString()),
  };
}

export function mapChangeOrderAttachmentRow(row: Record<string, unknown>): ChangeOrderAttachment {
  return {
    id: asText(row.id),
    change_order_id: asText(row.change_order_id),
    attachment_kind: normalizeAttachmentKind(row.attachment_kind),
    title: asNullableText(row.title),
    description: asNullableText(row.description),
    file_name: asText(row.file_name),
    content_type: asNullableText(row.content_type),
    storage_provider: asText(row.storage_provider, "onedrive"),
    storage_path: asNullableText(row.storage_path),
    storage_web_url: asNullableText(row.storage_web_url),
    file_size_bytes: asNullableNumber(row.file_size_bytes),
    sort_order: asNumber(row.sort_order, 0),
    is_customer_visible: asBoolean(row.is_customer_visible, false),
    created_at: asText(row.created_at, new Date().toISOString()),
    updated_at: asText(row.updated_at, new Date().toISOString()),
  };
}

export function mapChangeOrderStatusHistoryRow(row: Record<string, unknown>): ChangeOrderStatusHistory {
  return {
    id: asText(row.id),
    change_order_id: asText(row.change_order_id),
    previous_status: row.previous_status ? normalizeChangeOrderStatus(asText(row.previous_status)) : null,
    new_status: normalizeChangeOrderStatus(asText(row.new_status, "draft")),
    reason: asNullableText(row.reason),
    changed_by: asNullableText(row.changed_by),
    changed_at: asText(row.changed_at, new Date().toISOString()),
    metadata: asJsonRecord(row.metadata),
  };
}

export interface ChangeOrderSummary {
  count: number;
  requested_amount: number;
  approved_amount: number;
  requested_days: number;
  approved_days: number;
  status_counts: Record<ChangeOrderUiStatus, number>;
  status_requested_amounts: Record<ChangeOrderUiStatus, number>;
  status_approved_amounts: Record<ChangeOrderUiStatus, number>;
}

export function computeChangeOrderSummary(changeOrders: ChangeOrder[]): ChangeOrderSummary {
  const status_counts = Object.fromEntries(CHANGE_ORDER_UI_STATUSES.map((status) => [status, 0])) as Record<ChangeOrderUiStatus, number>;
  const status_requested_amounts = Object.fromEntries(CHANGE_ORDER_UI_STATUSES.map((status) => [status, 0])) as Record<ChangeOrderUiStatus, number>;
  const status_approved_amounts = Object.fromEntries(CHANGE_ORDER_UI_STATUSES.map((status) => [status, 0])) as Record<ChangeOrderUiStatus, number>;

  const summary = changeOrders.reduce(
    (acc, changeOrder) => {
      const status = normalizeChangeOrderStatus(changeOrder.status);
      acc.count += 1;
      acc.requested_amount += asNumber(changeOrder.requested_amount, changeOrder.amount);
      acc.approved_amount += asNumber(changeOrder.approved_amount, 0);
      acc.requested_days += asNumber(changeOrder.requested_days, 0);
      acc.approved_days += asNumber(changeOrder.approved_days, 0);
      acc.status_counts[status] += 1;
      acc.status_requested_amounts[status] += asNumber(changeOrder.requested_amount, changeOrder.amount);
      acc.status_approved_amounts[status] += asNumber(changeOrder.approved_amount, 0);
      return acc;
    },
    {
      count: 0,
      requested_amount: 0,
      approved_amount: 0,
      requested_days: 0,
      approved_days: 0,
      status_counts,
      status_requested_amounts,
      status_approved_amounts,
    } satisfies ChangeOrderSummary
  );

  return summary;
}

export type ChangeOrderBundle = {
  change_order: ChangeOrder;
  project: Project | null;
  line_items: ChangeOrderLineItem[];
  attachments: ChangeOrderAttachment[];
  status_history: ChangeOrderStatusHistory[];
  summary: ChangeOrderSummary;
};

export function sanitizeChangeOrderForRole<T extends ChangeOrder | ChangeOrderBundle>(
  changeOrder: T,
  role: UserRole | null | undefined
): T {
  if (!changeOrder) {
    return changeOrder;
  }

  if (role === "admin" || role === "ops_manager" || role === "pm" || role === "lead") {
    return changeOrder;
  }

  const clone = structuredClone(changeOrder) as T;

  if ("change_order" in clone) {
    const bundle = clone as ChangeOrderBundle;
    bundle.change_order.internal_notes = null;
    bundle.change_order.modified_by = null;
    bundle.change_order.combined_at = null;
    bundle.change_order.superseded_by_change_order_id = null;
    bundle.change_order.combined_into_change_order_id = null;
    bundle.attachments = bundle.attachments
      .filter((attachment) => attachment.is_customer_visible)
      .map(toCustomerVisibleAttachment);
    bundle.status_history = [];
    bundle.summary = computeChangeOrderSummary([bundle.change_order]);
    return bundle as T;
  }

  const order = clone as ChangeOrder;
  order.internal_notes = null;
  order.modified_by = null;
  order.combined_at = null;
  order.superseded_by_change_order_id = null;
  order.combined_into_change_order_id = null;
  order.line_items = order.line_items ?? undefined;
  order.attachments = order.attachments
    ? order.attachments.filter((attachment) => attachment.is_customer_visible).map(toCustomerVisibleAttachment)
    : undefined;
  order.status_history = [];
  return order as T;
}

export async function loadProjectChangeOrders(
  admin: SupabaseClient,
  projectId: string,
  role?: UserRole | null
) {
  const { data, error } = await admin
    .from("change_orders")
    .select(
      `
        *,
        project:projects(id, name, job_number, customer:customers(name))
      `
    )
    .eq("project_id", projectId)
    .order("sequence_number", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []).map((row) => {
    const mapped = mapChangeOrderRow(row as Record<string, unknown>);
    const project = normalizeSingle((row as Record<string, unknown>).project);
    return {
      ...mapped,
      project: project ? ({ ...project } as Project) : null,
    };
  });

  return rows.map((row) => sanitizeChangeOrderForRole(row, role));
}

export async function loadChangeOrderBundle(
  admin: SupabaseClient,
  changeOrderId: string,
  role?: UserRole | null
) : Promise<ChangeOrderBundle | null> {
  const { data: changeOrderRows, error: changeOrderError } = await admin
    .from("change_orders")
    .select(
      `
        *,
        project:projects(id, name, job_number, customer:customers(name))
      `
    )
    .eq("id", changeOrderId)
    .maybeSingle();

  if (changeOrderError) {
    throw changeOrderError;
  }

  if (!changeOrderRows) return null;

  const [lineItemsResult, attachmentsResult, statusHistoryResult] = await Promise.all([
    admin
      .from("change_order_line_items")
      .select("*")
      .eq("change_order_id", changeOrderId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    admin
      .from("change_order_attachments")
      .select("*")
      .eq("change_order_id", changeOrderId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    admin
      .from("change_order_status_history")
      .select("*")
      .eq("change_order_id", changeOrderId)
      .order("changed_at", { ascending: false }),
  ]);

  if (lineItemsResult.error) throw lineItemsResult.error;
  if (attachmentsResult.error) throw attachmentsResult.error;
  if (statusHistoryResult.error) throw statusHistoryResult.error;

  const changeOrderRecord = changeOrderRows as Record<string, unknown>;
  const change_order = mapChangeOrderRow(changeOrderRecord);
  const project = normalizeSingle(changeOrderRecord.project) as Project | null;
  const line_items = (lineItemsResult.data ?? []).map((row) => mapChangeOrderLineItemRow(row as Record<string, unknown>));
  const attachments = (attachmentsResult.data ?? []).map((row) => mapChangeOrderAttachmentRow(row as Record<string, unknown>));
  const status_history = (statusHistoryResult.data ?? []).map((row) =>
    mapChangeOrderStatusHistoryRow(row as Record<string, unknown>)
  );
  const summary = computeChangeOrderSummary([change_order]);

  return sanitizeChangeOrderForRole(
    {
      change_order: {
        ...change_order,
        project,
      },
      project,
      line_items,
      attachments,
      status_history,
      summary,
    },
    role
  ) as ChangeOrderBundle;
}

type ChangeOrderChildSaveInput = {
  line_items?: Array<Partial<ChangeOrderLineItem> & { id?: string }>;
  attachments?: Array<Partial<ChangeOrderAttachment> & { id?: string }>;
  status_history?: Array<Partial<ChangeOrderStatusHistory> & { id?: string }>;
};

export async function saveChangeOrderChildren(
  admin: SupabaseClient,
  changeOrderId: string,
  input: ChangeOrderChildSaveInput
) {
  const saved: {
    line_items: ChangeOrderLineItem[];
    attachments: ChangeOrderAttachment[];
    status_history: ChangeOrderStatusHistory[];
  } = {
    line_items: [],
    attachments: [],
    status_history: [],
  };

  if (input.line_items) {
    const { error: deleteError } = await admin
      .from("change_order_line_items")
      .delete()
      .eq("change_order_id", changeOrderId);

    if (deleteError) throw deleteError;

    const payload = input.line_items.map((item, index) => ({
      ...item,
      change_order_id: changeOrderId,
      sort_order: item.sort_order ?? index,
      category: item.category ?? "other",
      description: item.description ?? "",
      markup_percent: item.markup_percent ?? 0,
      role: item.role ?? null,
      people_count: item.people_count ?? null,
      hours_per_person: item.hours_per_person ?? null,
      days: item.days ?? null,
      hourly_rate: item.hourly_rate ?? null,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      unit_cost: item.unit_cost ?? null,
      lump_sum: item.lump_sum ?? null,
    }));

    if (payload.length > 0) {
      const { data, error } = await admin.from("change_order_line_items").insert(payload).select("*");
      if (error) throw error;
      saved.line_items = (data ?? []).map((row) => mapChangeOrderLineItemRow(row as Record<string, unknown>));
    }
  }

  if (input.attachments) {
    const { error: deleteError } = await admin
      .from("change_order_attachments")
      .delete()
      .eq("change_order_id", changeOrderId);

    if (deleteError) throw deleteError;

    const payload = input.attachments.map((item, index) => ({
      ...item,
      change_order_id: changeOrderId,
      sort_order: item.sort_order ?? index,
      attachment_kind: item.attachment_kind ?? "backup",
      title: item.title ?? null,
      description: item.description ?? null,
      file_name: item.file_name ?? "",
      content_type: item.content_type ?? null,
      storage_provider: item.storage_provider ?? "onedrive",
      storage_path: item.storage_path ?? null,
      storage_web_url: item.storage_web_url ?? null,
      file_size_bytes: item.file_size_bytes ?? null,
      is_customer_visible: item.is_customer_visible ?? false,
    }));

    if (payload.length > 0) {
      const { data, error } = await admin.from("change_order_attachments").insert(payload).select("*");
      if (error) throw error;
      saved.attachments = (data ?? []).map((row) => mapChangeOrderAttachmentRow(row as Record<string, unknown>));
    }
  }

  if (input.status_history) {
    const payload = input.status_history.map((item) => ({
      ...item,
      change_order_id: changeOrderId,
      previous_status: item.previous_status ?? null,
      new_status: item.new_status ?? "draft",
      reason: item.reason ?? null,
      changed_by: item.changed_by ?? null,
      metadata: item.metadata ?? {},
    }));

    if (payload.length > 0) {
      const { data, error } = await admin.from("change_order_status_history").insert(payload).select("*");
      if (error) throw error;
      saved.status_history = (data ?? []).map((row) => mapChangeOrderStatusHistoryRow(row as Record<string, unknown>));
    }
  }

  return saved;
}
