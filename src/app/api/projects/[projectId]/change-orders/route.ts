import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canReadChangeOrders,
  canWriteChangeOrders,
  computeChangeOrderSummary,
  displayChangeOrderNumber,
  formatZodError,
  getChangeOrderRequestContext,
  mapChangeOrderAttachmentRow,
  mapChangeOrderLineItemRow,
  mapChangeOrderRow,
  mapChangeOrderStatusHistoryRow,
  sanitizeChangeOrderForRole,
  saveChangeOrderChildren,
  type ChangeOrderRequestContextSuccess,
} from "@/lib/change-orders/server";
import type {
  ChangeOrder,
  ChangeOrderAttachment,
  ChangeOrderLineItem,
  ChangeOrderStatusHistory,
} from "@/types/database";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

const lineItemSchema = z.object({
  category: z.enum(["labor", "material", "equipment", "subcontractor", "other"]),
  description: z.string().trim().min(1),
  role: z.string().trim().nullable().optional(),
  people_count: z.coerce.number().finite().nullable().optional(),
  hours_per_person: z.coerce.number().finite().nullable().optional(),
  days: z.coerce.number().finite().nullable().optional(),
  hourly_rate: z.coerce.number().finite().nullable().optional(),
  quantity: z.coerce.number().finite().nullable().optional(),
  unit: z.string().trim().nullable().optional(),
  unit_cost: z.coerce.number().finite().nullable().optional(),
  lump_sum: z.coerce.number().finite().nullable().optional(),
  markup_percent: z.coerce.number().finite().default(0),
  sort_order: z.coerce.number().int().optional(),
});

const attachmentSchema = z.object({
  attachment_kind: z.enum(["backup", "supporting", "photo", "pdf", "signed", "customer"]).default("backup"),
  title: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  file_name: z.string().trim().min(1),
  content_type: z.string().trim().nullable().optional(),
  storage_provider: z.string().trim().default("onedrive"),
  storage_path: z.string().trim().nullable().optional(),
  storage_web_url: z.string().trim().url().nullable().optional(),
  file_size_bytes: z.coerce.number().int().nonnegative().nullable().optional(),
  sort_order: z.coerce.number().int().optional(),
  is_customer_visible: z.boolean().default(false),
});

const createChangeOrderSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  status: z.enum(["draft", "needs_pricing", "ready_to_submit", "submitted", "in_review", "approved", "rejected", "voided", "superseded", "executed", "billed", "paid"]).default("draft"),
  pricing_mode: z.enum(["quick_total", "detailed"]).default("quick_total"),
  amount: z.coerce.number().finite().nullable().optional(),
  requested_amount: z.coerce.number().finite().nullable().optional(),
  approved_amount: z.coerce.number().finite().nullable().optional(),
  requested_days: z.coerce.number().int().finite().nullable().optional(),
  approved_days: z.coerce.number().int().finite().nullable().optional(),
  requested_by_name: z.string().trim().nullable().optional(),
  customer_contact_name: z.string().trim().nullable().optional(),
  customer_contact_email: z.string().trim().email().nullable().optional(),
  source: z.string().trim().nullable().optional(),
  what_happened: z.string().trim().nullable().optional(),
  work_required: z.string().trim().nullable().optional(),
  reason: z.string().trim().nullable().optional(),
  terms_note: z.string().trim().nullable().optional(),
  status_reason: z.string().trim().nullable().optional(),
  internal_notes: z.string().trim().nullable().optional(),
  reference_doc: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  submitted_date: z.string().trim().nullable().optional(),
  approved_date: z.string().trim().nullable().optional(),
  submitted_at: z.string().trim().nullable().optional(),
  approved_at: z.string().trim().nullable().optional(),
  executed_at: z.string().trim().nullable().optional(),
  billed_at: z.string().trim().nullable().optional(),
  paid_at: z.string().trim().nullable().optional(),
  voided_at: z.string().trim().nullable().optional(),
  rejected_at: z.string().trim().nullable().optional(),
  superseded_at: z.string().trim().nullable().optional(),
  combined_at: z.string().trim().nullable().optional(),
  superseded_by_change_order_id: z.string().uuid().nullable().optional(),
  combined_into_change_order_id: z.string().uuid().nullable().optional(),
  line_items: z.array(lineItemSchema).optional(),
  attachments: z.array(attachmentSchema).optional(),
});

function internalRoles(role: string | null | undefined) {
  return role === "admin" || role === "ops_manager" || role === "pm" || role === "lead";
}

function attachChildren(
  changeOrder: ChangeOrder,
  lineItems: ChangeOrderLineItem[],
  attachments: ChangeOrderAttachment[],
  statusHistory: ChangeOrderStatusHistory[],
  role: ChangeOrderRequestContextSuccess["role"]
) {
  const bundle = {
    ...changeOrder,
    line_items: lineItems,
    attachments,
    status_history: internalRoles(role) ? statusHistory : [],
  };

  return sanitizeChangeOrderForRole(bundle as ChangeOrder, role);
}

async function getProjectChangeOrders(
  adminClient: ChangeOrderRequestContextSuccess["adminClient"],
  projectId: string,
  role: ChangeOrderRequestContextSuccess["role"]
) {
  const { data: orders, error } = await adminClient
    .from("change_orders")
    .select(
      `
        *,
        project:projects(id, name, job_number, customer:customers(name))
      `
    )
    .eq("project_id", projectId)
    .order("sequence_number", { ascending: true });

  if (error) throw error;

  const changeOrderRows = (orders ?? []).map((row) => mapChangeOrderRow(row as Record<string, unknown>));
  const changeOrderIds = changeOrderRows.map((row) => row.id);

  const [lineItemsResult, attachmentsResult, statusHistoryResult] = await Promise.all([
    changeOrderIds.length
      ? adminClient
          .from("change_order_line_items")
          .select("*")
          .in("change_order_id", changeOrderIds)
          .order("change_order_id", { ascending: true })
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    changeOrderIds.length
      ? adminClient
          .from("change_order_attachments")
          .select("*")
          .in("change_order_id", changeOrderIds)
          .order("change_order_id", { ascending: true })
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    internalRoles(role) && changeOrderIds.length
      ? adminClient
          .from("change_order_status_history")
          .select("*")
          .in("change_order_id", changeOrderIds)
          .order("change_order_id", { ascending: true })
          .order("changed_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (lineItemsResult.error) throw lineItemsResult.error;
  if (attachmentsResult.error) throw attachmentsResult.error;
  if (statusHistoryResult.error) throw statusHistoryResult.error;

  const lineItemsByOrder = new Map<string, ChangeOrderLineItem[]>();
  for (const row of (lineItemsResult.data ?? []) as Record<string, unknown>[]) {
    const item = mapChangeOrderLineItemRow(row);
    const bucket = lineItemsByOrder.get(item.change_order_id) ?? [];
    bucket.push(item);
    lineItemsByOrder.set(item.change_order_id, bucket);
  }

  const attachmentsByOrder = new Map<string, ChangeOrderAttachment[]>();
  for (const row of (attachmentsResult.data ?? []) as Record<string, unknown>[]) {
    const attachment = mapChangeOrderAttachmentRow(row);
    const bucket = attachmentsByOrder.get(attachment.change_order_id) ?? [];
    bucket.push(attachment);
    attachmentsByOrder.set(attachment.change_order_id, bucket);
  }

  const historyByOrder = new Map<string, ChangeOrderStatusHistory[]>();
  for (const row of (statusHistoryResult.data ?? []) as Record<string, unknown>[]) {
    const history = mapChangeOrderStatusHistoryRow(row);
    const bucket = historyByOrder.get(history.change_order_id) ?? [];
    bucket.push(history);
    historyByOrder.set(history.change_order_id, bucket);
  }

  const changeOrders = changeOrderRows.map((changeOrder) => {
    const line_items = lineItemsByOrder.get(changeOrder.id) ?? [];
    const attachments = attachmentsByOrder.get(changeOrder.id) ?? [];
    const status_history = historyByOrder.get(changeOrder.id) ?? [];
    const withRelations: ChangeOrder = {
      ...changeOrder,
      line_items,
      attachments,
      status_history,
    };
    return attachChildren(withRelations, line_items, attachments, status_history, role);
  });

  return changeOrders;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { projectId } = await params;
  const context = await getChangeOrderRequestContext();
  if (!context.ok) return context.response;
  const { adminClient, user, role } = context;

  try {
    const allowed = await canReadChangeOrders(adminClient, projectId, user.id, role);
    if (!allowed) {
      return NextResponse.json({ error: "Project access required." }, { status: 403 });
    }

    const changeOrders = await getProjectChangeOrders(adminClient, projectId, role);
    const summary = computeChangeOrderSummary(changeOrders as ChangeOrder[]);

    const { data: sequenceRow } = await adminClient
      .from("project_change_order_sequences")
      .select("next_sequence")
      .eq("project_id", projectId)
      .maybeSingle();

    const previewSequence = typeof sequenceRow?.next_sequence === "number" ? sequenceRow.next_sequence : null;
    const latest = changeOrders[changeOrders.length - 1] as ChangeOrder | undefined;
    const nextPreview =
      previewSequence && latest
        ? `${latest.number_prefix || "COR"}-${String(previewSequence).padStart(Math.max(latest.number_padding || 4, 2), "0")}`
        : previewSequence
          ? `COR-${String(previewSequence).padStart(4, "0")}`
          : "COR-0001";

    return NextResponse.json({
      changeOrders,
      summary,
      nextCorPreview: nextPreview,
      nextCoPreview: nextPreview,
      nextSequenceNumber: previewSequence ?? 1,
      displayCount: changeOrders.length,
      displayNext: displayChangeOrderNumber({
        cor_number: nextPreview,
        co_number: nextPreview,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load change orders." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { projectId } = await params;
  const context = await getChangeOrderRequestContext();
  if (!context.ok) return context.response;
  const { adminClient, user, role } = context;

  try {
    const allowed = await canWriteChangeOrders(adminClient, projectId, user.id, role);
    if (!allowed) {
      return NextResponse.json({ error: "Write access required." }, { status: 403 });
    }

    const parsed = createChangeOrderSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const payload = parsed.data;
    const hasLineItems = (payload.line_items?.length ?? 0) > 0;
    const hasAttachments = (payload.attachments?.length ?? 0) > 0;
    const pricingMode = payload.pricing_mode ?? (hasLineItems ? "detailed" : "quick_total");
    const effectiveStatus = payload.status && payload.status !== "draft" ? payload.status : "submitted";
    const requestedAmount = payload.requested_amount ?? payload.amount ?? 0;
    const approvedAmount = payload.approved_amount ?? 0;
    const lineItems = payload.line_items?.map((item, index) => ({
      category: item.category,
      description: item.description,
      role: item.role ?? null,
      people_count: item.people_count ?? null,
      hours_per_person: item.hours_per_person ?? null,
      days: item.days ?? null,
      hourly_rate: item.hourly_rate ?? null,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      unit_cost: item.unit_cost ?? null,
      lump_sum: item.lump_sum ?? null,
      markup_percent: item.markup_percent ?? 0,
      sort_order: item.sort_order ?? index,
    }));
    const attachments = payload.attachments?.map((item, index) => ({
      attachment_kind: item.attachment_kind ?? "backup",
      title: item.title ?? null,
      description: item.description ?? null,
      file_name: item.file_name,
      content_type: item.content_type ?? null,
      storage_provider: item.storage_provider ?? "onedrive",
      storage_path: item.storage_path ?? null,
      storage_web_url: item.storage_web_url ?? null,
      file_size_bytes: item.file_size_bytes ?? null,
      sort_order: item.sort_order ?? index,
      is_customer_visible: item.is_customer_visible ?? false,
    }));

    const { data, error } = await adminClient
      .from("change_orders")
      .insert({
        project_id: projectId,
        title: payload.title,
        description: payload.description ?? null,
        status: effectiveStatus,
        pricing_mode: pricingMode,
        amount: requestedAmount,
        requested_amount: requestedAmount,
        approved_amount: approvedAmount,
        requested_days: payload.requested_days ?? 0,
        approved_days: payload.approved_days ?? 0,
        requested_by_name: payload.requested_by_name ?? null,
        customer_contact_name: payload.customer_contact_name ?? null,
        customer_contact_email: payload.customer_contact_email ?? null,
        source: payload.source ?? null,
        what_happened: payload.what_happened ?? null,
        work_required: payload.work_required ?? null,
        reason: payload.reason ?? null,
        terms_note: payload.terms_note ?? null,
        status_reason: payload.status_reason ?? null,
        internal_notes: payload.internal_notes ?? null,
        reference_doc: payload.reference_doc ?? null,
        notes: payload.notes ?? null,
        submitted_date: payload.submitted_date ?? null,
        approved_date: payload.approved_date ?? null,
        submitted_at: payload.submitted_at ?? (effectiveStatus === "submitted" ? new Date().toISOString() : null),
        approved_at: payload.approved_at ?? null,
        executed_at: payload.executed_at ?? null,
        billed_at: payload.billed_at ?? null,
        paid_at: payload.paid_at ?? null,
        voided_at: payload.voided_at ?? null,
        rejected_at: payload.rejected_at ?? null,
        superseded_at: payload.superseded_at ?? null,
        combined_at: payload.combined_at ?? null,
        superseded_by_change_order_id: payload.superseded_by_change_order_id ?? null,
        combined_into_change_order_id: payload.combined_into_change_order_id ?? null,
        modified_by: user.id,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (hasLineItems || hasAttachments) {
      await saveChangeOrderChildren(adminClient, data.id, {
        line_items: lineItems,
        attachments,
      });
    }

    const bundle = await getProjectChangeOrders(adminClient, projectId, role);
    const created = bundle.find((item) => item.id === data.id);
    if (!created) {
      return NextResponse.json({ error: "Change order created but could not be reloaded." }, { status: 500 });
    }

    return NextResponse.json({ changeOrder: created });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create change order." },
      { status: 500 }
    );
  }
}
