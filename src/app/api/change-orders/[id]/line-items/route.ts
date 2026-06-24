import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canReadChangeOrders,
  canWriteChangeOrders,
  getChangeOrderRequestContext,
  mapChangeOrderLineItemRow,
} from "@/lib/change-orders/server";
import type { ChangeOrderRequestContextSuccess } from "@/lib/change-orders/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ChangeOrderAccessContext = {
  adminClient: ChangeOrderRequestContextSuccess["adminClient"];
  user: { id: string };
  role: ChangeOrderRequestContextSuccess["role"];
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

async function getProjectAccess(context: ChangeOrderAccessContext, id: string) {
  const { adminClient, user, role } = context;
  const { data, error } = await adminClient
    .from("change_orders")
    .select("project_id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.project_id) {
    return null;
  }

  const canRead = await canReadChangeOrders(adminClient, data.project_id, user.id, role);
  const canWrite = await canWriteChangeOrders(adminClient, data.project_id, user.id, role);

  return { projectId: data.project_id, canRead, canWrite };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const context = await getChangeOrderRequestContext();
  if (!context.ok) return context.response;
  const { adminClient } = context;

  try {
    const access = await getProjectAccess(context, id);
    if (!access?.projectId) {
      return NextResponse.json({ error: "Change order not found." }, { status: 404 });
    }
    if (!access.canRead) {
      return NextResponse.json({ error: "Project access required." }, { status: 403 });
    }

    const { data, error } = await adminClient
      .from("change_order_line_items")
      .select("*")
      .eq("change_order_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      lineItems: (data ?? []).map((row) => mapChangeOrderLineItemRow(row as Record<string, unknown>)),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load line items." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const context = await getChangeOrderRequestContext();
  if (!context.ok) return context.response;
  const { adminClient } = context;

  try {
    const access = await getProjectAccess(context, id);
    if (!access?.projectId) {
      return NextResponse.json({ error: "Change order not found." }, { status: 404 });
    }
    if (!access.canWrite) {
      return NextResponse.json({ error: "Write access required." }, { status: 403 });
    }

    const parsed = lineItemSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from("change_order_line_items")
      .insert({
        change_order_id: id,
        category: parsed.data.category,
        description: parsed.data.description,
        role: parsed.data.role ?? null,
        people_count: parsed.data.people_count ?? null,
        hours_per_person: parsed.data.hours_per_person ?? null,
        days: parsed.data.days ?? null,
        hourly_rate: parsed.data.hourly_rate ?? null,
        quantity: parsed.data.quantity ?? null,
        unit: parsed.data.unit ?? null,
        unit_cost: parsed.data.unit_cost ?? null,
        lump_sum: parsed.data.lump_sum ?? null,
        markup_percent: parsed.data.markup_percent ?? 0,
        sort_order: parsed.data.sort_order ?? 0,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ lineItem: mapChangeOrderLineItemRow(data as Record<string, unknown>) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create line item." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const context = await getChangeOrderRequestContext();
  if (!context.ok) return context.response;
  const { adminClient } = context;

  try {
    const access = await getProjectAccess(context, id);
    if (!access?.projectId) {
      return NextResponse.json({ error: "Change order not found." }, { status: 404 });
    }
    if (!access.canWrite) {
      return NextResponse.json({ error: "Write access required." }, { status: 403 });
    }

    const parsed = lineItemSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || !parsed.data.id) {
      return NextResponse.json({ error: parsed.error?.flatten?.() ?? { formErrors: ["Line item id is required."] } }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from("change_order_line_items")
      .update({
        category: parsed.data.category,
        description: parsed.data.description,
        role: parsed.data.role ?? null,
        people_count: parsed.data.people_count ?? null,
        hours_per_person: parsed.data.hours_per_person ?? null,
        days: parsed.data.days ?? null,
        hourly_rate: parsed.data.hourly_rate ?? null,
        quantity: parsed.data.quantity ?? null,
        unit: parsed.data.unit ?? null,
        unit_cost: parsed.data.unit_cost ?? null,
        lump_sum: parsed.data.lump_sum ?? null,
        markup_percent: parsed.data.markup_percent ?? 0,
        sort_order: parsed.data.sort_order ?? 0,
      })
      .eq("id", parsed.data.id)
      .eq("change_order_id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ lineItem: mapChangeOrderLineItemRow(data as Record<string, unknown>) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update line item." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const context = await getChangeOrderRequestContext();
  if (!context.ok) return context.response;
  const { adminClient } = context;

  try {
    const access = await getProjectAccess(context, id);
    if (!access?.projectId) {
      return NextResponse.json({ error: "Change order not found." }, { status: 404 });
    }
    if (!access.canWrite) {
      return NextResponse.json({ error: "Write access required." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const itemId = typeof body?.id === "string" ? body.id : "";
    if (!itemId) {
      return NextResponse.json({ error: "Line item id is required." }, { status: 400 });
    }

    const { error } = await adminClient
      .from("change_order_line_items")
      .delete()
      .eq("id", itemId)
      .eq("change_order_id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete line item." },
      { status: 500 }
    );
  }
}
