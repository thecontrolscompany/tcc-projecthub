"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fmtCurrency } from "@/lib/utils/format";
import type {
  ChangeOrder,
  ChangeOrderAttachment,
  ChangeOrderAttachmentKind,
  ChangeOrderLineItem,
  ChangeOrderStatus,
  ChangeOrderUiStatus,
} from "@/types/database";

type SummaryCards = {
  approved_total: number;
  open_pending_requested_total: number;
  active_requested_total: number;
  executed_total: number;
  billed_total: number;
  paid_total: number;
  counts_by_status: Record<ChangeOrderUiStatus, number>;
};

type ChangeOrdersListResponse = {
  changeOrders: ChangeOrder[];
  summary?: {
    count: number;
    requested_amount: number;
    approved_amount: number;
    requested_days: number;
    approved_days: number;
    status_counts: Record<ChangeOrderUiStatus, number>;
    status_requested_amounts: Record<ChangeOrderUiStatus, number>;
    status_approved_amounts: Record<ChangeOrderUiStatus, number>;
  };
  nextCorPreview?: string;
  nextCoPreview?: string;
  nextSequenceNumber?: number;
};

type SummaryResponse = {
  summaryCards: SummaryCards;
  nextCorPreview?: string;
  nextCoPreview?: string;
  nextSequenceNumber?: number;
};

type ChangeOrderDraftAttachment = {
  id?: string;
  attachment_kind: ChangeOrderAttachmentKind;
  title: string;
  description: string;
  file_name: string;
  content_type: string;
  storage_provider: string;
  storage_path: string;
  storage_web_url: string;
  file_size_bytes: string;
  sort_order: number;
  is_customer_visible: boolean;
};

type ChangeOrderDraftLineItem = {
  id?: string;
  category: ChangeOrderLineItem["category"];
  description: string;
  role: string;
  people_count: string;
  hours_per_person: string;
  days: string;
  hourly_rate: string;
  quantity: string;
  unit: string;
  unit_cost: string;
  lump_sum: string;
  markup_percent: string;
  sort_order: number;
};

type ChangeOrderFormState = {
  title: string;
  description: string;
  status: ChangeOrderUiStatus;
  pricing_mode: "quick_total" | "detailed";
  amount: string;
  requested_amount: string;
  approved_amount: string;
  requested_days: string;
  approved_days: string;
  requested_by_name: string;
  customer_contact_name: string;
  customer_contact_email: string;
  source: string;
  what_happened: string;
  work_required: string;
  reason: string;
  terms_note: string;
  status_reason: string;
  internal_notes: string;
  submitted_at: string;
  approved_at: string;
  executed_at: string;
  billed_at: string;
  paid_at: string;
  voided_at: string;
  rejected_at: string;
  superseded_at: string;
  combined_at: string;
  superseded_by_change_order_id: string;
  combined_into_change_order_id: string;
  line_items: ChangeOrderDraftLineItem[];
  attachments: ChangeOrderDraftAttachment[];
};

type StatusModalState = {
  changeOrderId: string;
  status: ChangeOrderUiStatus;
  status_reason: string;
  superseded_by_change_order_id: string;
  combined_into_change_order_id: string;
};

const UI_STATUSES: ChangeOrderUiStatus[] = [
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
];

const QUICK_STATUS_OPTIONS: ChangeOrderUiStatus[] = [
  "submitted",
  "approved",
  "rejected",
  "voided",
  "superseded",
  "executed",
  "billed",
  "paid",
];

const STATUS_LABELS: Record<ChangeOrderUiStatus, string> = {
  draft: "Draft",
  needs_pricing: "Needs Pricing",
  ready_to_submit: "Ready to Submit",
  submitted: "Submitted",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
  voided: "Voided",
  superseded: "Superseded",
  executed: "Executed",
  billed: "Billed",
  paid: "Paid",
};

const STATUS_BADGE_CLASSES: Record<ChangeOrderUiStatus, string> = {
  draft: "bg-slate-500/10 text-slate-600",
  needs_pricing: "bg-amber-500/10 text-amber-600",
  ready_to_submit: "bg-cyan-500/10 text-cyan-600",
  submitted: "bg-blue-500/10 text-blue-600",
  in_review: "bg-status-warning/10 text-status-warning",
  approved: "bg-status-success/10 text-status-success",
  rejected: "bg-status-danger/10 text-status-danger",
  voided: "bg-surface-overlay text-text-tertiary",
  superseded: "bg-slate-500/10 text-slate-600",
  executed: "bg-emerald-500/10 text-emerald-600",
  billed: "bg-indigo-500/10 text-indigo-600",
  paid: "bg-green-500/10 text-green-600",
};

const STATUS_ORDER: ChangeOrderUiStatus[] = [
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
];

function emptyAttachmentDraft(index = 0): ChangeOrderDraftAttachment {
  return {
    attachment_kind: "backup",
    title: "",
    description: "",
    file_name: "",
    content_type: "",
    storage_provider: "onedrive",
    storage_path: "",
    storage_web_url: "",
    file_size_bytes: "",
    sort_order: index,
    is_customer_visible: false,
  };
}

function emptyLineItemDraft(index = 0): ChangeOrderDraftLineItem {
  return {
    category: "labor",
    description: "",
    role: "",
    people_count: "",
    hours_per_person: "",
    days: "",
    hourly_rate: "",
    quantity: "",
    unit: "",
    unit_cost: "",
    lump_sum: "",
    markup_percent: "0",
    sort_order: index,
  };
}

function emptyFormState(): ChangeOrderFormState {
  return {
    title: "",
    description: "",
    status: "draft",
    pricing_mode: "quick_total",
    amount: "",
    requested_amount: "",
    approved_amount: "",
    requested_days: "",
    approved_days: "",
    requested_by_name: "",
    customer_contact_name: "",
    customer_contact_email: "",
    source: "",
    what_happened: "",
    work_required: "",
    reason: "",
    terms_note: "",
    status_reason: "",
    internal_notes: "",
    submitted_at: "",
    approved_at: "",
    executed_at: "",
    billed_at: "",
    paid_at: "",
    voided_at: "",
    rejected_at: "",
    superseded_at: "",
    combined_at: "",
    superseded_by_change_order_id: "",
    combined_into_change_order_id: "",
    line_items: [],
    attachments: [],
  };
}

function toInputDate(value: string | null | undefined) {
  return value ?? "";
}

function toInputNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function toAttachmentDraft(attachment: ChangeOrderAttachment, index: number): ChangeOrderDraftAttachment {
  return {
    id: attachment.id,
    attachment_kind: attachment.attachment_kind,
    title: attachment.title ?? "",
    description: attachment.description ?? "",
    file_name: attachment.file_name,
    content_type: attachment.content_type ?? "",
    storage_provider: attachment.storage_provider ?? "onedrive",
    storage_path: attachment.storage_path ?? "",
    storage_web_url: attachment.storage_web_url ?? "",
    file_size_bytes: attachment.file_size_bytes === null ? "" : String(attachment.file_size_bytes),
    sort_order: attachment.sort_order ?? index,
    is_customer_visible: attachment.is_customer_visible,
  };
}

function toLineItemDraft(item: ChangeOrderLineItem, index: number): ChangeOrderDraftLineItem {
  return {
    id: item.id,
    category: item.category,
    description: item.description,
    role: item.role ?? "",
    people_count: item.people_count === null ? "" : String(item.people_count),
    hours_per_person: item.hours_per_person === null ? "" : String(item.hours_per_person),
    days: item.days === null ? "" : String(item.days),
    hourly_rate: item.hourly_rate === null ? "" : String(item.hourly_rate),
    quantity: item.quantity === null ? "" : String(item.quantity),
    unit: item.unit ?? "",
    unit_cost: item.unit_cost === null ? "" : String(item.unit_cost),
    lump_sum: item.lump_sum === null ? "" : String(item.lump_sum),
    markup_percent: String(item.markup_percent ?? 0),
    sort_order: item.sort_order ?? index,
  };
}

function toFormState(changeOrder: ChangeOrder | null | undefined): ChangeOrderFormState {
  if (!changeOrder) {
    return emptyFormState();
  }

  return {
    title: changeOrder.title ?? "",
    description: changeOrder.description ?? "",
    status: normalizeStatus(changeOrder.status),
    pricing_mode: changeOrder.pricing_mode ?? "quick_total",
    amount: toInputNumber(changeOrder.amount),
    requested_amount: toInputNumber(changeOrder.requested_amount),
    approved_amount: toInputNumber(changeOrder.approved_amount),
    requested_days: toInputNumber(changeOrder.requested_days),
    approved_days: toInputNumber(changeOrder.approved_days),
    requested_by_name: changeOrder.requested_by_name ?? "",
    customer_contact_name: changeOrder.customer_contact_name ?? "",
    customer_contact_email: changeOrder.customer_contact_email ?? "",
    source: changeOrder.source ?? "",
    what_happened: changeOrder.what_happened ?? "",
    work_required: changeOrder.work_required ?? "",
    reason: changeOrder.reason ?? "",
    terms_note: changeOrder.terms_note ?? "",
    status_reason: changeOrder.status_reason ?? "",
    internal_notes: changeOrder.internal_notes ?? "",
    submitted_at: toInputDate(changeOrder.submitted_at),
    approved_at: toInputDate(changeOrder.approved_at),
    executed_at: toInputDate(changeOrder.executed_at),
    billed_at: toInputDate(changeOrder.billed_at),
    paid_at: toInputDate(changeOrder.paid_at),
    voided_at: toInputDate(changeOrder.voided_at),
    rejected_at: toInputDate(changeOrder.rejected_at),
    superseded_at: toInputDate(changeOrder.superseded_at),
    combined_at: toInputDate(changeOrder.combined_at),
    superseded_by_change_order_id: changeOrder.superseded_by_change_order_id ?? "",
    combined_into_change_order_id: changeOrder.combined_into_change_order_id ?? "",
    line_items: (changeOrder.line_items ?? []).map(toLineItemDraft),
    attachments: (changeOrder.attachments ?? []).map(toAttachmentDraft),
  };
}

function normalizeStatus(status: ChangeOrderStatus | string | null | undefined): ChangeOrderUiStatus {
  switch ((status ?? "draft").toLowerCase()) {
    case "pending":
      return "in_review";
    case "needs_revision":
      return "needs_pricing";
    case "approved_po":
    case "approved_email":
      return "approved";
    case "void":
      return "voided";
    case "draft":
    case "needs_pricing":
    case "ready_to_submit":
    case "submitted":
    case "in_review":
    case "approved":
    case "rejected":
    case "voided":
    case "superseded":
    case "executed":
    case "billed":
    case "paid":
      return status as ChangeOrderUiStatus;
    default:
      return "draft";
  }
}

function displayChangeOrderNumber(changeOrder: Pick<ChangeOrder, "cor_number" | "co_number">) {
  return changeOrder.cor_number?.trim() || changeOrder.co_number?.trim() || "—";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function parseNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveInt(value: string) {
  const parsed = parseNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function lineItemBaseAmount(item: ChangeOrderDraftLineItem) {
  const category = item.category;
  const markup = parseNumber(item.markup_percent) ?? 0;

  let base = 0;
  if (category === "labor") {
    const peopleCount = parseNumber(item.people_count) ?? 0;
    const hoursPerPerson = parseNumber(item.hours_per_person) ?? 0;
    const days = parseNumber(item.days) ?? 0;
    const hourlyRate = parseNumber(item.hourly_rate) ?? 0;
    base = peopleCount * hoursPerPerson * days * hourlyRate;
  } else if (category === "material") {
    const quantity = parseNumber(item.quantity) ?? 0;
    const unitCost = parseNumber(item.unit_cost) ?? 0;
    base = quantity * unitCost;
  } else {
    const lumpSum = parseNumber(item.lump_sum);
    if (lumpSum !== null) {
      base = lumpSum;
    } else {
      const quantity = parseNumber(item.quantity) ?? 0;
      const unitCost = parseNumber(item.unit_cost) ?? 0;
      base = quantity * unitCost;
    }
  }

  return base * (1 + markup / 100);
}

function lineItemCategorySubtotal(items: ChangeOrderDraftLineItem[], category: ChangeOrderLineItem["category"]) {
  return items.filter((item) => item.category === category).reduce((sum, item) => sum + lineItemBaseAmount(item), 0);
}

function requestedAmountFromDraft(form: ChangeOrderFormState) {
  if (form.pricing_mode === "quick_total") {
    return parseNumber(form.requested_amount) ?? 0;
  }

  return form.line_items.reduce((sum, item) => sum + lineItemBaseAmount(item), 0);
}

function approvalDateForStatus(status: ChangeOrderUiStatus) {
  const today = new Date().toISOString().slice(0, 10);
  if (["submitted", "approved", "executed", "billed", "paid", "voided", "rejected", "superseded"].includes(status)) {
    return today;
  }
  return "";
}

function buildPayload(form: ChangeOrderFormState) {
  const requestedAmount = requestedAmountFromDraft(form);
  const approvedAmount = parseNumber(form.approved_amount);
  const requestedDays = parsePositiveInt(form.requested_days);
  const approvedDays = parsePositiveInt(form.approved_days);
  const status = normalizeStatus(form.status);
  const saveStatus: ChangeOrderUiStatus = status === "draft" ? "ready_to_submit" : status;
  const statusReason = form.status_reason.trim() || null;

  const lineItems = form.pricing_mode === "detailed"
    ? form.line_items
        .filter((item) => item.description.trim().length > 0 || item.category === "labor" || item.category === "material" || item.category === "equipment" || item.category === "subcontractor" || item.category === "other")
        .map((item, index) => ({
          id: item.id,
          category: item.category,
          description: item.description.trim(),
          role: item.role.trim() || null,
          people_count: parseNumber(item.people_count),
          hours_per_person: parseNumber(item.hours_per_person),
          days: parseNumber(item.days),
          hourly_rate: parseNumber(item.hourly_rate),
          quantity: parseNumber(item.quantity),
          unit: item.unit.trim() || null,
          unit_cost: parseNumber(item.unit_cost),
          lump_sum: parseNumber(item.lump_sum),
          markup_percent: parseNumber(item.markup_percent) ?? 0,
          sort_order: item.sort_order ?? index,
        }))
    : undefined;

  const attachments = form.attachments
    .filter((item) => item.file_name.trim().length > 0 || item.title.trim().length > 0 || item.description.trim().length > 0)
    .map((item, index) => ({
      id: item.id,
      attachment_kind: item.attachment_kind,
      title: item.title.trim() || null,
      description: item.description.trim() || null,
      file_name: item.file_name.trim(),
      content_type: item.content_type.trim() || null,
      storage_provider: item.storage_provider.trim() || "onedrive",
      storage_path: item.storage_path.trim() || null,
      storage_web_url: item.storage_web_url.trim() || null,
      file_size_bytes: parseNumber(item.file_size_bytes),
      sort_order: item.sort_order ?? index,
      is_customer_visible: item.is_customer_visible,
    }));

  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    status: saveStatus,
    pricing_mode: form.pricing_mode,
    amount: requestedAmount,
    requested_amount: requestedAmount,
    approved_amount: approvedAmount ?? 0,
    requested_days: requestedDays ?? 0,
    approved_days: approvedDays ?? 0,
    requested_by_name: form.requested_by_name.trim() || null,
    customer_contact_name: form.customer_contact_name.trim() || null,
    customer_contact_email: form.customer_contact_email.trim() || null,
    source: form.source.trim() || null,
    what_happened: form.what_happened.trim() || null,
    work_required: form.work_required.trim() || null,
    reason: form.reason.trim() || null,
    terms_note: form.terms_note.trim() || null,
    status_reason: statusReason,
    internal_notes: form.internal_notes.trim() || null,
    submitted_at: form.submitted_at.trim() || (saveStatus === "submitted" ? approvalDateForStatus(saveStatus) : null),
    approved_at: form.approved_at.trim() || (saveStatus === "approved" ? approvalDateForStatus(saveStatus) : null),
    executed_at: form.executed_at.trim() || (saveStatus === "executed" ? approvalDateForStatus(saveStatus) : null),
    billed_at: form.billed_at.trim() || (saveStatus === "billed" ? approvalDateForStatus(saveStatus) : null),
    paid_at: form.paid_at.trim() || (saveStatus === "paid" ? approvalDateForStatus(saveStatus) : null),
    voided_at: form.voided_at.trim() || (saveStatus === "voided" ? approvalDateForStatus(saveStatus) : null),
    rejected_at: form.rejected_at.trim() || (saveStatus === "rejected" ? approvalDateForStatus(saveStatus) : null),
    superseded_at: form.superseded_at.trim() || (saveStatus === "superseded" ? approvalDateForStatus(saveStatus) : null),
    combined_at: form.combined_at.trim() || null,
    superseded_by_change_order_id: form.superseded_by_change_order_id.trim() || null,
    combined_into_change_order_id: form.combined_into_change_order_id.trim() || null,
    line_items: lineItems,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

function ChangeOrderStatusBadge({ status }: { status: ChangeOrderStatus | string }) {
  const normalized = normalizeStatus(status);

  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASSES[normalized]}`}>{STATUS_LABELS[normalized]}</span>;
}

function StatCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</p>
      <div className="mt-2 text-xl font-semibold text-text-primary">{value}</div>
      {subtext && <p className="mt-1 text-xs text-text-tertiary">{subtext}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", className = "w-full", disabled }: { value: string; onChange: (value: string) => void; placeholder?: string; type?: string; className?: string; disabled?: boolean }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`${className} rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60`}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3, className = "w-full", disabled }: { value: string; onChange: (value: string) => void; placeholder?: string; rows?: number; className?: string; disabled?: boolean }) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={`${className} rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60`}
    />
  );
}

function Field({
  label,
  children,
  help,
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</label>
        {help && <span className="text-xs text-text-tertiary">{help}</span>}
      </div>
      {children}
    </div>
  );
}

function DialogShell({
  title,
  description,
  children,
  onClose,
  className = "max-w-5xl",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
      <div className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-border-default bg-surface-base shadow-2xl ${className}`}>
        <div className="flex items-start justify-between gap-4 border-b border-border-default px-6 py-4">
          <div>
            <h4 className="font-heading text-lg font-semibold text-text-primary">{title}</h4>
            {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-text-secondary hover:bg-surface-overlay hover:text-text-primary">
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function ChangeOrdersSection({ projectId }: { projectId: string }) {
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [summaryCards, setSummaryCards] = useState<SummaryCards | null>(null);
  const [nextCorPreview, setNextCorPreview] = useState("COR-0001");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [statusModal, setStatusModal] = useState<StatusModalState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ChangeOrderFormState>(emptyFormState());

  const visibleCounts = useMemo(
    () =>
      changeOrders.reduce(
        (acc, changeOrder) => {
          acc.attachments += changeOrder.attachments?.length ?? 0;
          acc.lineItems += changeOrder.line_items?.length ?? 0;
          return acc;
        },
        { attachments: 0, lineItems: 0 }
      ),
    [changeOrders]
  );

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [listResponse, summaryResponse] = await Promise.allSettled([
        fetch(`/api/projects/${encodeURIComponent(projectId)}/change-orders`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/change-orders/summary`, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      let listJson: ChangeOrdersListResponse | null = null;
      let summaryJson: SummaryResponse | null = null;

      if (listResponse.status === "fulfilled") {
        const res = listResponse.value;
        const json = (await res.json().catch(() => null)) as ChangeOrdersListResponse | null;
        if (!res.ok) {
          throw new Error((json as { error?: string } | null)?.error ?? "Failed to load change orders.");
        }
        listJson = json ?? null;
      } else {
        throw listResponse.reason instanceof Error ? listResponse.reason : new Error("Failed to load change orders.");
      }

      if (summaryResponse.status === "fulfilled") {
        const res = summaryResponse.value;
        const json = (await res.json().catch(() => null)) as SummaryResponse | null;
        if (res.ok && json) {
          summaryJson = json;
        }
      }

      const orders = listJson?.changeOrders ?? [];
      setChangeOrders(orders);
      setNextCorPreview(summaryJson?.nextCorPreview ?? listJson?.nextCorPreview ?? "COR-0001");
      setSummaryCards(summaryJson?.summaryCards ?? toSummaryCards(listJson?.summary, orders));
    } catch (loadError) {
      setChangeOrders([]);
      setSummaryCards(null);
      setNextCorPreview("COR-0001");
      setError(loadError instanceof Error ? loadError.message : "Failed to load change orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyFormState());
    setEditorOpen(true);
    setError(null);
  }

  function openEditForm(changeOrder: ChangeOrder) {
    setEditingId(changeOrder.id);
    setForm(toFormState(changeOrder));
    setEditorOpen(true);
    setError(null);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
    setForm(emptyFormState());
  }

  function updateField<K extends keyof ChangeOrderFormState>(key: K, value: ChangeOrderFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateLineItem(index: number, patch: Partial<ChangeOrderDraftLineItem>) {
    setForm((current) => ({
      ...current,
      line_items: current.line_items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }

  function addLineItem() {
    setForm((current) => ({ ...current, line_items: [...current.line_items, emptyLineItemDraft(current.line_items.length)] }));
  }

  function removeLineItem(index: number) {
    setForm((current) => ({
      ...current,
      line_items: current.line_items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function updateAttachment(index: number, patch: Partial<ChangeOrderDraftAttachment>) {
    setForm((current) => ({
      ...current,
      attachments: current.attachments.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }

  function addAttachment() {
    setForm((current) => ({ ...current, attachments: [...current.attachments, emptyAttachmentDraft(current.attachments.length)] }));
  }

  function removeAttachment(index: number) {
    setForm((current) => ({
      ...current,
      attachments: current.attachments.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function saveForm() {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    if (form.pricing_mode === "detailed" && form.line_items.length === 0) {
      setError("Add at least one line item or switch back to Quick Total.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = buildPayload(form);
      const res = await fetch(editingId ? `/api/change-orders/${editingId}` : `/api/projects/${encodeURIComponent(projectId)}/change-orders`, {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = typeof json?.error === "string" ? json.error : "Failed to save change order.";
        throw new Error(message);
      }

      closeEditor();
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save change order.");
    } finally {
      setSaving(false);
    }
  }

  async function saveStatus() {
    if (!statusModal) return;

    const normalized = normalizeStatus(statusModal.status);
    if (["rejected", "voided", "superseded"].includes(normalized) && !statusModal.status_reason.trim()) {
      setError("A reason is required for rejected, voided, and superseded statuses.");
      return;
    }
    if (normalized === "superseded" && !statusModal.superseded_by_change_order_id.trim()) {
      setError("Select the change order that supersedes this one.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/change-orders/${statusModal.changeOrderId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: normalized,
          status_reason: statusModal.status_reason.trim() || null,
          superseded_by_change_order_id: statusModal.superseded_by_change_order_id.trim() || null,
          combined_into_change_order_id: statusModal.combined_into_change_order_id.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = typeof json?.error === "string" ? json.error : "Failed to update status.";
        throw new Error(message);
      }
      setStatusModal(null);
      await loadData();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Failed to update status.");
    } finally {
      setSaving(false);
    }
  }

  const summary = summaryCards ?? emptySummary();
  const detailTotals = useMemo(() => {
    if (form.pricing_mode !== "detailed") {
      return {
        labor: 0,
        material: 0,
        equipment: 0,
        subcontractor: 0,
        other: 0,
        total: parseNumber(form.requested_amount) ?? 0,
      };
    }

    const labor = lineItemCategorySubtotal(form.line_items, "labor");
    const material = lineItemCategorySubtotal(form.line_items, "material");
    const equipment = lineItemCategorySubtotal(form.line_items, "equipment");
    const subcontractor = lineItemCategorySubtotal(form.line_items, "subcontractor");
    const other = lineItemCategorySubtotal(form.line_items, "other");
    const total = labor + material + equipment + subcontractor + other;

    return { labor, material, equipment, subcontractor, other, total };
  }, [form.line_items, form.pricing_mode, form.requested_amount]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="font-heading text-lg font-semibold text-text-primary">Change Orders</h4>
          <p className="mt-1 text-sm text-text-secondary">
            Track change order requests, approvals, and print-ready customer reports for this project.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/reports/project/change-orders?projectId=${encodeURIComponent(projectId)}`}
            className="rounded-xl border border-border-default bg-surface-base px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-brand-primary hover:text-brand-primary"
          >
            Project report
          </Link>
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover"
          >
            Add Change
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Active requested total" value={fmtCurrency(summary.active_requested_total ?? 0)} subtext="Open and approved requests" />
        <StatCard label="Open/pending requested total" value={fmtCurrency(summary.open_pending_requested_total ?? 0)} subtext="Draft through in review" />
        <StatCard label="Approved total" value={fmtCurrency(summary.approved_total ?? 0)} />
        <StatCard label="Executed total" value={fmtCurrency(summary.executed_total ?? 0)} />
        <StatCard label="Billed / Paid" value={`${fmtCurrency(summary.billed_total ?? 0)} / ${fmtCurrency(summary.paid_total ?? 0)}`} />
        <StatCard label="Next COR number" value={nextCorPreview} subtext="Project-scoped sequence" />
      </div>

      {error && (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised">
        <div className="flex items-center justify-between gap-4 border-b border-border-default px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">Running log</p>
            <p className="text-xs text-text-tertiary">
              {loading ? "Loading change orders..." : `${changeOrders.length} change order${changeOrders.length === 1 ? "" : "s"} on file`}
            </p>
          </div>
          <div className="text-xs text-text-tertiary">
            {visibleCounts.attachments > 0 ? `${visibleCounts.attachments} attachment${visibleCounts.attachments === 1 ? "" : "s"} total` : "No attachments yet"}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            <div className="h-12 animate-pulse rounded-xl bg-surface-overlay" />
            <div className="h-12 animate-pulse rounded-xl bg-surface-overlay" />
            <div className="h-12 animate-pulse rounded-xl bg-surface-overlay" />
          </div>
        ) : changeOrders.length === 0 ? (
          <div className="px-4 py-8 text-sm text-text-tertiary">No change orders logged yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-default text-sm">
              <thead className="bg-surface-overlay/70 text-xs uppercase tracking-wide text-text-tertiary">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">COR #</th>
                  <th className="px-4 py-3 text-left font-semibold">Title</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Requested $</th>
                  <th className="px-4 py-3 text-right font-semibold">Approved $</th>
                  <th className="px-4 py-3 text-center font-semibold">Days</th>
                  <th className="px-4 py-3 text-left font-semibold">Submitted / Updated</th>
                  <th className="px-4 py-3 text-center font-semibold">Attachments</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {changeOrders.map((changeOrder) => {
                  const normalized = normalizeStatus(changeOrder.status);
                  const attachmentsCount = changeOrder.attachments?.length ?? 0;
                  const requestedDays = changeOrder.requested_days ?? 0;
                  const approvedDays = changeOrder.approved_days ?? 0;
                  const submittedDate = changeOrder.submitted_at || changeOrder.updated_at;

                  return (
                    <tr key={changeOrder.id} className="align-top hover:bg-surface-overlay/40">
                      <td className="px-4 py-3 font-medium text-text-primary">{displayChangeOrderNumber(changeOrder)}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="font-medium text-text-primary">{changeOrder.title}</div>
                          <div className="max-w-[30rem] truncate text-xs text-text-tertiary">
                            {changeOrder.reason || changeOrder.description || changeOrder.work_required || "No description provided"}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ChangeOrderStatusBadge status={normalized} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-text-primary">{fmtCurrency(changeOrder.requested_amount ?? changeOrder.amount ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-medium text-text-primary">{fmtCurrency(changeOrder.approved_amount ?? 0)}</td>
                      <td className="px-4 py-3 text-center text-text-secondary">
                        {requestedDays || approvedDays ? `${requestedDays} / ${approvedDays}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        <div className="space-y-1">
                          <div>{formatDate(submittedDate)}</div>
                          <div className="text-xs text-text-tertiary">Updated {formatDate(changeOrder.updated_at)}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-text-secondary">{attachmentsCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(changeOrder)}
                            className="rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setStatusModal({
                                changeOrderId: changeOrder.id,
                                status: normalizeStatus(changeOrder.status),
                                status_reason: changeOrder.status_reason ?? "",
                                superseded_by_change_order_id: changeOrder.superseded_by_change_order_id ?? "",
                                combined_into_change_order_id: changeOrder.combined_into_change_order_id ?? "",
                              })
                            }
                            className="rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
                          >
                            Status
                          </button>
                          <a
                            href={`/reports/change-order/${changeOrder.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-text-inverse transition hover:bg-brand-hover"
                          >
                            Print
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h5 className="font-heading text-base font-semibold text-text-primary">Quick Add</h5>
            <p className="text-sm text-text-secondary">Start with a quick total, then switch to the calculator when you need a detailed estimate.</p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-xl border border-border-default bg-surface-base px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
          >
            Open form
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <StatCard label="Line items on log" value={String(visibleCounts.lineItems)} />
          <StatCard label="Quick total / detailed mix" value={`${changeOrders.filter((item) => item.pricing_mode === "quick_total").length} / ${changeOrders.filter((item) => item.pricing_mode === "detailed").length}`} />
          <StatCard label="Customer-visible attachments" value={String(changeOrders.reduce((acc, order) => acc + (order.attachments?.filter((attachment) => attachment.is_customer_visible).length ?? 0), 0))} />
        </div>
      </div>

      {editorOpen && (
        <DialogShell
          title={editingId ? "Edit Change Order" : "Add Change"}
          description={editingId ? "Update the change order details, pricing, and attachments." : "Create a new project change order with either a quick total or detailed calculator."}
          onClose={closeEditor}
          className="max-w-6xl"
        >
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Title *">
                <Input value={form.title} onChange={(value) => updateField("title", value)} placeholder="Describe the change" />
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(event) => updateField("status", event.target.value as ChangeOrderUiStatus)}
                  className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                >
                  {UI_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reason">
                <Input value={form.reason} onChange={(value) => updateField("reason", value)} placeholder="Why is this change needed?" />
              </Field>
              <Field label="Requested by">
                <Input value={form.requested_by_name} onChange={(value) => updateField("requested_by_name", value)} placeholder="PM, foreman, GC, or customer" />
              </Field>
              <Field label="Customer / GC contact name">
                <Input value={form.customer_contact_name} onChange={(value) => updateField("customer_contact_name", value)} />
              </Field>
              <Field label="Customer / GC contact email">
                <Input type="email" value={form.customer_contact_email} onChange={(value) => updateField("customer_contact_email", value)} />
              </Field>
              <Field label="Source / reference">
                <Input value={form.source} onChange={(value) => updateField("source", value)} placeholder="RFI, field directive, email, etc." />
              </Field>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="What happened">
                <TextArea value={form.what_happened} onChange={(value) => updateField("what_happened", value)} rows={3} placeholder="Short explanation of the issue or request" />
              </Field>
              <Field label="Work required">
                <TextArea value={form.work_required} onChange={(value) => updateField("work_required", value)} rows={3} placeholder="What work needs to happen?" />
              </Field>
              <Field label="Terms note">
                <TextArea value={form.terms_note} onChange={(value) => updateField("terms_note", value)} rows={3} placeholder="Billing or commercial note" />
              </Field>
              <Field label="Internal notes">
                <TextArea value={form.internal_notes} onChange={(value) => updateField("internal_notes", value)} rows={3} placeholder="Internal-only context and backstory" />
              </Field>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Pricing mode">
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "quick_total", label: "Quick Total" },
                    { value: "detailed", label: "Detailed Calculator" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateField("pricing_mode", option.value as ChangeOrderFormState["pricing_mode"])}
                      className={[
                        "rounded-xl border px-4 py-2 text-sm font-medium transition",
                        form.pricing_mode === option.value
                          ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                          : "border-border-default bg-surface-overlay text-text-secondary hover:bg-surface-base hover:text-text-primary",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Requested amount">
                {form.pricing_mode === "quick_total" ? (
                  <Input value={form.requested_amount} onChange={(value) => updateField("requested_amount", value)} placeholder="0.00" />
                ) : (
                  <div className="rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary">
                    {fmtCurrency(detailTotals.total)}
                    <div className="mt-1 text-xs text-text-tertiary">Calculated from line items</div>
                  </div>
                )}
              </Field>
              <Field label="Requested days">
                <Input value={form.requested_days} onChange={(value) => updateField("requested_days", value)} placeholder="0" type="number" />
              </Field>
              <Field label="Approved amount">
                <Input value={form.approved_amount} onChange={(value) => updateField("approved_amount", value)} placeholder="0.00" />
              </Field>
              <Field label="Approved days">
                <Input value={form.approved_days} onChange={(value) => updateField("approved_days", value)} placeholder="0" type="number" />
              </Field>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Submitted date">
                <Input type="date" value={form.submitted_at} onChange={(value) => updateField("submitted_at", value)} />
              </Field>
              <Field label="Approved date">
                <Input type="date" value={form.approved_at} onChange={(value) => updateField("approved_at", value)} />
              </Field>
              <Field label="Executed date">
                <Input type="date" value={form.executed_at} onChange={(value) => updateField("executed_at", value)} />
              </Field>
              <Field label="Billed date">
                <Input type="date" value={form.billed_at} onChange={(value) => updateField("billed_at", value)} />
              </Field>
              <Field label="Paid date">
                <Input type="date" value={form.paid_at} onChange={(value) => updateField("paid_at", value)} />
              </Field>
              <Field label="Voided / rejected / superseded dates">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input type="date" value={form.voided_at} onChange={(value) => updateField("voided_at", value)} />
                  <Input type="date" value={form.rejected_at} onChange={(value) => updateField("rejected_at", value)} />
                  <Input type="date" value={form.superseded_at} onChange={(value) => updateField("superseded_at", value)} />
                </div>
              </Field>
            </div>

            {form.pricing_mode === "detailed" && (
              <div className="space-y-4 rounded-2xl border border-border-default bg-surface-overlay/50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h5 className="font-heading text-base font-semibold text-text-primary">Detailed Calculator</h5>
                    <p className="text-sm text-text-secondary">Line items calculate the requested amount automatically.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-surface-base px-2.5 py-1 text-text-secondary">Labor {fmtCurrency(detailTotals.labor)}</span>
                    <span className="rounded-full bg-surface-base px-2.5 py-1 text-text-secondary">Material {fmtCurrency(detailTotals.material)}</span>
                    <span className="rounded-full bg-surface-base px-2.5 py-1 text-text-secondary">Equipment {fmtCurrency(detailTotals.equipment)}</span>
                    <span className="rounded-full bg-surface-base px-2.5 py-1 text-text-secondary">Sub {fmtCurrency(detailTotals.subcontractor)}</span>
                    <span className="rounded-full bg-surface-base px-2.5 py-1 text-text-secondary">Other {fmtCurrency(detailTotals.other)}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {form.line_items.map((item, index) => (
                    <div key={item.id ?? `line-${index}`} className="rounded-2xl border border-border-default bg-surface-base p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="grid flex-1 gap-3 lg:grid-cols-3">
                          <Field label="Category">
                            <select
                              value={item.category}
                              onChange={(event) => updateLineItem(index, { category: event.target.value as ChangeOrderLineItem["category"] })}
                              className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                            >
                              <option value="labor">Labor</option>
                              <option value="material">Material</option>
                              <option value="equipment">Equipment</option>
                              <option value="subcontractor">Subcontractor</option>
                              <option value="other">Other</option>
                            </select>
                          </Field>
                          <Field label="Description">
                            <Input value={item.description} onChange={(value) => updateLineItem(index, { description: value })} placeholder="What is being added?" />
                          </Field>
                          <Field label="Markup %">
                            <Input value={item.markup_percent} onChange={(value) => updateLineItem(index, { markup_percent: value })} placeholder="0" type="number" />
                          </Field>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                        >
                          Remove
                        </button>
                      </div>

                      {item.category === "labor" && (
                        <div className="mt-4 grid gap-3 md:grid-cols-5">
                          <Field label="Role">
                            <Input value={item.role} onChange={(value) => updateLineItem(index, { role: value })} />
                          </Field>
                          <Field label="People count">
                            <Input value={item.people_count} onChange={(value) => updateLineItem(index, { people_count: value })} type="number" />
                          </Field>
                          <Field label="Hours / person">
                            <Input value={item.hours_per_person} onChange={(value) => updateLineItem(index, { hours_per_person: value })} type="number" />
                          </Field>
                          <Field label="Days">
                            <Input value={item.days} onChange={(value) => updateLineItem(index, { days: value })} type="number" />
                          </Field>
                          <Field label="Hourly rate">
                            <Input value={item.hourly_rate} onChange={(value) => updateLineItem(index, { hourly_rate: value })} type="number" />
                          </Field>
                        </div>
                      )}

                      {item.category === "material" && (
                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <Field label="Quantity">
                            <Input value={item.quantity} onChange={(value) => updateLineItem(index, { quantity: value })} type="number" />
                          </Field>
                          <Field label="Unit">
                            <Input value={item.unit} onChange={(value) => updateLineItem(index, { unit: value })} />
                          </Field>
                          <Field label="Unit cost">
                            <Input value={item.unit_cost} onChange={(value) => updateLineItem(index, { unit_cost: value })} type="number" />
                          </Field>
                          <Field label="Total preview">
                            <div className="rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary">
                              {fmtCurrency(lineItemBaseAmount(item))}
                            </div>
                          </Field>
                        </div>
                      )}

                      {item.category !== "labor" && item.category !== "material" && (
                        <div className="mt-4 grid gap-3 md:grid-cols-5">
                          <Field label="Description">
                            <Input value={item.description} onChange={(value) => updateLineItem(index, { description: value })} />
                          </Field>
                          <Field label="Quantity">
                            <Input value={item.quantity} onChange={(value) => updateLineItem(index, { quantity: value })} type="number" />
                          </Field>
                          <Field label="Unit cost">
                            <Input value={item.unit_cost} onChange={(value) => updateLineItem(index, { unit_cost: value })} type="number" />
                          </Field>
                          <Field label="Lump sum">
                            <Input value={item.lump_sum} onChange={(value) => updateLineItem(index, { lump_sum: value })} type="number" />
                          </Field>
                          <Field label="Total preview">
                            <div className="rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary">
                              {fmtCurrency(lineItemBaseAmount(item))}
                            </div>
                          </Field>
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="rounded-xl border border-dashed border-border-default px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
                  >
                    + Add line item
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4 rounded-2xl border border-border-default bg-surface-overlay/50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h5 className="font-heading text-base font-semibold text-text-primary">Attachments metadata</h5>
                  <p className="text-sm text-text-secondary">Metadata only for V1. Use notes/description for support details.</p>
                </div>
                <button
                  type="button"
                  onClick={addAttachment}
                  className="rounded-xl border border-border-default bg-surface-base px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-raised hover:text-text-primary"
                >
                  + Add attachment
                </button>
              </div>

              {form.attachments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border-default bg-surface-base px-4 py-5 text-sm text-text-secondary">
                  No attachment metadata added yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {form.attachments.map((attachment, index) => (
                    <div key={attachment.id ?? `attachment-${index}`} className="rounded-2xl border border-border-default bg-surface-base p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">Attachment {index + 1}</p>
                          <p className="text-xs text-text-tertiary">Metadata for the report and project log</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <Field label="Kind">
                          <select
                            value={attachment.attachment_kind}
                            onChange={(event) => updateAttachment(index, { attachment_kind: event.target.value as ChangeOrderAttachmentKind })}
                            className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                          >
                            <option value="backup">Backup</option>
                            <option value="supporting">Supporting</option>
                            <option value="photo">Photo</option>
                            <option value="pdf">PDF</option>
                            <option value="signed">Signed</option>
                            <option value="customer">Customer</option>
                          </select>
                        </Field>
                        <Field label="File name">
                          <Input value={attachment.file_name} onChange={(value) => updateAttachment(index, { file_name: value })} />
                        </Field>
                        <Field label="Notes">
                          <Input value={attachment.description} onChange={(value) => updateAttachment(index, { description: value })} placeholder="Support notes or context" />
                        </Field>
                        <Field label="Title">
                          <Input value={attachment.title} onChange={(value) => updateAttachment(index, { title: value })} />
                        </Field>
                        <Field label="Storage URL">
                          <Input value={attachment.storage_web_url} onChange={(value) => updateAttachment(index, { storage_web_url: value })} placeholder="Optional web link" />
                        </Field>
                        <Field label="Storage path">
                          <Input value={attachment.storage_path} onChange={(value) => updateAttachment(index, { storage_path: value })} placeholder="Optional drive path" />
                        </Field>
                        <Field label="Storage provider">
                          <Input value={attachment.storage_provider} onChange={(value) => updateAttachment(index, { storage_provider: value })} placeholder="onedrive" />
                        </Field>
                        <Field label="File size bytes">
                          <Input value={attachment.file_size_bytes} onChange={(value) => updateAttachment(index, { file_size_bytes: value })} type="number" />
                        </Field>
                        <Field label="Customer visible">
                          <label className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary">
                            <input
                              type="checkbox"
                              checked={attachment.is_customer_visible}
                              onChange={(event) => updateAttachment(index, { is_customer_visible: event.target.checked })}
                              className="h-4 w-4 rounded border-border-default text-brand-primary focus:ring-brand-primary"
                            />
                            Visible to customer
                          </label>
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h5 className="font-heading text-base font-semibold text-text-primary">Status helper</h5>
                  <p className="text-sm text-text-secondary">
                    Use the quick status modal for submitted, approved, rejected, voided, superseded, executed, billed, or paid changes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    editingId
                      ? setStatusModal({
                          changeOrderId: editingId,
                          status: form.status,
                          status_reason: form.status_reason,
                          superseded_by_change_order_id: form.superseded_by_change_order_id,
                          combined_into_change_order_id: form.combined_into_change_order_id,
                        })
                      : undefined
                  }
                  disabled={!editingId}
                  className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
                >
                  Open quick status
                </button>
              </div>
            </div>

            {editorErrorBlock(error)}

            <div className="flex flex-col-reverse gap-3 border-t border-border-default pt-4 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveForm()}
                disabled={saving}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : editingId ? "Save Change Order" : "Create Change Order"}
              </button>
            </div>
          </div>
        </DialogShell>
      )}

      {statusModal && (
        <DialogShell
          title="Quick Status Update"
          description="Move this change order to its next PM-friendly status."
          onClose={() => setStatusModal(null)}
          className="max-w-3xl"
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Status">
                <select
                  value={statusModal.status}
                  onChange={(event) => setStatusModal((current) => current ? { ...current, status: event.target.value as ChangeOrderUiStatus } : current)}
                  className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                >
                  {QUICK_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reason">
                <TextArea
                  value={statusModal.status_reason}
                  onChange={(value) => setStatusModal((current) => current ? { ...current, status_reason: value } : current)}
                  rows={3}
                  placeholder="Required for rejected, voided, and superseded"
                />
              </Field>
            </div>

            {statusModal.status === "superseded" && (
              <Field label="Superseded by">
                <select
                  value={statusModal.superseded_by_change_order_id}
                  onChange={(event) => setStatusModal((current) => current ? { ...current, superseded_by_change_order_id: event.target.value } : current)}
                  className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                >
                  <option value="">Select a change order</option>
                  {changeOrders
                    .filter((changeOrder) => changeOrder.id !== statusModal.changeOrderId)
                    .map((changeOrder) => (
                      <option key={changeOrder.id} value={changeOrder.id}>
                        {displayChangeOrderNumber(changeOrder)} - {changeOrder.title}
                      </option>
                    ))}
                </select>
              </Field>
            )}

            <Field label="Combined into change order">
              <select
                value={statusModal.combined_into_change_order_id}
                onChange={(event) => setStatusModal((current) => current ? { ...current, combined_into_change_order_id: event.target.value } : current)}
                className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              >
                <option value="">None</option>
                {changeOrders
                  .filter((changeOrder) => changeOrder.id !== statusModal.changeOrderId)
                  .map((changeOrder) => (
                    <option key={changeOrder.id} value={changeOrder.id}>
                      {displayChangeOrderNumber(changeOrder)} - {changeOrder.title}
                    </option>
                  ))}
              </select>
            </Field>

            <div className="rounded-xl border border-border-default bg-surface-overlay px-4 py-3 text-sm text-text-secondary">
              Voided and superseded records stay in the log. No COR number is reused.
            </div>

            {editorErrorBlock(error)}

            <div className="flex flex-col-reverse gap-3 border-t border-border-default pt-4 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => setStatusModal(null)}
                className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveStatus()}
                disabled={saving}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Updating..." : "Update Status"}
              </button>
            </div>
          </div>
        </DialogShell>
      )}
    </section>
  );
}

function editorErrorBlock(message: string | null) {
  if (!message) return null;

  return (
    <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
      {message}
    </div>
  );
}

function emptySummary(): SummaryCards {
  return {
    approved_total: 0,
    open_pending_requested_total: 0,
    active_requested_total: 0,
    executed_total: 0,
    billed_total: 0,
    paid_total: 0,
    counts_by_status: Object.fromEntries(STATUS_ORDER.map((status) => [status, 0])) as Record<ChangeOrderUiStatus, number>,
  };
}

function toSummaryCards(
  summary:
    | {
        count: number;
        requested_amount: number;
        approved_amount: number;
        requested_days: number;
        approved_days: number;
        status_counts: Record<ChangeOrderUiStatus, number>;
        status_requested_amounts: Record<ChangeOrderUiStatus, number>;
        status_approved_amounts: Record<ChangeOrderUiStatus, number>;
      }
    | undefined,
  changeOrders: ChangeOrder[]
): SummaryCards {
  if (!summary) {
    const base = emptySummary();
    for (const changeOrder of changeOrders) {
      const status = normalizeStatus(changeOrder.status);
      base.counts_by_status[status] += 1;
      if (["draft", "needs_pricing", "ready_to_submit", "submitted", "in_review"].includes(status)) {
        base.open_pending_requested_total += changeOrder.requested_amount ?? changeOrder.amount ?? 0;
      }
      if (["draft", "needs_pricing", "ready_to_submit", "submitted", "in_review", "approved", "executed", "billed", "paid"].includes(status)) {
        base.active_requested_total += changeOrder.requested_amount ?? changeOrder.amount ?? 0;
      }
      if (["approved", "executed", "billed", "paid"].includes(status)) {
        base.approved_total += changeOrder.approved_amount ?? 0;
      }
      if (status === "executed") base.executed_total += changeOrder.approved_amount ?? 0;
      if (status === "billed") base.billed_total += changeOrder.approved_amount ?? 0;
      if (status === "paid") base.paid_total += changeOrder.approved_amount ?? 0;
    }
    return base;
  }

  return {
    approved_total: summary.status_approved_amounts.approved + summary.status_approved_amounts.executed + summary.status_approved_amounts.billed + summary.status_approved_amounts.paid,
    open_pending_requested_total:
      summary.status_requested_amounts.draft +
      summary.status_requested_amounts.needs_pricing +
      summary.status_requested_amounts.ready_to_submit +
      summary.status_requested_amounts.submitted +
      summary.status_requested_amounts.in_review,
    active_requested_total:
      summary.status_requested_amounts.draft +
      summary.status_requested_amounts.needs_pricing +
      summary.status_requested_amounts.ready_to_submit +
      summary.status_requested_amounts.submitted +
      summary.status_requested_amounts.in_review +
      summary.status_requested_amounts.approved +
      summary.status_requested_amounts.executed +
      summary.status_requested_amounts.billed +
      summary.status_requested_amounts.paid,
    executed_total: summary.status_approved_amounts.executed,
    billed_total: summary.status_approved_amounts.billed,
    paid_total: summary.status_approved_amounts.paid,
    counts_by_status: summary.status_counts,
  };
}
