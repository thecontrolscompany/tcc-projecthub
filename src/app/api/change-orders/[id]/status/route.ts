import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CHANGE_ORDER_UI_STATUSES,
  canWriteChangeOrders,
  getChangeOrderRequestContext,
  loadChangeOrderBundle,
} from "@/lib/change-orders/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const statusSchema = z.object({
  status: z.enum(CHANGE_ORDER_UI_STATUSES),
  status_reason: z.string().trim().nullable().optional(),
  superseded_by_change_order_id: z.string().uuid().nullable().optional(),
  combined_into_change_order_id: z.string().uuid().nullable().optional(),
});

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

    const parsed = statusSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { status, status_reason, superseded_by_change_order_id, combined_into_change_order_id } = parsed.data;

    if (["rejected", "voided", "superseded"].includes(status) && !status_reason?.trim()) {
      return NextResponse.json({ error: "status_reason is required for rejected, voided, and superseded statuses." }, { status: 400 });
    }

    if (status === "superseded" && !superseded_by_change_order_id) {
      return NextResponse.json({ error: "superseded_by_change_order_id is required when status is superseded." }, { status: 400 });
    }

    if (combined_into_change_order_id && !["voided", "superseded"].includes(status)) {
      return NextResponse.json({ error: "combined_into_change_order_id can only be set when the status is voided or superseded." }, { status: 400 });
    }

    const { error } = await adminClient
      .from("change_orders")
      .update({
        status,
        status_reason: status_reason ?? null,
        superseded_by_change_order_id: superseded_by_change_order_id ?? null,
        combined_into_change_order_id: combined_into_change_order_id ?? null,
        modified_by: user.id,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const bundle = await loadChangeOrderBundle(adminClient, id, role);
    if (!bundle) {
      return NextResponse.json({ error: "Change order updated but could not be reloaded." }, { status: 500 });
    }

    return NextResponse.json({ changeOrder: bundle });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update change order status." },
      { status: 500 }
    );
  }
}
