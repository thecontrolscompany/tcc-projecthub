"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { BomItem, BomStatus, MaterialReceipt } from "@/types/database";
import { safeJson } from "@/lib/utils/safe-json";

interface BomTabProps {
  projectId: string;
  readOnly?: boolean;
  allowReceiptEditing?: boolean;
}

type ReceiptWithProfile = MaterialReceipt & {
  profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
};

const EMPTY_ITEM_FORM = {
  section: "General",
  designation: "",
  code_number: "",
  description: "",
  qty_required: "0",
  unit_cost: "",
  notes: "",
};

const EMPTY_RECEIPT_FORM = {
  date_received: new Date().toISOString().slice(0, 10),
  qty_received: "0",
  packing_slip: "",
  notes: "",
};

const INPUT_CLASS =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none";

const STATUS_LABEL: Record<BomStatus, string> = {
  not_received: "Missing",
  partial: "Partial",
  received: "Received",
  surplus: "Surplus",
};

const STATUS_CLASS: Record<BomStatus, string> = {
  not_received: "bg-status-danger/10 text-status-danger",
  partial: "bg-status-warning/10 text-status-warning",
  received: "bg-status-success/10 text-status-success",
  surplus: "bg-[#fef3c7]/60 text-status-warning",
};

const ROW_CLASS: Record<BomStatus, string> = {
  not_received: "bg-status-danger/5",
  partial: "bg-status-warning/5",
  received: "bg-status-success/5",
  surplus: "bg-[#fef3c7]/50",
};

function computeBomStatus(item: BomItem, receipts: MaterialReceipt[]): BomItem {
  const itemReceipts = receipts.filter((receipt) => receipt.bom_item_id === item.id);
  const qtyReceived = itemReceipts.reduce((sum, receipt) => sum + receipt.qty_received, 0);
  const remainSurplus = qtyReceived - item.qty_required;

  let status: BomStatus;
  if (qtyReceived === 0) status = "not_received";
  else if (qtyReceived < item.qty_required) status = "partial";
  else if (qtyReceived === item.qty_required) status = "received";
  else status = "surplus";

  return { ...item, qty_received: qtyReceived, remain_surplus: remainSurplus, status };
}

function formatUnitCost(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRemain(value: number) {
  if (value === 0) return "0";
  if (value > 0) return `+${value}`;
  return String(value);
}

function remainClass(value: number) {
  if (value < 0) return "text-status-danger";
  if (value > 0) return "text-status-warning";
  return "text-text-tertiary";
}

function formatReceiptUser(receipt: ReceiptWithProfile) {
  return receipt.profile?.full_name || receipt.profile?.email || receipt.received_by || "-";
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={["h-4 w-4 transition-transform", expanded ? "rotate-90" : ""].join(" ")}
      aria-hidden="true"
    >
      <path d="m7 4 6 6-6 6" />
    </svg>
  );
}

function SummaryCard({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: string;
  accent?: "default" | "success" | "danger" | "warning";
}) {
  const valueClass =
    accent === "success"
      ? "text-status-success"
      : accent === "danger"
        ? "text-status-danger"
        : accent === "warning"
          ? "text-status-warning"
          : "text-text-primary";

  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

function BomItemForm({
  form,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  form: typeof EMPTY_ITEM_FORM;
  onChange: (next: typeof EMPTY_ITEM_FORM) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.1fr,1fr,1fr,2fr,100px,100px,1.2fr]">
      <Field label="Section">
        <input value={form.section} onChange={(event) => onChange({ ...form, section: event.target.value })} className={INPUT_CLASS} />
      </Field>
      <Field label="Designation">
        <input value={form.designation} onChange={(event) => onChange({ ...form, designation: event.target.value })} className={INPUT_CLASS} />
      </Field>
      <Field label="Code Number">
        <input value={form.code_number} onChange={(event) => onChange({ ...form, code_number: event.target.value })} className={INPUT_CLASS} />
      </Field>
      <Field label="Description">
        <input value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} className={INPUT_CLASS} />
      </Field>
      <Field label="Total Qty">
        <input type="number" min="0" value={form.qty_required} onChange={(event) => onChange({ ...form, qty_required: event.target.value })} className={INPUT_CLASS} />
      </Field>
      <Field label="Unit Cost">
        <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(event) => onChange({ ...form, unit_cost: event.target.value })} className={INPUT_CLASS} placeholder="$0.00" />
      </Field>
      <Field label="Notes">
        <input value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} className={INPUT_CLASS} />
      </Field>
      <div className="md:col-span-2 xl:col-span-7 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-secondary transition hover:bg-surface-base">
          Cancel
        </button>
        <button type="button" onClick={onSave} disabled={saving} className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse disabled:opacity-60">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

export function BomTab({ projectId, readOnly = false, allowReceiptEditing = false }: BomTabProps) {
  const [items, setItems] = useState<BomItem[]>([]);
  const [receipts, setReceipts] = useState<ReceiptWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [editForm, setEditForm] = useState(EMPTY_ITEM_FORM);
  const [receiptForms, setReceiptForms] = useState<Record<string, typeof EMPTY_RECEIPT_FORM>>({});
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [editingReceiptForm, setEditingReceiptForm] = useState(EMPTY_RECEIPT_FORM);
  const canEditStructure = !readOnly;
  const canEditReceipts = !readOnly || allowReceiptEditing;

  useEffect(() => {
    void loadBom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function loadBom() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/bom?projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      const json = await safeJson(response);
      if (!response.ok) throw new Error(json?.error ?? "Failed to load BOM.");

      setItems((json?.items as BomItem[]) ?? []);
      setReceipts((json?.receipts as ReceiptWithProfile[]) ?? []);
    } catch (loadError) {
      setItems([]);
      setReceipts([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load BOM.");
    } finally {
      setLoading(false);
    }
  }

  const computedItems = useMemo(() => items.map((item) => computeBomStatus(item, receipts)), [items, receipts]);

  const sections = useMemo(() => {
    return Array.from(new Set(computedItems.map((item) => item.section || "General"))).sort((a, b) => a.localeCompare(b));
  }, [computedItems]);

  const filteredItems = useMemo(() => {
    return computedItems.filter((item) => {
      if (showMissingOnly && !["not_received", "partial"].includes(item.status ?? "")) return false;
      if (sectionFilter !== "all" && item.section !== sectionFilter) return false;
      if (!search.trim()) return true;

      const query = search.trim().toLowerCase();
      return (
        (item.designation ?? "").toLowerCase().includes(query) ||
        (item.code_number ?? "").toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        (item.notes ?? "").toLowerCase().includes(query)
      );
    });
  }, [computedItems, search, sectionFilter, showMissingOnly]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, BomItem[]>();
    for (const item of filteredItems) {
      const key = item.section || "General";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(item);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredItems]);

  const totalItems = computedItems.length;
  const fullyReceivedCount = computedItems.filter((item) => item.status === "received").length;
  const stillNeededCount = computedItems.filter((item) => item.status === "not_received" || item.status === "partial").length;
  const surplusCount = computedItems.filter((item) => item.status === "surplus").length;
  const fullyReceivedPct = totalItems > 0 ? (fullyReceivedCount / totalItems) * 100 : 0;

  function resetAddForm(section = "General") {
    setAddingSection(section);
    setItemForm({ ...EMPTY_ITEM_FORM, section });
    setEditingItemId(null);
  }

  function resetReceiptForm(itemId: string) {
    setReceiptForms((current) => ({
      ...current,
      [itemId]: { ...EMPTY_RECEIPT_FORM, date_received: new Date().toISOString().slice(0, 10) },
    }));
  }

  function beginEditReceipt(receipt: ReceiptWithProfile) {
    setEditingReceiptId(receipt.id);
    setEditingReceiptForm({
      date_received: receipt.date_received || new Date().toISOString().slice(0, 10),
      qty_received: String(receipt.qty_received ?? 0),
      packing_slip: receipt.packing_slip ?? "",
      notes: receipt.notes ?? "",
    });
  }

  function cancelEditReceipt() {
    setEditingReceiptId(null);
    setEditingReceiptForm(EMPTY_RECEIPT_FORM);
  }

  async function handleCreateItem() {
    if (!itemForm.section.trim() || !itemForm.description.trim()) {
      setError("Section and description are required.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const sectionItems = items.filter((item) => item.section === itemForm.section.trim());
      const nextSortOrder =
        sectionItems.length > 0 ? Math.max(...sectionItems.map((item) => item.sort_order)) + 1 : items.length;

      const response = await fetch("/api/admin/bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          project_id: projectId,
          section: itemForm.section.trim(),
          designation: itemForm.designation,
          code_number: itemForm.code_number,
          description: itemForm.description,
          qty_required: Number(itemForm.qty_required || 0),
          unit_cost: itemForm.unit_cost === "" ? null : Number(itemForm.unit_cost),
          notes: itemForm.notes,
          sort_order: nextSortOrder,
        }),
      });
      const json = await safeJson(response);
      if (!response.ok) throw new Error(json?.error ?? "Failed to add BOM item.");

      setItems((current) => [...current, json.item as BomItem]);
      setAddingSection(null);
      setItemForm(EMPTY_ITEM_FORM);
      setStatusMessage("BOM item added.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to add BOM item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(itemId: string) {
    if (!editForm.section.trim() || !editForm.description.trim()) {
      setError("Section and description are required.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/bom", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: itemId,
          section: editForm.section.trim(),
          designation: editForm.designation,
          code_number: editForm.code_number,
          description: editForm.description,
          qty_required: Number(editForm.qty_required || 0),
          unit_cost: editForm.unit_cost === "" ? null : Number(editForm.unit_cost),
          notes: editForm.notes,
        }),
      });
      const json = await safeJson(response);
      if (!response.ok) throw new Error(json?.error ?? "Failed to save BOM item.");

      setItems((current) => current.map((item) => (item.id === itemId ? (json.item as BomItem) : item)));
      setEditingItemId(null);
      setStatusMessage("BOM item updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save BOM item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!window.confirm("Delete this BOM item and all receipt history?")) return;

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/bom", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: itemId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error ?? "Failed to delete BOM item.");

      setItems((current) => current.filter((item) => item.id !== itemId));
      setReceipts((current) => current.filter((receipt) => receipt.bom_item_id !== itemId));
      if (expandedItemId === itemId) setExpandedItemId(null);
      setStatusMessage("BOM item deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete BOM item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddReceipt(itemId: string) {
    const form = receiptForms[itemId] ?? EMPTY_RECEIPT_FORM;
    if (Number(form.qty_received || 0) <= 0) {
      setError("Receipt quantity must be greater than 0.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/bom?action=receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bom_item_id: itemId,
          qty_received: Number(form.qty_received || 0),
          date_received: form.date_received || new Date().toISOString().slice(0, 10),
          packing_slip: form.packing_slip,
          notes: form.notes,
        }),
      });
      const json = await safeJson(response);
      if (!response.ok) throw new Error(json?.error ?? "Failed to add receipt.");

      setReceipts((current) => [json.receipt as ReceiptWithProfile, ...current]);
      resetReceiptForm(itemId);
      setStatusMessage("Receipt logged.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to add receipt.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveReceiptEdit(receiptId: string) {
    if (Number(editingReceiptForm.qty_received || 0) <= 0) {
      setError("Receipt quantity must be greater than 0.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/bom?action=receipt", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: receiptId,
          qty_received: Number(editingReceiptForm.qty_received || 0),
          date_received: editingReceiptForm.date_received || new Date().toISOString().slice(0, 10),
          packing_slip: editingReceiptForm.packing_slip,
          notes: editingReceiptForm.notes,
        }),
      });
      const json = await safeJson(response);
      if (!response.ok) throw new Error(json?.error ?? "Failed to update receipt.");

      setReceipts((current) => current.map((receipt) => (receipt.id === receiptId ? (json.receipt as ReceiptWithProfile) : receipt)));
      cancelEditReceipt();
      setStatusMessage("Receipt updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update receipt.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteReceipt(receiptId: string) {
    if (!window.confirm("Delete this receipt entry?")) return;

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/bom?action=receipt", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: receiptId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error ?? "Failed to delete receipt.");

      setReceipts((current) => current.filter((receipt) => receipt.id !== receiptId));
      setStatusMessage("Receipt removed.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete receipt.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearAll() {
    if (!window.confirm("Delete ALL BOM items and receipt history for this project? This cannot be undone.")) return;

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/bom?action=clear-all", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error ?? "Failed to clear BOM.");

      setItems([]);
      setReceipts([]);
      setExpandedItemId(null);
      setEditingItemId(null);
      setAddingSection(null);
      setStatusMessage("BOM cleared.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear BOM.");
    } finally {
      setSaving(false);
    }
  }

  async function handleImport(file: File) {
    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("file", file);

      const response = await fetch("/api/admin/bom/import", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = await safeJson(response);
      if (!response.ok) throw new Error(json?.error ?? "Failed to import BOM.");

      await loadBom();
      setStatusMessage(`Imported ${json.imported ?? 0} BOM rows. Skipped ${json.skipped ?? 0}.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Failed to import BOM.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Total Line Items" value={String(totalItems)} />
        <SummaryCard label="% Fully Received" value={`${fullyReceivedPct.toFixed(0)}%`} accent="success" />
        <SummaryCard label="Still Needed" value={String(stillNeededCount)} accent={stillNeededCount > 0 ? "danger" : "default"} />
        <SummaryCard label="Surplus" value={String(surplusCount)} accent="warning" />
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary">
          <input type="checkbox" checked={showMissingOnly} onChange={(event) => setShowMissingOnly(event.target.checked)} className="h-4 w-4 accent-[var(--color-brand-primary)]" />
          Show Missing Only
        </label>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search designation, code number, or description"
          className="min-w-[240px] flex-1 rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
        />
        <select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)} className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none">
          <option value="all">All Sections</option>
          {sections.map((section) => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
        </select>
        {canEditStructure && (
          <>
            <button type="button" onClick={() => resetAddForm("General")} className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-surface-base">
              + Add Section
            </button>
            <a
              href={`/api/admin/bom/template?projectId=${encodeURIComponent(projectId)}`}
              download
              className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-surface-base"
            >
              {items.length > 0 ? "Export BOM" : "Download Template"}
            </a>
            <label className="cursor-pointer rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-surface-base">
              Import from Excel
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImport(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => void handleClearAll()}
                disabled={saving}
                className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-2.5 text-sm font-medium text-status-danger transition hover:bg-status-danger/20 disabled:opacity-50"
              >
                Clear All
              </button>
            )}
          </>
        )}
      </div>

      {statusMessage && <div className="rounded-xl border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">{statusMessage}</div>}
      {error && <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">{error}</div>}

      {loading ? (
        <div className="py-10 text-center text-text-tertiary">Loading materials...</div>
      ) : groupedItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-default px-6 py-10 text-center text-sm text-text-secondary">
          No BOM items match the current filters.
        </div>
      ) : (
        <>
        {/* ── Mobile card layout (< sm) ───────────────────────────── */}
        <div className="sm:hidden divide-y divide-border-default overflow-hidden rounded-2xl border border-border-default">
          {groupedItems.map(([section, sectionItems]) => (
            <Fragment key={section}>
              <div className="bg-brand-primary/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">
                {section}
              </div>
              {sectionItems.map((item) => {
                const mobileReceipts = receipts.filter((r) => r.bom_item_id === item.id).sort((a, b) => b.date_received.localeCompare(a.date_received));
                const mobileExpanded = expandedItemId === item.id;
                const mobileReceiptForm = receiptForms[item.id] ?? EMPTY_RECEIPT_FORM;
                return (
                  <Fragment key={item.id}>
                    {editingItemId === item.id ? (
                      <div className="bg-surface-base p-4">
                        <BomItemForm form={editForm} onChange={setEditForm} onCancel={() => setEditingItemId(null)} onSave={() => void handleSaveEdit(item.id)} saving={saving} />
                      </div>
                    ) : (
                      <div className={["p-4", ROW_CLASS[item.status ?? "not_received"]].join(" ")}>
                        <p className="font-medium text-text-primary">{item.description}</p>
                        {formatUnitCost(item.unit_cost) && <p className="mt-1 text-xs text-text-tertiary">Unit Cost: {formatUnitCost(item.unit_cost)}</p>}
                        {item.notes && <p className="mt-1 text-xs text-text-tertiary">{item.notes}</p>}
                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {item.designation && (
                            <>
                              <dt className="text-text-tertiary">Designation</dt>
                              <dd className="text-text-secondary">{item.designation}</dd>
                            </>
                          )}
                          {item.code_number && (
                            <>
                              <dt className="text-text-tertiary">Code #</dt>
                              <dd className="text-text-secondary">{item.code_number}</dd>
                            </>
                          )}
                          <dt className="text-text-tertiary">Total Qty</dt>
                          <dd className="text-text-secondary">{item.qty_required}</dd>
                          <dt className="text-text-tertiary">Qty Rec&apos;d</dt>
                          <dd className="text-text-secondary">{item.qty_received ?? 0}</dd>
                          <dt className="text-text-tertiary">Remain</dt>
                          <dd className={`font-medium ${remainClass(item.remain_surplus ?? 0)}`}>{formatRemain(item.remain_surplus ?? 0)}</dd>
                        </dl>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className={["inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_CLASS[item.status ?? "not_received"]].join(" ")}>
                            {STATUS_LABEL[item.status ?? "not_received"]}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedItemId((c) => (c === item.id ? null : item.id));
                              if (!receiptForms[item.id]) resetReceiptForm(item.id);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-base"
                            aria-expanded={mobileExpanded}
                          >
                            {mobileExpanded ? "Hide Receipts" : "View/Add Receipts"}
                            <ChevronIcon expanded={mobileExpanded} />
                          </button>
                          {canEditStructure && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItemId(item.id);
                                  setAddingSection(null);
                                  setEditForm({ section: item.section, designation: item.designation ?? "", code_number: item.code_number ?? "", description: item.description, qty_required: String(item.qty_required), unit_cost: item.unit_cost != null ? String(item.unit_cost) : "", notes: item.notes ?? "" });
                                }}
                                className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-base"
                              >Edit</button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteItem(item.id)}
                                className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-1.5 text-xs font-medium text-status-danger transition hover:bg-status-danger/20"
                              >Delete</button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    {mobileExpanded && (
                      <div className="border-t border-border-default bg-surface-base px-4 py-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Receipt Log</p>
                            <button type="button" onClick={() => setExpandedItemId(null)} className="text-xs font-medium text-text-tertiary transition hover:text-text-primary">Close</button>
                          </div>
                          {mobileReceipts.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border-default px-4 py-5 text-sm text-text-secondary">No receipts logged yet.</div>
                          ) : (
                            <div className="divide-y divide-border-default rounded-xl border border-border-default">
                              {mobileReceipts.map((receipt) => (
                                <div key={receipt.id} className="px-3 py-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="space-y-0.5 text-xs">
                                      <p className="font-semibold text-text-primary">Qty: {receipt.qty_received}</p>
                                      <p className="text-text-tertiary">Received: {format(new Date(receipt.date_received), "MMM d, yyyy")}</p>
                                      {receipt.packing_slip && <p className="text-text-tertiary">Slip: {receipt.packing_slip}</p>}
                                      <p className="text-text-tertiary">By: {formatReceiptUser(receipt)}</p>
                                      {receipt.notes && <p className="text-text-tertiary">Notes: {receipt.notes}</p>}
                                    </div>
                                    {canEditReceipts && (
                                      <div className="flex shrink-0 gap-2">
                                        <button type="button" onClick={() => beginEditReceipt(receipt)} className="rounded-lg border border-border-default bg-surface-overlay px-2.5 py-1 text-xs font-medium text-text-secondary">Edit</button>
                                        <button type="button" onClick={() => void handleDeleteReceipt(receipt.id)} className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-2.5 py-1 text-xs font-medium text-status-danger">Delete</button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {canEditReceipts && editingReceiptId && mobileReceipts.some((r) => r.id === editingReceiptId) && (
                            <div className="rounded-xl border border-border-default bg-surface-raised p-4">
                              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Edit Receipt</p>
                              <div className="grid grid-cols-2 gap-3">
                                <Field label="Date"><input type="date" value={editingReceiptForm.date_received} onChange={(e) => setEditingReceiptForm((c) => ({ ...c, date_received: e.target.value }))} className={INPUT_CLASS} /></Field>
                                <Field label="Qty"><input type="number" min="0" value={editingReceiptForm.qty_received} onChange={(e) => setEditingReceiptForm((c) => ({ ...c, qty_received: e.target.value }))} className={INPUT_CLASS} /></Field>
                                <Field label="Packing Slip"><input value={editingReceiptForm.packing_slip} onChange={(e) => setEditingReceiptForm((c) => ({ ...c, packing_slip: e.target.value }))} className={INPUT_CLASS} /></Field>
                                <Field label="Notes"><input value={editingReceiptForm.notes} onChange={(e) => setEditingReceiptForm((c) => ({ ...c, notes: e.target.value }))} className={INPUT_CLASS} /></Field>
                              </div>
                              <div className="mt-3 flex gap-2">
                                <button type="button" onClick={() => void handleSaveReceiptEdit(editingReceiptId)} disabled={saving} className="flex-1 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-text-inverse disabled:opacity-60">Save</button>
                                <button type="button" onClick={cancelEditReceipt} className="rounded-lg border border-border-default bg-surface-overlay px-4 py-2.5 text-sm font-semibold text-text-secondary">Cancel</button>
                              </div>
                            </div>
                          )}
                          {canEditReceipts && (
                            <div className="rounded-xl border border-border-default bg-surface-raised p-4">
                              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Add Receipt</p>
                              <div className="grid grid-cols-2 gap-3">
                                <Field label="Date"><input type="date" value={mobileReceiptForm.date_received} onChange={(e) => setReceiptForms((c) => ({ ...c, [item.id]: { ...(c[item.id] ?? EMPTY_RECEIPT_FORM), date_received: e.target.value } }))} className={INPUT_CLASS} /></Field>
                                <Field label="Qty"><input type="number" min="0" value={mobileReceiptForm.qty_received} onChange={(e) => setReceiptForms((c) => ({ ...c, [item.id]: { ...(c[item.id] ?? EMPTY_RECEIPT_FORM), qty_received: e.target.value } }))} className={INPUT_CLASS} /></Field>
                                <Field label="Packing Slip"><input value={mobileReceiptForm.packing_slip} onChange={(e) => setReceiptForms((c) => ({ ...c, [item.id]: { ...(c[item.id] ?? EMPTY_RECEIPT_FORM), packing_slip: e.target.value } }))} className={INPUT_CLASS} /></Field>
                                <Field label="Notes"><input value={mobileReceiptForm.notes} onChange={(e) => setReceiptForms((c) => ({ ...c, [item.id]: { ...(c[item.id] ?? EMPTY_RECEIPT_FORM), notes: e.target.value } }))} className={INPUT_CLASS} /></Field>
                              </div>
                              <button type="button" onClick={() => void handleAddReceipt(item.id)} disabled={saving} className="mt-3 w-full rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-text-inverse disabled:opacity-60">
                                Add Receipt
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Fragment>
                );
              })}
              {canEditStructure && (
                <div className="border-t border-border-default bg-surface-base px-4 py-3">
                  {addingSection === section ? (
                    <BomItemForm form={itemForm} onChange={setItemForm} onCancel={() => { setAddingSection(null); setItemForm(EMPTY_ITEM_FORM); }} onSave={() => void handleCreateItem()} saving={saving} />
                  ) : (
                    <button type="button" onClick={() => resetAddForm(section)} className="text-sm font-medium text-brand-primary transition hover:text-brand-hover">+ Add Item</button>
                  )}
                </div>
              )}
            </Fragment>
          ))}
        </div>

        {/* ── Desktop table layout (sm+) ───────────────────────────── */}
        <div className="hidden sm:block overflow-hidden rounded-2xl border border-border-default">
          <div>
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-border-default bg-surface-raised/80">
                  <th className="w-[12%] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Receipts</th>
                  <th className="w-[12%] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Designation</th>
                  <th className="w-[16%] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Code Number</th>
                  <th className="w-[22%] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Description</th>
                  <th className="w-[10%] px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Total Qty</th>
                  <th className="w-[10%] px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Qty Rec&apos;d</th>
                  <th className="w-[10%] px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Remain/Surplus</th>
                  <th className="w-[10%] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                  {canEditStructure && <th className="w-[14%] px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {groupedItems.map(([section, sectionItems]) => (
                  <Fragment key={section}>
                    <tr className="bg-brand-primary/10">
                      <td colSpan={canEditStructure ? 8 : 7} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">
                        {section}
                      </td>
                    </tr>
                    {sectionItems.map((item) => {
                      const itemReceipts = receipts.filter((receipt) => receipt.bom_item_id === item.id).sort((a, b) => b.date_received.localeCompare(a.date_received));
                      const isExpanded = expandedItemId === item.id;
                      const receiptForm = receiptForms[item.id] ?? EMPTY_RECEIPT_FORM;

                      return (
                        <Fragment key={item.id}>
                          {editingItemId === item.id ? (
                            <tr className="border-b border-border-default bg-surface-base">
                              <td colSpan={canEditStructure ? 8 : 7} className="px-4 py-4">
                                <BomItemForm form={editForm} onChange={setEditForm} onCancel={() => setEditingItemId(null)} onSave={() => void handleSaveEdit(item.id)} saving={saving} />
                              </td>
                            </tr>
                          ) : (
                            <tr
                              className={["border-b border-border-default align-top transition hover:bg-surface-overlay/40", ROW_CLASS[item.status ?? "not_received"]].join(" ")}
                            >
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedItemId((current) => (current === item.id ? null : item.id));
                                    if (!receiptForms[item.id]) resetReceiptForm(item.id);
                                  }}
                                  className="inline-flex w-full items-center justify-between rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-left text-xs font-semibold text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
                                  aria-expanded={isExpanded}
                                  aria-label={isExpanded ? "Hide receipt log" : "View receipt log"}
                                >
                                  <span>{isExpanded ? "Hide Receipts" : "View/Add Receipts"}</span>
                                  <ChevronIcon expanded={isExpanded} />
                                </button>
                              </td>
                              <td className="break-words px-4 py-3 text-text-primary">{item.designation || "-"}</td>
                              <td className="break-words px-4 py-3 text-text-secondary">{item.code_number || "-"}</td>
                              <td className="px-4 py-3 text-text-primary">
                                <div className="break-words font-medium">{item.description}</div>
                                {formatUnitCost(item.unit_cost) && <div className="mt-1 text-xs text-text-tertiary">Unit Cost: {formatUnitCost(item.unit_cost)}</div>}
                                {item.notes && <div className="mt-1 text-xs text-text-tertiary">{item.notes}</div>}
                                <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                                  Use &quot;View/Add Receipts&quot; to log or edit deliveries
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-text-secondary">{item.qty_required}</td>
                              <td className="px-4 py-3 text-right text-text-secondary">{item.qty_received ?? 0}</td>
                              <td className={`px-4 py-3 text-right font-medium ${remainClass(item.remain_surplus ?? 0)}`}>{formatRemain(item.remain_surplus ?? 0)}</td>
                              <td className="px-4 py-3">
                                <span className={["inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_CLASS[item.status ?? "not_received"]].join(" ")}>
                                  {STATUS_LABEL[item.status ?? "not_received"]}
                                </span>
                              </td>
                              {canEditStructure && (
                                <td className="px-4 py-3 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setEditingItemId(item.id);
                                        setAddingSection(null);
                                        setEditForm({
                                          section: item.section,
                                          designation: item.designation ?? "",
                                          code_number: item.code_number ?? "",
                                          description: item.description,
                                          qty_required: String(item.qty_required),
                                          unit_cost: item.unit_cost != null ? String(item.unit_cost) : "",
                                          notes: item.notes ?? "",
                                        });
                                      }}
                                      className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void handleDeleteItem(item.id);
                                      }}
                                      className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-1.5 text-xs font-medium text-status-danger transition hover:bg-status-danger/20"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          )}
                          {isExpanded && (
                            <tr className="border-b border-border-default bg-surface-base">
                              <td colSpan={canEditStructure ? 8 : 7} className="px-4 py-4">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Receipt Log</p>
                                    <button type="button" onClick={() => setExpandedItemId(null)} className="text-xs font-medium text-text-tertiary transition hover:text-text-primary">
                                      Close
                                    </button>
                                  </div>

                                  {itemReceipts.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-border-default px-4 py-5 text-sm text-text-secondary">
                                      No receipts logged for this item yet.
                                    </div>
                                  ) : (
                                    <div className="rounded-xl border border-border-default">
                                      <table className="w-full table-fixed text-sm">
                                        <thead>
                                          <tr className="border-b border-border-default bg-surface-overlay/60">
                                            <th className="w-[14%] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Received</th>
                                            <th className="w-[14%] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Logged</th>
                                            <th className="w-[10%] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Qty</th>
                                            <th className="w-[18%] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Packing Slip</th>
                                            <th className="w-[16%] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Received By</th>
                                            <th className="w-[18%] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Notes</th>
                                            {canEditReceipts && <th className="w-[10%] px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Actions</th>}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {itemReceipts.map((receipt) => (
                                            <tr key={receipt.id} className="border-b border-border-default last:border-0">
                                              <td className="px-3 py-2 text-text-secondary">{format(new Date(receipt.date_received), "MMM d, yyyy")}</td>
                                              <td className="px-3 py-2 text-text-secondary">{format(new Date(receipt.created_at), "MMM d, yyyy")}</td>
                                              <td className="px-3 py-2 text-text-primary">{receipt.qty_received}</td>
                                              <td className="break-words px-3 py-2 text-text-secondary">{receipt.packing_slip || "-"}</td>
                                              <td className="break-words px-3 py-2 text-text-secondary">{formatReceiptUser(receipt)}</td>
                                              <td className="break-words px-3 py-2 text-text-secondary">{receipt.notes || "-"}</td>
                                              {canEditReceipts && (
                                                <td className="px-3 py-2 text-right">
                                                  <div className="flex justify-end gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() => beginEditReceipt(receipt)}
                                                      className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
                                                    >
                                                      Edit
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => void handleDeleteReceipt(receipt.id)}
                                                      className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-1.5 text-xs font-medium text-status-danger transition hover:bg-status-danger/20"
                                                    >
                                                      Delete
                                                    </button>
                                                  </div>
                                                </td>
                                              )}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}

                                  {canEditReceipts && editingReceiptId && itemReceipts.some((receipt) => receipt.id === editingReceiptId) && (
                                    <div className="rounded-xl border border-border-default bg-surface-raised p-4">
                                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Edit Receipt</p>
                                      <div className="grid gap-3 md:grid-cols-[150px,120px,1fr,1fr,160px]">
                                        <Field label="Date">
                                          <input
                                            type="date"
                                            value={editingReceiptForm.date_received}
                                            onChange={(event) => setEditingReceiptForm((current) => ({ ...current, date_received: event.target.value }))}
                                            className={INPUT_CLASS}
                                          />
                                        </Field>
                                        <Field label="Qty">
                                          <input
                                            type="number"
                                            min="0"
                                            value={editingReceiptForm.qty_received}
                                            onChange={(event) => setEditingReceiptForm((current) => ({ ...current, qty_received: event.target.value }))}
                                            className={INPUT_CLASS}
                                          />
                                        </Field>
                                        <Field label="Packing Slip">
                                          <input
                                            value={editingReceiptForm.packing_slip}
                                            onChange={(event) => setEditingReceiptForm((current) => ({ ...current, packing_slip: event.target.value }))}
                                            className={INPUT_CLASS}
                                          />
                                        </Field>
                                        <Field label="Notes">
                                          <input
                                            value={editingReceiptForm.notes}
                                            onChange={(event) => setEditingReceiptForm((current) => ({ ...current, notes: event.target.value }))}
                                            className={INPUT_CLASS}
                                          />
                                        </Field>
                                        <div className="flex items-end gap-2">
                                          <button type="button" onClick={() => void handleSaveReceiptEdit(editingReceiptId)} disabled={saving} className="flex-1 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-text-inverse disabled:opacity-60">
                                            Save
                                          </button>
                                          <button type="button" onClick={cancelEditReceipt} className="rounded-lg border border-border-default bg-surface-overlay px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:bg-surface-base">
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {canEditReceipts && (
                                    <div className="rounded-xl border border-border-default bg-surface-raised p-4">
                                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Add Receipt</p>
                                      <div className="grid gap-3 md:grid-cols-[150px,120px,1fr,1fr,110px]">
                                        <Field label="Date">
                                          <input
                                            type="date"
                                            value={receiptForm.date_received}
                                            onChange={(event) =>
                                              setReceiptForms((current) => ({
                                                ...current,
                                                [item.id]: { ...(current[item.id] ?? EMPTY_RECEIPT_FORM), date_received: event.target.value },
                                              }))
                                            }
                                            className={INPUT_CLASS}
                                          />
                                        </Field>
                                        <Field label="Qty">
                                          <input
                                            type="number"
                                            min="0"
                                            value={receiptForm.qty_received}
                                            onChange={(event) =>
                                              setReceiptForms((current) => ({
                                                ...current,
                                                [item.id]: { ...(current[item.id] ?? EMPTY_RECEIPT_FORM), qty_received: event.target.value },
                                              }))
                                            }
                                            className={INPUT_CLASS}
                                          />
                                        </Field>
                                        <Field label="Packing Slip">
                                          <input
                                            value={receiptForm.packing_slip}
                                            onChange={(event) =>
                                              setReceiptForms((current) => ({
                                                ...current,
                                                [item.id]: { ...(current[item.id] ?? EMPTY_RECEIPT_FORM), packing_slip: event.target.value },
                                              }))
                                            }
                                            className={INPUT_CLASS}
                                          />
                                        </Field>
                                        <Field label="Notes">
                                          <input
                                            value={receiptForm.notes}
                                            onChange={(event) =>
                                              setReceiptForms((current) => ({
                                                ...current,
                                                [item.id]: { ...(current[item.id] ?? EMPTY_RECEIPT_FORM), notes: event.target.value },
                                              }))
                                            }
                                            className={INPUT_CLASS}
                                          />
                                        </Field>
                                        <div className="flex items-end">
                                          <button type="button" onClick={() => void handleAddReceipt(item.id)} disabled={saving} className="w-full rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-text-inverse disabled:opacity-60">
                                            Add
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {canEditStructure && (
                      <tr className="border-b border-border-default bg-surface-base last:border-0">
                        <td colSpan={9} className="px-4 py-3">
                          {addingSection === section ? (
                            <BomItemForm
                              form={itemForm}
                              onChange={setItemForm}
                              onCancel={() => {
                                setAddingSection(null);
                                setItemForm(EMPTY_ITEM_FORM);
                              }}
                              onSave={() => void handleCreateItem()}
                              saving={saving}
                            />
                          ) : (
                            <button type="button" onClick={() => resetAddForm(section)} className="text-sm font-medium text-brand-primary transition hover:text-brand-hover">
                              + Add Item
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {canEditStructure && groupedItems.length === 0 && (
        <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
          <button type="button" onClick={() => resetAddForm("General")} className="text-sm font-medium text-brand-primary transition hover:text-brand-hover">
            + Add First Item
          </button>
        </div>
      )}
    </div>
  );
}
