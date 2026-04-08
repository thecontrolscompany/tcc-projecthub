"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeOrder, ChangeOrderStatus } from "@/types/database";
import { fmtCurrency } from "@/lib/utils/format";

export function ChangeOrdersSection({ projectId }: { projectId: string }) {
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [coLoading, setCoLoading] = useState(false);
  const [showCoForm, setShowCoForm] = useState(false);
  const [coForm, setCoForm] = useState({
    coNumber: "",
    title: "",
    description: "",
    amount: "",
    status: "pending" as ChangeOrderStatus,
    submittedDate: "",
    approvedDate: "",
    referenceDoc: "",
    notes: "",
  });
  const [coSaving, setCoSaving] = useState(false);
  const [coError, setCoError] = useState<string | null>(null);

  useEffect(() => {
    async function loadChangeOrders() {
      setCoLoading(true);
      setCoError(null);
      try {
        const res = await fetch(`/api/admin/change-orders?projectId=${encodeURIComponent(projectId)}`, {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "Failed to load change orders.");
        }
        setChangeOrders((json?.changeOrders as ChangeOrder[] | undefined) ?? []);
      } catch (error) {
        setChangeOrders([]);
        setCoError(error instanceof Error ? error.message : "Failed to load change orders.");
      } finally {
        setCoLoading(false);
      }
    }

    void loadChangeOrders();
  }, [projectId]);

  const approvedTotal = useMemo(
    () => changeOrders.filter((co) => co.status === "approved").reduce((sum, co) => sum + co.amount, 0),
    [changeOrders]
  );
  const pendingTotal = useMemo(
    () => changeOrders.filter((co) => co.status === "pending").reduce((sum, co) => sum + co.amount, 0),
    [changeOrders]
  );

  async function handleAddCo() {
    if (!coForm.title.trim()) {
      setCoError("Title is required.");
      return;
    }

    setCoSaving(true);
    setCoError(null);

    const res = await fetch("/api/admin/change-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        projectId,
        coNumber: coForm.coNumber.trim() || undefined,
        title: coForm.title.trim(),
        description: coForm.description.trim() || undefined,
        amount: Number(coForm.amount) || 0,
        status: coForm.status,
        submittedDate: coForm.submittedDate || undefined,
        approvedDate: coForm.approvedDate || undefined,
        referenceDoc: coForm.referenceDoc.trim() || undefined,
        notes: coForm.notes.trim() || undefined,
      }),
    });

    const json = await res.json().catch(() => ({}));
    setCoSaving(false);

    if (!res.ok) {
      setCoError(json?.error ?? "Failed to save.");
      return;
    }

    setChangeOrders((prev) => [...prev, json.changeOrder as ChangeOrder]);
    setShowCoForm(false);
    setCoForm({
      coNumber: "",
      title: "",
      description: "",
      amount: "",
      status: "pending",
      submittedDate: "",
      approvedDate: "",
      referenceDoc: "",
      notes: "",
    });
  }

  async function handleVoidCo(id: string) {
    const res = await fetch("/api/admin/change-orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });

    if (res.ok) {
      setChangeOrders((prev) => prev.map((co) => (co.id === id ? { ...co, status: "void" } : co)));
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-heading text-lg font-semibold text-text-primary">Change Orders</h4>
        <button
          type="button"
          onClick={() => setShowCoForm((value) => !value)}
          className="rounded-lg bg-brand-primary/10 px-3 py-1.5 text-xs font-medium text-brand-primary hover:bg-brand-primary/20"
        >
          + Add CO
        </button>
      </div>

      {changeOrders.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-status-success/10 px-2.5 py-1 font-medium text-status-success">
            Approved: {fmtCurrency(approvedTotal)}
          </span>
          <span className="rounded-full bg-status-warning/10 px-2.5 py-1 font-medium text-status-warning">
            Pending: {fmtCurrency(pendingTotal)}
          </span>
        </div>
      )}

      {coLoading ? (
        <p className="text-sm text-text-tertiary">Loading change orders...</p>
      ) : (
        <div className="space-y-2">
          {changeOrders.filter((co) => co.status !== "void").map((co) => (
            <div
              key={co.id}
              className="flex items-center justify-between rounded-xl border border-border-default bg-surface-raised px-4 py-2.5 text-sm"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{co.co_number}</span>
                  <span className="text-text-secondary">-</span>
                  <span className="text-text-primary">{co.title}</span>
                  <StatusBadge status={co.status} />
                </div>
                {co.reference_doc && (
                  <p className="text-xs text-text-tertiary">Ref: {co.reference_doc}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={["font-semibold", co.amount >= 0 ? "text-status-success" : "text-status-danger"].join(" ")}>
                  {co.amount >= 0 ? "+" : ""}
                  {fmtCurrency(co.amount)}
                </span>
                <a
                  href={`/reports/change-order/${co.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-primary hover:underline"
                >
                  View/Print
                </a>
                <button
                  type="button"
                  onClick={() => void handleVoidCo(co.id)}
                  className="text-xs text-text-tertiary hover:text-status-danger"
                >
                  Void
                </button>
              </div>
            </div>
          ))}

          {!coLoading && changeOrders.filter((co) => co.status !== "void").length === 0 && (
            <p className="text-sm text-text-tertiary">No change orders logged yet.</p>
          )}
        </div>
      )}

      {showCoForm && (
        <div className="space-y-3 rounded-xl border border-border-default bg-surface-overlay p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">CO Number</label>
              <input
                type="text"
                value={coForm.coNumber}
                onChange={(e) => setCoForm((current) => ({ ...current, coNumber: e.target.value }))}
                placeholder="PCO-001"
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Status</label>
              <select
                value={coForm.status}
                onChange={(e) => setCoForm((current) => ({ ...current, status: e.target.value as ChangeOrderStatus }))}
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Title</label>
            <input
              type="text"
              value={coForm.title}
              onChange={(e) => setCoForm((current) => ({ ...current, title: e.target.value }))}
              placeholder="Brief description of the change"
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Description</label>
            <textarea
              value={coForm.description}
              onChange={(e) => setCoForm((current) => ({ ...current, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Amount ($)</label>
              <input
                type="number"
                value={coForm.amount}
                onChange={(e) => setCoForm((current) => ({ ...current, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Reference (RFI#, PO#, etc.)</label>
              <input
                type="text"
                value={coForm.referenceDoc}
                onChange={(e) => setCoForm((current) => ({ ...current, referenceDoc: e.target.value }))}
                placeholder="Optional"
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Submitted Date</label>
              <input
                type="date"
                value={coForm.submittedDate}
                onChange={(e) => setCoForm((current) => ({ ...current, submittedDate: e.target.value }))}
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Approved Date</label>
              <input
                type="date"
                value={coForm.approvedDate}
                onChange={(e) => setCoForm((current) => ({ ...current, approvedDate: e.target.value }))}
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Notes</label>
            <textarea
              value={coForm.notes}
              onChange={(e) => setCoForm((current) => ({ ...current, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </div>
          {coError && <p className="text-xs text-status-danger">{coError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCoForm(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-raised"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleAddCo()}
              disabled={coSaving}
              className="rounded-lg bg-brand-primary px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {coSaving ? "Saving..." : "Save CO"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function StatusBadge({ status }: { status: ChangeOrderStatus }) {
  const styles: Record<ChangeOrderStatus, string> = {
    pending: "bg-status-warning/10 text-status-warning",
    approved: "bg-status-success/10 text-status-success",
    rejected: "bg-status-danger/10 text-status-danger",
    void: "bg-surface-overlay text-text-tertiary",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}
