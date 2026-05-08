"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { calcEstimate, calcItem, COMPS_MAP, TYPE_META } from "@/modules/hvac-estimator/components/estimate/estimateCalc";
import { AddEquipButtons } from "@/modules/hvac-estimator/components/estimate/AddEquipButtons";
import { ProjectSettingsPanel } from "@/modules/hvac-estimator/components/estimate/ProjectSettingsPanel";
import { computeCosts, DEFAULT_SETTINGS } from "@/modules/hvac-estimator/components/estimate/projectSettings";
import { summarizeHvacEstimate, type HvacEstimateBody } from "@/modules/hvac-estimator/platform-adapter";
import type { EstimateRecord, EstimateStatus } from "@/types/database";

type Props = {
  estimate: EstimateRecord;
};

type EstimateItem = {
  id: string;
  type: string;
  tag: string;
  location: string;
  qty: number;
  installType: "EMT" | "Plenum";
  selected: Array<{ id: string; qty: number }>;
  custom: Array<Record<string, unknown>>;
  priceSnap: Record<string, unknown>;
  cfg: Record<string, unknown>;
};

type EstimateBody = Omit<HvacEstimateBody, "items"> & {
  items: EstimateItem[];
  platformContext?: Record<string, unknown> | null;
};

type AddItemForm = {
  type: string;
  tag: string;
  location: string;
  qty: string;
  installType: "EMT" | "Plenum";
  selectedIds: string[];
};

type HvacComponent = {
  id: string;
  label?: string;
  name?: string;
  groupId?: string;
};

const statusOptions: EstimateStatus[] = [
  "draft",
  "in_progress",
  "ready",
  "proposal_exported",
  "awarded",
  "archived",
];

const supportedEquipmentTypes = ["ahu", "vav", "rtu", "dx", "vrf", "fcu", "uh", "network"];

const inputClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

const labelClassName = "mb-1 block text-xs font-medium uppercase tracking-wide text-text-tertiary";

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown, fallback = 1) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getTypeMeta(type: string) {
  return (TYPE_META as Record<string, { label: string; color: string; bg: string }>)[type] ?? {
    label: type.toUpperCase(),
    color: "currentColor",
    bg: "transparent",
  };
}

function getComponents(type: string) {
  const value = (COMPS_MAP as Record<string, HvacComponent[] | undefined>)[type];
  return Array.isArray(value) ? value : [];
}

function getComponentLabel(component: HvacComponent) {
  return component.label ?? component.name ?? component.id;
}

function normalizeBody(record: EstimateRecord): EstimateBody {
  const body = record.body as Partial<EstimateBody>;
  return {
    id: asString(body.id) || record.id,
    organizationId: asString(body.organizationId) || record.organization_id,
    linkedOpportunityId: asString(body.linkedOpportunityId) || record.linked_opportunity_id,
    linkedProjectId: asString(body.linkedProjectId) || record.linked_project_id,
    platformContext: body.platformContext ?? null,
    name: asString(body.name) || record.name || "Untitled Estimate",
    number: asString(body.number) || record.number || "",
    customerAccountId: asString(body.customerAccountId) || null,
    customer: asString(body.customer),
    version: asString(body.version) || "1.0",
    notes: asString(body.notes),
    settings: { ...DEFAULT_SETTINGS, ...(body.settings ?? {}) },
    createdAt: asString(body.createdAt) || record.created_at,
    updatedAt: asString(body.updatedAt) || record.updated_at,
    createdBy: body.createdBy ?? null,
    updatedBy: body.updatedBy ?? null,
    items: Array.isArray(body.items) ? (body.items as EstimateItem[]) : [],
  };
}

function buildAddForm(type = "ahu"): AddItemForm {
  const meta = getTypeMeta(type);
  return {
    type,
    tag: `${meta.label}-1`,
    location: "",
    qty: "1",
    installType: "EMT",
    selectedIds: [],
  };
}

function renumberDefaultTag(type: string, items: EstimateItem[]) {
  const meta = getTypeMeta(type);
  const count = items.filter((item) => item.type === type).length + 1;
  return `${meta.label}-${count}`;
}

function buildItemFromForm(form: AddItemForm): EstimateItem {
  return {
    id: crypto.randomUUID(),
    type: form.type,
    tag: form.tag.trim() || `${getTypeMeta(form.type).label}-1`,
    location: form.location.trim(),
    qty: Math.max(1, Number.parseInt(form.qty, 10) || 1),
    installType: form.installType,
    selected: form.selectedIds.map((id) => ({ id, qty: 1 })),
    custom: [],
    priceSnap: {},
    cfg: {},
  };
}

export function EstimateDetailClient({ estimate }: Props) {
  const [body, setBody] = useState<EstimateBody>(() => normalizeBody(estimate));
  const [status, setStatus] = useState<EstimateStatus>(estimate.status);
  const [addForm, setAddForm] = useState<AddItemForm>(() => buildAddForm());
  const [showAddEditor, setShowAddEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingComponentsFor, setEditingComponentsFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const opportunityNumber = asString(body.platformContext?.opportunityNumber);
  const rawTotals = useMemo(() => calcEstimate(body) as { mtl: number; lbrHrs: number }, [body]);
  const costs = useMemo(
    () =>
      computeCosts(rawTotals.mtl, rawTotals.lbrHrs, body.settings, body.items) as {
        labor: number;
        material: number;
        overhead: number;
        profit: number;
        bond: number;
        total: number;
      },
    [body, rawTotals.lbrHrs, rawTotals.mtl],
  );

  const addFormComponents = getComponents(addForm.type);

  function updateBody(patch: Partial<EstimateBody>) {
    setBody((current) => ({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
    setDirty(true);
    setMessage(null);
    setError(null);
  }

  function setAddType(type: string) {
    setAddForm(() => ({
      ...buildAddForm(type),
      tag: renumberDefaultTag(type, body.items),
    }));
  }

  function toggleSelectedComponent(componentId: string) {
    setAddForm((current) => {
      const selected = new Set(current.selectedIds);
      if (selected.has(componentId)) selected.delete(componentId);
      else selected.add(componentId);
      return { ...current, selectedIds: Array.from(selected) };
    });
  }

  function handleAddItem() {
    const item = buildItemFromForm(addForm);
    updateBody({ items: [...body.items, item] });
    setAddForm({
      ...buildAddForm(addForm.type),
      tag: renumberDefaultTag(addForm.type, [...body.items, item]),
      installType: addForm.installType,
    });
  }

  function updateItem(itemId: string, patch: Partial<EstimateItem>) {
    updateBody({
      items: body.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    });
  }

  function updateSettings(patch: Record<string, unknown>) {
    updateBody({
      settings: {
        ...body.settings,
        ...patch,
      },
    });
  }

  function toggleItemComponent(itemId: string, componentId: string) {
    updateBody({
      items: body.items.map((item) => {
        if (item.id !== itemId) return item;
        const exists = item.selected.some((component) => component.id === componentId);
        return {
          ...item,
          selected: exists
            ? item.selected.filter((component) => component.id !== componentId)
            : [...item.selected, { id: componentId, qty: 1 }],
        };
      }),
    });
  }

  function updateItemComponentQty(itemId: string, componentId: string, qty: number) {
    updateBody({
      items: body.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              selected: item.selected.map((component) =>
                component.id === componentId ? { ...component, qty: Math.max(1, qty) } : component,
              ),
            }
          : item,
      ),
    });
  }

  function applyDefaultInstallTypeToItems() {
    const installType = body.settings.defaultInstallType === "Plenum" ? "Plenum" : "EMT";
    updateBody({
      items: body.items.map((item) => ({ ...item, installType })),
    });
  }

  function removeItem(itemId: string) {
    updateBody({ items: body.items.filter((item) => item.id !== itemId) });
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);

    const nextBody = {
      ...body,
      updatedAt: new Date().toISOString(),
    };
    const summary = summarizeHvacEstimate(nextBody);

    try {
      const res = await fetch(`/api/estimates/${estimate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          archived: status === "archived",
          body: nextBody,
          total_amount: summary.totalAmount,
          gross_margin_amount: summary.grossMarginAmount,
          gross_margin_pct: summary.grossMarginPct,
        }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : "Unable to save estimate.");
        return;
      }

      setBody(nextBody);
      setDirty(false);
      setMessage("Estimate saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/estimating" className="text-sm text-text-tertiary hover:text-text-primary">
            Back to Estimating
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">{body.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {body.number || estimate.id}
            {body.customer ? ` · ${body.customer}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : dirty ? "Save Changes" : "Save"}
          </button>
          <a
            href="https://estimates.thecontrolscompany.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-border-default px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
          >
            Standalone Tool
          </a>
        </div>
      </div>

      {(message || error) && (
        <div
          className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
            error
              ? "border-status-danger/30 bg-status-danger/10 text-status-danger"
              : "border-status-success/30 bg-status-success/10 text-status-success"
          }`}
        >
          {error ?? message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Estimate Summary</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Platform-native pricing using the migrated HVAC Estimator cost model.
                </p>
              </div>
              <span className="rounded-full bg-surface-overlay px-3 py-1 text-xs font-medium text-text-secondary">
                {status.replace(/_/g, " ")}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-5">
              <SummaryMetric label="Material" value={formatCurrency(costs.material)} />
              <SummaryMetric label="Labor" value={formatCurrency(costs.labor)} />
              <SummaryMetric label="Overhead" value={formatCurrency(costs.overhead)} />
              <SummaryMetric label="Profit" value={formatCurrency(costs.profit)} />
              <SummaryMetric label="Sell Price" value={formatCurrency(costs.total)} emphasized />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Project Settings</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Old estimator settings panel, now backed by ProjectHub estimate persistence.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSettings((current) => !current)}
                className="rounded-xl border border-border-default px-3 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
              >
                {showSettings ? "Hide Settings" : "Show Settings"}
              </button>
            </div>
            {showSettings && (
              <ProjectSettingsPanel
                settings={body.settings}
                onChange={updateSettings}
                costs={costs}
                rawLbrHrs={rawTotals.lbrHrs}
                itemCount={body.items.length}
                estimateId={estimate.id}
                onApplyDefaultInstallType={applyDefaultInstallTypeToItems}
              />
            )}
          </section>

          <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Add Equipment</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Old estimator equipment buttons with a platform-native item editor.
                </p>
              </div>
              <div className="text-sm text-text-tertiary">{body.items.length} line items</div>
            </div>

            <AddEquipButtons
              onAdd={(type: string) => {
                setAddType(type);
                setShowAddEditor(true);
              }}
            />

            {showAddEditor && (
              <div className="mt-4 border-t border-border-default pt-4">

            <div className="grid gap-3 md:grid-cols-5">
              <label>
                <span className={labelClassName}>Type</span>
                <select value={addForm.type} onChange={(event) => setAddType(event.target.value)} className={inputClassName}>
                  {supportedEquipmentTypes.map((type) => (
                    <option key={type} value={type}>
                      {getTypeMeta(type).label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClassName}>Tag</span>
                <input
                  value={addForm.tag}
                  onChange={(event) => setAddForm((current) => ({ ...current, tag: event.target.value }))}
                  className={inputClassName}
                />
              </label>
              <label>
                <span className={labelClassName}>Location</span>
                <input
                  value={addForm.location}
                  onChange={(event) => setAddForm((current) => ({ ...current, location: event.target.value }))}
                  className={inputClassName}
                />
              </label>
              <label>
                <span className={labelClassName}>Qty</span>
                <input
                  type="number"
                  min="1"
                  value={addForm.qty}
                  onChange={(event) => setAddForm((current) => ({ ...current, qty: event.target.value }))}
                  className={inputClassName}
                />
              </label>
              <label>
                <span className={labelClassName}>Install</span>
                <select
                  value={addForm.installType}
                  onChange={(event) =>
                    setAddForm((current) => ({ ...current, installType: event.target.value as "EMT" | "Plenum" }))
                  }
                  className={inputClassName}
                >
                  <option value="EMT">EMT</option>
                  <option value="Plenum">Plenum</option>
                </select>
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-border-default bg-surface-overlay p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-text-primary">Components</div>
                <div className="text-xs text-text-tertiary">{addForm.selectedIds.length} selected</div>
              </div>
              <div className="grid max-h-64 gap-2 overflow-auto pr-1 md:grid-cols-2">
                {addFormComponents.map((component) => (
                  <label
                    key={component.id}
                    className="flex items-start gap-2 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={addForm.selectedIds.includes(component.id)}
                      onChange={() => toggleSelectedComponent(component.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-text-primary">{getComponentLabel(component)}</span>
                      {component.groupId && <span className="text-xs text-text-tertiary">{component.groupId}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleAddItem}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover"
              >
                Add Equipment
              </button>
            </div>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised">
            <div className="border-b border-border-default px-5 py-4">
              <h2 className="text-lg font-semibold text-text-primary">Line Items</h2>
            </div>
            {body.items.length === 0 ? (
              <div className="p-8 text-center text-sm text-text-secondary">
                No equipment yet. Add a line item above, then save the estimate.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-default bg-surface-overlay text-xs uppercase tracking-wide text-text-tertiary">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Equipment</th>
                    <th className="px-4 py-3 font-semibold">Qty</th>
                    <th className="px-4 py-3 font-semibold">Install</th>
                    <th className="px-4 py-3 text-right font-semibold">Material</th>
                    <th className="px-4 py-3 text-right font-semibold">Labor Hrs</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {body.items.map((item) => {
                    const meta = getTypeMeta(item.type);
                    const itemCost = calcItem(item) as { totalMtl: number; totalLbr: number };
                    const itemComponents = getComponents(item.type);
                    const selectedById = new Map(item.selected.map((component) => [component.id, component.qty]));
                    const editingThisItem = editingComponentsFor === item.id;
                    return (
                      <Fragment key={item.id}>
                        <tr className="hover:bg-surface-overlay/60">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="rounded-full px-2 py-1 text-xs font-semibold"
                                style={{ backgroundColor: meta.bg, color: meta.color }}
                              >
                                {meta.label}
                              </span>
                              <div>
                                <div className="font-medium text-text-primary">{item.tag}</div>
                                <div className="text-xs text-text-tertiary">
                                  {item.location || "-"} · {item.selected.length} components
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(event) => updateItem(item.id, { qty: Math.max(1, asNumber(event.target.value)) })}
                              className="w-20 rounded-lg border border-border-default bg-surface-overlay px-2 py-1 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <select
                              value={item.installType}
                              onChange={(event) => updateItem(item.id, { installType: event.target.value as "EMT" | "Plenum" })}
                              className="rounded-lg border border-border-default bg-surface-overlay px-2 py-1 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                            >
                              <option value="EMT">EMT</option>
                              <option value="Plenum">Plenum</option>
                            </select>
                          </td>
                          <td className="px-4 py-4 text-right font-medium text-text-primary">
                            {formatCurrency(itemCost.totalMtl)}
                          </td>
                          <td className="px-4 py-4 text-right text-text-secondary">{formatNumber(itemCost.totalLbr)}</td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingComponentsFor(editingThisItem ? null : item.id)}
                                className="text-sm font-medium text-brand-primary hover:underline"
                              >
                                {editingThisItem ? "Hide" : "Components"}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="text-sm font-medium text-status-danger hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                        {editingThisItem && (
                          <tr>
                            <td colSpan={6} className="border-t border-border-default bg-surface-overlay/50 px-4 py-4">
                              <div className="grid gap-2 md:grid-cols-2">
                                {itemComponents.map((component) => {
                                  const selectedQty = selectedById.get(component.id);
                                  return (
                                    <div
                                      key={component.id}
                                      className="flex items-start justify-between gap-3 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm"
                                    >
                                      <label className="flex min-w-0 flex-1 items-start gap-2 text-text-secondary">
                                        <input
                                          type="checkbox"
                                          checked={selectedQty !== undefined}
                                          onChange={() => toggleItemComponent(item.id, component.id)}
                                          className="mt-1"
                                        />
                                        <span className="min-w-0">
                                          <span className="block text-text-primary">{getComponentLabel(component)}</span>
                                          {component.groupId && <span className="text-xs text-text-tertiary">{component.groupId}</span>}
                                        </span>
                                      </label>
                                      {selectedQty !== undefined && (
                                        <input
                                          type="number"
                                          min="1"
                                          value={selectedQty}
                                          onChange={(event) =>
                                            updateItemComponentQty(item.id, component.id, Math.max(1, asNumber(event.target.value)))
                                          }
                                          className="w-16 rounded-lg border border-border-default bg-surface-overlay px-2 py-1 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                                          aria-label={`${getComponentLabel(component)} quantity`}
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <h2 className="text-lg font-semibold text-text-primary">Workflow</h2>
            <label className="mt-4 block">
              <span className={labelClassName}>Status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as EstimateStatus);
                  setDirty(true);
                }}
                className={inputClassName}
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block">
              <span className={labelClassName}>Notes</span>
              <textarea
                value={body.notes}
                onChange={(event) => updateBody({ notes: event.target.value })}
                className={`${inputClassName} min-h-32`}
                placeholder="Scope notes, assumptions, or handoff context..."
              />
            </label>
          </section>

          <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <h2 className="text-lg font-semibold text-text-primary">Raw Inputs</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <SummaryRow label="Raw material" value={formatCurrency(rawTotals.mtl)} />
              <SummaryRow label="Raw labor hours" value={formatNumber(rawTotals.lbrHrs)} />
              <SummaryRow label="Bond" value={formatCurrency(costs.bond)} />
              <SummaryRow label="Margin %" value={formatPercent(costs.total > 0 ? costs.profit / costs.total : null)} />
            </dl>
          </section>

          <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <h2 className="text-lg font-semibold text-text-primary">Platform Links</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-text-tertiary">Opportunity</dt>
                <dd className="mt-0.5 text-text-secondary">
                  {estimate.linked_opportunity_id ? (
                    <Link href={`/crm/opportunities/${estimate.linked_opportunity_id}`} className="text-brand-primary hover:underline">
                      {opportunityNumber || estimate.linked_opportunity_id}
                    </Link>
                  ) : (
                    "-"
                  )}
                </dd>
              </div>
              <SummaryRow label="Project" value={estimate.linked_project_id ?? "-"} />
              <SummaryRow label="Created" value={formatDate(estimate.created_at)} />
              <SummaryRow label="Updated" value={formatDate(estimate.updated_at)} />
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SummaryMetric({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-overlay p-4">
      <div className="text-xs uppercase tracking-wide text-text-tertiary">{label}</div>
      <div className={`mt-2 font-semibold text-text-primary ${emphasized ? "text-2xl" : "text-xl"}`}>{value}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="mt-0.5 break-words text-text-secondary">{value}</dd>
    </div>
  );
}

function NumberSetting({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: unknown;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className={labelClassName}>{label}</span>
      <input
        type="number"
        step={step}
        value={asNumber(value, 0)}
        onChange={(event) => onChange(asNumber(event.target.value, 0))}
        className={inputClassName}
      />
    </label>
  );
}

function BooleanSetting({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-secondary">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
