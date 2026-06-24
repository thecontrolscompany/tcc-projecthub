import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canReadChangeOrders,
  canWriteChangeOrders,
  getChangeOrderRequestContext,
  loadChangeOrderBundle,
  saveChangeOrderChildren,
} from "@/lib/change-orders/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const lineItemSchema = z.object({
  id: z.string().uuid().optional(),
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
  id: z.string().uuid().optional(),
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

const patchSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  pricing_mode: z.enum(["quick_total", "detailed"]).optional(),
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

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const context = await getChangeOrderRequestContext();
  if (!context.ok) return context.response;
  const { adminClient, user, role } = context;

  try {
    const { data: lookup, error: lookupError } = await adminClient
      .from("change_orders")
      .select("project_id")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (!lookup?.project_id) {
      return NextResponse.json({ error: "Change order not found." }, { status: 404 });
    }

    const allowed = await canReadChangeOrders(adminClient, lookup.project_id, user.id, role);
    if (!allowed) {
      return NextResponse.json({ error: "Project access required." }, { status: 403 });
    }

    const bundle = await loadChangeOrderBundle(adminClient, id, role);
    if (!bundle) {
      return NextResponse.json({ error: "Change order not found." }, { status: 404 });
    }

    return NextResponse.json(bundle);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load change order." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const context = await getChangeOrderRequestContext();
  if (!context.ok) return context.response;
  const { adminClient, user, role } = context;

  try {
    const { data: lookup, error: lookupError } = await adminClient
      .from("change_orders")
      .select("project_id")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (!lookup?.project_id) {
      return NextResponse.json({ error: "Change order not found." }, { status: 404 });
    }

    const allowed = await canWriteChangeOrders(adminClient, lookup.project_id, user.id, role);
    if (!allowed) {
      return NextResponse.json({ error: "Write access required." }, { status: 403 });
    }

    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    const updatePayload: Record<string, unknown> = { modified_by: user.id };

    for (const key of [
      "title",
      "description",
      "pricing_mode",
      "requested_amount",
      "approved_amount",
      "requested_days",
      "approved_days",
      "requested_by_name",
      "customer_contact_name",
      "customer_contact_email",
      "source",
      "what_happened",
      "work_required",
      "reason",
      "terms_note",
      "status_reason",
      "internal_notes",
      "reference_doc",
      "notes",
      "submitted_date",
      "approved_date",
      "submitted_at",
      "approved_at",
      "executed_at",
      "billed_at",
      "paid_at",
      "voided_at",
      "rejected_at",
      "superseded_at",
      "combined_at",
      "superseded_by_change_order_id",
      "combined_into_change_order_id",
    ] as const) {
      if (payload[key] !== undefined) {
        updatePayload[key] = payload[key];
      }
    }
    if (typeof payload.amount === "number" || payload.amount === null) {
      updatePayload.amount = payload.amount;
    }

    const { error } = await adminClient
      .from("change_orders")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (payload.line_items || payload.attachments) {
      await saveChangeOrderChildren(adminClient, id, {
        line_items: payload.line_items?.map((item, index) => ({
          id: item.id,
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
        })),
        attachments: payload.attachments?.map((item, index) => ({
          id: item.id,
          attachment_kind: item.attachment_kind,
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
        })),
      });
    }

    const bundle = await loadChangeOrderBundle(adminClient, id, role);
    if (!bundle) {
      return NextResponse.json({ error: "Change order updated but could not be reloaded." }, { status: 500 });
    }

    return NextResponse.json({ changeOrder: bundle });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update change order." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Change orders cannot be hard deleted. Use the status route to void or supersede instead." },
    { status: 405 }
  );
}
