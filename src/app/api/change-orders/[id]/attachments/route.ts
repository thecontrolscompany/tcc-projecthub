import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canReadChangeOrders,
  canWriteChangeOrders,
  getChangeOrderRequestContext,
  mapChangeOrderAttachmentRow,
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

function publicAttachmentView(attachment: ReturnType<typeof mapChangeOrderAttachmentRow>) {
  return {
    id: attachment.id,
    change_order_id: attachment.change_order_id,
    attachment_kind: attachment.attachment_kind,
    title: attachment.title,
    description: attachment.description,
    file_name: attachment.file_name,
    content_type: attachment.content_type,
    storage_web_url: attachment.storage_web_url,
    file_size_bytes: attachment.file_size_bytes,
    sort_order: attachment.sort_order,
    is_customer_visible: attachment.is_customer_visible,
    created_at: attachment.created_at,
    updated_at: attachment.updated_at,
  };
}

async function getAccess(context: ChangeOrderAccessContext, id: string) {
  const { adminClient, user, role } = context;
  const { data, error } = await adminClient
    .from("change_orders")
    .select("project_id")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data?.project_id) return null;

  const canRead = await canReadChangeOrders(adminClient, data.project_id, user.id, role);
  const canWrite = await canWriteChangeOrders(adminClient, data.project_id, user.id, role);
  return { projectId: data.project_id, canRead, canWrite };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const context = await getChangeOrderRequestContext();
  if (!context.ok) return context.response;
  const { adminClient, role } = context;

  try {
    const access = await getAccess(context, id);
    if (!access?.projectId) {
      return NextResponse.json({ error: "Change order not found." }, { status: 404 });
    }
    if (!access.canRead) {
      return NextResponse.json({ error: "Project access required." }, { status: 403 });
    }

    const { data, error } = await adminClient
      .from("change_order_attachments")
      .select("*")
      .eq("change_order_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const attachments = (data ?? []).map((row) => mapChangeOrderAttachmentRow(row as Record<string, unknown>));
    const visibleAttachments = role === "customer" ? attachments.filter((attachment) => attachment.is_customer_visible).map(publicAttachmentView) : attachments;

    return NextResponse.json({ attachments: visibleAttachments });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load attachments." },
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
    const access = await getAccess(context, id);
    if (!access?.projectId) {
      return NextResponse.json({ error: "Change order not found." }, { status: 404 });
    }
    if (!access.canWrite) {
      return NextResponse.json({ error: "Write access required." }, { status: 403 });
    }

    const parsed = attachmentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from("change_order_attachments")
      .insert({
        change_order_id: id,
        attachment_kind: parsed.data.attachment_kind,
        title: parsed.data.title ?? null,
        description: parsed.data.description ?? null,
        file_name: parsed.data.file_name,
        content_type: parsed.data.content_type ?? null,
        storage_provider: parsed.data.storage_provider ?? "onedrive",
        storage_path: parsed.data.storage_path ?? null,
        storage_web_url: parsed.data.storage_web_url ?? null,
        file_size_bytes: parsed.data.file_size_bytes ?? null,
        sort_order: parsed.data.sort_order ?? 0,
        is_customer_visible: parsed.data.is_customer_visible ?? false,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ attachment: mapChangeOrderAttachmentRow(data as Record<string, unknown>) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create attachment metadata." },
      { status: 500 }
    );
  }
}
