"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { WipItem, WipPriority, WipStatus } from "@/types/database";

interface WipTabProps {
  projectId: string;
  readOnly?: boolean;
}

const EMPTY_FORM = {
  system_area: "",
  task: "",
  status: "not_started" as WipStatus,
  assigned_to: "",
  responsible_co: "TCC",
  blocker: "",
  priority: "medium" as WipPriority,
  due_date: "",
  notes: "",
};

const STATUS_LABELS: Record<WipStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  blocked: "Blocked",
  in_review: "In Review",
  complete: "Complete",
};

const STATUS_STYLES: Record<WipStatus, string> = {
  not_started: "bg-surface-overlay text-text-secondary",
  in_progress: "bg-status-info/10 text-status-info",
  blocked: "bg-status-danger/10 text-status-danger",
  in_review: "bg-status-warning/10 text-status-warning",
  complete: "bg-status-success/10 text-status-success",
};

export function WipTab({ projectId, readOnly = false }: WipTabProps) {
  const [items, setItems] = useState<WipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [collapsedAreas, setCollapsedAreas] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/wip?projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to load WIP items.");
      }
      setItems((json?.items as WipItem[]) ?? []);
    } catch (loadError) {
      setItems([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load WIP items.");
    } finally {
      setLoading(false);
    }
  }

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (readOnly && item.status === "complete") return false;
      if (blockedOnly && item.status !== "blocked") return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!search.trim()) return true;

      const query = search.trim().toLowerCase();
      return (
        item.task.toLowerCase().includes(query) ||
        item.system_area.toLowerCase().includes(query) ||
        (item.blocker ?? "").toLowerCase().includes(query)
      );
    });
  }, [blockedOnly, items, readOnly, search, statusFilter]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, WipItem[]>();
    for (const item of visibleItems) {
      const key = item.system_area;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(item);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleItems]);

  const hotItems = items.filter((item) => item.status === "blocked" && item.priority === "high");
  const totalItems = items.length;
  const blockedCount = items.filter((item) => item.status === "blocked").length;
  const inProgressCount = items.filter((item) => item.status === "in_progress").length;
  const completeCount = items.filter((item) => item.status === "complete").length;

  function toggleArea(area: string) {
    setCollapsedAreas((current) => ({ ...current, [area]: !current[area] }));
  }

  async function handleAdd() {
    if (!form.system_area.trim() || !form.task.trim()) {
      setError("System/area and task are required.");
      return;
    }
    if (form.status === "blocked" && !form.blocker.trim()) {
      setError("Blocker is required when status is blocked.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/wip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          project_id: projectId,
          ...form,
          sort_order: items.length,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to add WIP item.");
      }
      setItems((current) => [...current, json.item as WipItem]);
      setForm(EMPTY_FORM);
      setShowAddForm(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to add WIP item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editDraft.system_area.trim() || !editDraft.task.trim()) {
      setError("System/area and task are required.");
      return;
    }
    if (editDraft.status === "blocked" && !editDraft.blocker.trim()) {
      setError("Blocker is required when status is blocked.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/wip", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id,
          ...editDraft,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to save WIP item.");
      }
      setItems((current) => current.map((item) => (item.id === id ? json.item as WipItem : item)));
      setEditingId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save WIP item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Delete this WIP item?");
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/wip", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to delete WIP item.");
      }
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete WIP item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Total Items" value={String(totalItems)} />
        <SummaryCard label="Blocked" value={String(blockedCount)} accent={blockedCount > 0 ? "danger" : "default"} />
        <SummaryCard label="In Progress" value={String(inProgressCount)} accent="info" />
        <SummaryCard label="Complete" value={String(completeCount)} accent="success" />
      </div>

      {hotItems.length > 0 && (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-status-danger">
            Needs Attention ({hotItems.length})
          </p>
          {hotItems.map((item) => (
            <div key={item.id} className="mb-1 flex items-start justify-between gap-3 text-sm">
              <span className="font-medium text-text-primary">{item.system_area} - {item.task}</span>
              <span className="shrink-0 text-xs text-status-danger">{item.blocker}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search task, area, or blocker"
          className="flex-1 rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="in_review">In Review</option>
          <option value="complete">Complete</option>
        </select>
        <label className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={blockedOnly}
            onChange={(event) => setBlockedOnly(event.target.checked)}
            className="h-4 w-4 accent-[var(--color-brand-primary)]"
          />
          Show blocked only
        </label>
      </div>

      {error && (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-text-tertiary">Loading WIP items...</div>
      ) : groupedItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-default px-6 py-10 text-center text-sm text-text-secondary">
          No WIP items match the current filters.
        </div>
      ) : (
        groupedItems.map(([area, areaItems]) => (
          <div key={area} className="overflow-hidden rounded-2xl border border-border-default">
            <button
              type="button"
              onClick={() => toggleArea(area)}
              className="flex w-full items-center justify-between bg-surface-raised px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-text-primary">{area}</p>
                <p className="text-xs text-text-tertiary">{areaItems.length} item{areaItems.length === 1 ? "" : "s"}</p>
              </div>
              <span className="text-xs text-text-tertiary">{collapsedAreas[area] ? "Show" : "Hide"}</span>
            </button>

            {!collapsedAreas[area] && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-overlay/60">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Task</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Assigned To</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Responsible</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Blocker</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Priority</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Due Date</th>
                      {!readOnly && <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {areaItems.map((item) =>
                      editingId === item.id ? (
                        <tr key={item.id} className="border-b border-border-default bg-surface-base align-top">
                          <td colSpan={readOnly ? 7 : 8} className="px-4 py-4">
                            <WipItemForm
                              form={editDraft}
                              onChange={setEditDraft}
                              onCancel={() => setEditingId(null)}
                              onSave={() => void handleSaveEdit(item.id)}
                              saving={saving}
                            />
                          </td>
                        </tr>
                      ) : (
                        <tr key={item.id} className="border-b border-border-default align-top hover:bg-surface-raised">
                          <td className="px-4 py-3 text-text-primary">
                            <div className="font-medium">{item.task}</div>
                            {item.notes && <div className="mt-1 text-xs text-text-tertiary">{item.notes}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}>
                              {STATUS_LABELS[item.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-text-secondary">{item.assigned_to || "-"}</td>
                          <td className="px-4 py-3 text-text-secondary">{item.responsible_co || "-"}</td>
                          <td className="px-4 py-3 text-text-secondary">{item.blocker || "-"}</td>
                          <td className="px-4 py-3 text-text-secondary capitalize">{item.priority}</td>
                          <td className="px-4 py-3 text-text-secondary">{item.due_date ? format(new Date(item.due_date), "MMM d, yyyy") : "-"}</td>
                          {!readOnly && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(item.id);
                                    setEditDraft({
                                      system_area: item.system_area,
                                      task: item.task,
                                      status: item.status,
                                      assigned_to: item.assigned_to ?? "",
                                      responsible_co: item.responsible_co ?? "TCC",
                                      blocker: item.blocker ?? "",
                                      priority: item.priority,
                                      due_date: item.due_date ?? "",
                                      notes: item.notes ?? "",
                                    });
                                  }}
                                  className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDelete(item.id)}
                                  className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-1.5 text-xs font-medium text-status-danger transition hover:bg-status-danger/20"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}

      {!readOnly && (
        <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="text-sm font-medium text-brand-primary transition hover:text-brand-hover"
            >
              + Add Item
            </button>
          ) : (
            <WipItemForm
              form={form}
              onChange={setForm}
              onCancel={() => {
                setShowAddForm(false);
                setForm(EMPTY_FORM);
              }}
              onSave={() => void handleAdd()}
              saving={saving}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: string;
  accent?: "default" | "danger" | "info" | "success";
}) {
  const valueClass =
    accent === "danger"
      ? "text-status-danger"
      : accent === "info"
        ? "text-status-info"
        : accent === "success"
          ? "text-status-success"
          : "text-text-primary";

  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function WipItemForm({
  form,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  form: typeof EMPTY_FORM;
  onChange: (next: typeof EMPTY_FORM) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="System/Area">
        <input value={form.system_area} onChange={(e) => onChange({ ...form, system_area: e.target.value })} className={INPUT_CLASS} />
      </Field>
      <Field label="Task">
        <input value={form.task} onChange={(e) => onChange({ ...form, task: e.target.value })} className={INPUT_CLASS} />
      </Field>
      <Field label="Status">
        <select value={form.status} onChange={(e) => onChange({ ...form, status: e.target.value as WipStatus })} className={INPUT_CLASS}>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="in_review">In Review</option>
          <option value="complete">Complete</option>
        </select>
      </Field>
      <Field label="Priority">
        <select value={form.priority} onChange={(e) => onChange({ ...form, priority: e.target.value as WipPriority })} className={INPUT_CLASS}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </Field>
      <Field label="Assigned To">
        <input value={form.assigned_to} onChange={(e) => onChange({ ...form, assigned_to: e.target.value })} className={INPUT_CLASS} />
      </Field>
      <Field label="Responsible">
        <select value={form.responsible_co} onChange={(e) => onChange({ ...form, responsible_co: e.target.value })} className={INPUT_CLASS}>
          <option value="TCC">TCC</option>
          <option value="Mechanical">Mechanical</option>
          <option value="Controls Vendor">Controls Vendor</option>
          <option value="GC">GC</option>
          <option value="Other">Other</option>
        </select>
      </Field>
      {form.status === "blocked" && (
        <Field label="Blocker">
          <input value={form.blocker} onChange={(e) => onChange({ ...form, blocker: e.target.value })} className={INPUT_CLASS} />
        </Field>
      )}
      <Field label="Due Date">
        <input type="date" value={form.due_date} onChange={(e) => onChange({ ...form, due_date: e.target.value })} className={INPUT_CLASS} />
      </Field>
      <div className="md:col-span-2">
        <Field label="Notes">
          <input value={form.notes} onChange={(e) => onChange({ ...form, notes: e.target.value })} className={INPUT_CLASS} />
        </Field>
      </div>
      <div className="md:col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-secondary">
          Cancel
        </button>
        <button type="button" onClick={onSave} disabled={saving} className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse disabled:opacity-60">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
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

const INPUT_CLASS =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none";
