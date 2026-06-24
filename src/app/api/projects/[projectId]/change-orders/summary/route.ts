import { NextResponse } from "next/server";
import {
  canReadChangeOrders,
  computeChangeOrderSummary,
  getChangeOrderRequestContext,
  mapChangeOrderRow,
  normalizeChangeOrderStatus,
} from "@/lib/change-orders/server";
import type { ChangeOrderRequestContextSuccess } from "@/lib/change-orders/server";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

function sumForStatuses(
  changeOrders: Array<{ status: string; requested_amount: number; approved_amount: number }>,
  statuses: readonly string[],
  field: "requested_amount" | "approved_amount"
) {
  return changeOrders
    .filter((co) => statuses.includes(normalizeChangeOrderStatus(co.status)))
    .reduce((sum, co) => sum + co[field], 0);
}

async function getNextPreview(adminClient: ChangeOrderRequestContextSuccess["adminClient"], projectId: string) {
  const [{ data: sequenceRow }, { data: latestRow }] = await Promise.all([
    adminClient
      .from("project_change_order_sequences")
      .select("next_sequence")
      .eq("project_id", projectId)
      .maybeSingle(),
    adminClient
      .from("change_orders")
      .select("number_prefix, number_padding")
      .eq("project_id", projectId)
      .order("sequence_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const nextSequence = typeof sequenceRow?.next_sequence === "number" ? sequenceRow.next_sequence : 1;
  const prefix = typeof latestRow?.number_prefix === "string" && latestRow.number_prefix.trim() ? latestRow.number_prefix.trim() : "COR";
  const padding = typeof latestRow?.number_padding === "number" && latestRow.number_padding > 0 ? latestRow.number_padding : 4;
  const preview = `${prefix}-${String(nextSequence).padStart(padding, "0")}`;

  return {
    next_sequence_number: nextSequence,
    next_cor_preview: preview,
    next_co_preview: preview,
  };
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

    const { data, error } = await adminClient
      .from("change_orders")
      .select(
        `
          id, project_id, status, requested_amount, approved_amount, requested_days, approved_days,
          sequence_number, cor_number, co_number, number_prefix, number_padding
        `
      )
      .eq("project_id", projectId)
      .order("sequence_number", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const changeOrders = (data ?? []).map((row) => mapChangeOrderRow(row as Record<string, unknown>));
    const summary = computeChangeOrderSummary(changeOrders);
    const openPendingRequestedTotal = sumForStatuses(changeOrders, ["draft", "needs_pricing", "ready_to_submit", "submitted", "in_review"], "requested_amount");
    const activeRequestedTotal = sumForStatuses(
      changeOrders,
      ["draft", "needs_pricing", "ready_to_submit", "submitted", "in_review", "approved", "executed", "billed", "paid"],
      "requested_amount"
    );
    const approvedTotal = sumForStatuses(changeOrders, ["approved", "executed", "billed", "paid"], "approved_amount");
    const executedTotal = sumForStatuses(changeOrders, ["executed"], "approved_amount");
    const billedTotal = sumForStatuses(changeOrders, ["billed"], "approved_amount");
    const paidTotal = sumForStatuses(changeOrders, ["paid"], "approved_amount");
    const nextPreview = await getNextPreview(adminClient, projectId);

    return NextResponse.json({
      summaryCards: {
        approved_total: approvedTotal,
        open_pending_requested_total: openPendingRequestedTotal,
        active_requested_total: activeRequestedTotal,
        executed_total: executedTotal,
        billed_total: billedTotal,
        paid_total: paidTotal,
        counts_by_status: summary.status_counts,
      },
      nextCorPreview: nextPreview.next_cor_preview,
      nextCoPreview: nextPreview.next_co_preview,
      nextSequenceNumber: nextPreview.next_sequence_number,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load change order summary." },
      { status: 500 }
    );
  }
}
