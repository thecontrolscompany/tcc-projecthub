"use client";

import { useState, useEffect, useCallback } from "react";
import type { CatalogOption } from "./page";

const STORAGE_KEY = "hvac-estimator-assembly-training-v1";

const EQUIPMENT_TYPES = [
  { value: "vav", label: "VAV" },
  { value: "ahu", label: "AHU" },
  { value: "rtu", label: "RTU" },
  { value: "fcu", label: "FCU" },
  { value: "uh", label: "Unit Heater" },
  { value: "dx", label: "DX / Split System" },
  { value: "vrf", label: "VRF" },
  { value: "network", label: "Network" },
  { value: "exhaust-fan", label: "Exhaust Fan" },
  { value: "plant", label: "Plant / Chiller" },
  { value: "custom", label: "Custom / System" },
];

type ResolverResult = { id: string; name: string; matchedBy: string } | null;

export type TrainingPair = {
  id: string;
  sourceText: string;
  equipmentType: string;
  resolverResult: ResolverResult;
  correctAssemblyId: string;
  correctAssemblyName: string;
  correctComponentId: string;
  createdAt: string;
};

type Props = {
  catalogByType: Record<string, CatalogOption[]>;
  resolveAssembly: (sourceText: string, equipmentType: string) => Promise<ResolverResult>;
};

function loadPairs(): TrainingPair[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TrainingPair[];
  } catch {
    return [];
  }
}

function savePairs(pairs: TrainingPair[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pairs));
}

export function AssemblyTrainingClient({ catalogByType, resolveAssembly }: Props) {
  const [sourceText, setSourceText] = useState("");
  const [equipmentType, setEquipmentType] = useState("vav");
  const [resolving, setResolving] = useState(false);
  const [resolverResult, setResolverResult] = useState<ResolverResult | "idle">("idle");
  const [correctOption, setCorrectOption] = useState("");
  const [pairs, setPairs] = useState<TrainingPair[]>([]);
  const [filterType, setFilterType] = useState("all");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPairs(loadPairs());
  }, []);

  const catalogOptions = catalogByType[equipmentType] ?? [];

  async function handleResolve() {
    if (!sourceText.trim()) return;
    setResolving(true);
    setResolverResult("idle");
    setCorrectOption("");
    try {
      const result = await resolveAssembly(sourceText.trim(), equipmentType);
      setResolverResult(result);
      if (result) {
        const matchingOption = catalogOptions.find((o) => o.emtAID === result.id || o.plnAID === result.id);
        if (matchingOption) setCorrectOption(matchingOption.componentId);
      }
    } finally {
      setResolving(false);
    }
  }

  function handleSave() {
    if (!sourceText.trim() || !correctOption) return;
    const option = catalogOptions.find((o) => o.componentId === correctOption);
    if (!option) return;

    const newPair: TrainingPair = {
      id: crypto.randomUUID(),
      sourceText: sourceText.trim(),
      equipmentType,
      resolverResult: resolverResult === "idle" ? null : resolverResult,
      correctAssemblyId: option.emtAID,
      correctAssemblyName: option.name,
      correctComponentId: option.componentId,
      createdAt: new Date().toISOString(),
    };

    const next = [newPair, ...pairs];
    setPairs(next);
    savePairs(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    setSourceText("");
    setResolverResult("idle");
    setCorrectOption("");
  }

  function deletePair(id: string) {
    const next = pairs.filter((p) => p.id !== id);
    setPairs(next);
    savePairs(next);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(pairs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "assembly-training.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string) as TrainingPair[];
        const merged = [...imported, ...pairs].filter(
          (p, i, arr) => arr.findIndex((q) => q.sourceText === p.sourceText && q.equipmentType === p.equipmentType) === i,
        );
        setPairs(merged);
        savePairs(merged);
      } catch {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const resolverMismatch =
    resolverResult !== "idle" &&
    resolverResult !== null &&
    correctOption &&
    !catalogOptions.find((o) => o.componentId === correctOption && (o.emtAID === resolverResult?.id || o.plnAID === resolverResult?.id));

  const visiblePairs = filterType === "all" ? pairs : pairs.filter((p) => p.equipmentType === filterType);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Assembly Resolver Training</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Test how the resolver maps AI-generated assembly names to catalog assemblies. Record corrections to build training data.
        </p>
      </div>

      {/* Resolver tester */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-border-default bg-surface-raised p-5">
          <h2 className="font-heading text-base font-semibold text-text-primary">Test Resolver</h2>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Equipment Type</label>
            <select
              value={equipmentType}
              onChange={(e) => { setEquipmentType(e.target.value); setResolverResult("idle"); setCorrectOption(""); }}
              className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            >
              {EQUIPMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">AI Assembly Name</label>
            <input
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleResolve()}
              placeholder={`e.g. "Enclosure (Small) Controller/ Xfmr"`}
              className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand-primary focus:outline-none"
            />
          </div>

          <button
            onClick={handleResolve}
            disabled={!sourceText.trim() || resolving}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resolving ? "Resolving…" : "Resolve"}
          </button>

          {resolverResult !== "idle" && (
            <div className={`rounded-xl border p-4 ${resolverResult ? "border-status-success/30 bg-status-success/5" : "border-status-warning/30 bg-status-warning/5"}`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Resolver Output</div>
              {resolverResult ? (
                <div className="mt-1.5 space-y-0.5">
                  <div className="font-medium text-text-primary">{resolverResult.name}</div>
                  <div className="font-mono text-xs text-text-secondary">ID: {resolverResult.id}</div>
                  <div className="font-mono text-xs text-text-tertiary">via {resolverResult.matchedBy}</div>
                </div>
              ) : (
                <div className="mt-1.5 text-sm text-status-warning">No match found — would become an unresolved custom assembly.</div>
              )}
            </div>
          )}
        </div>

        {/* Correction picker */}
        <div className="space-y-4 rounded-2xl border border-border-default bg-surface-raised p-5">
          <h2 className="font-heading text-base font-semibold text-text-primary">Correct Mapping</h2>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Correct Assembly for <span className="text-brand-primary">{EQUIPMENT_TYPES.find((t) => t.value === equipmentType)?.label ?? equipmentType}</span>
            </label>
            <select
              value={correctOption}
              onChange={(e) => setCorrectOption(e.target.value)}
              className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            >
              <option value="">— pick correct assembly —</option>
              {catalogOptions.map((opt) => (
                <option key={opt.componentId} value={opt.componentId}>
                  [{opt.emtAID}] {opt.name} · {opt.cat}
                </option>
              ))}
            </select>
          </div>

          {correctOption && (
            <div className={`rounded-xl border p-3 text-sm ${resolverMismatch ? "border-status-danger/30 bg-status-danger/5" : "border-status-success/30 bg-status-success/5"}`}>
              {resolverMismatch ? (
                <span className="font-medium text-status-danger">Mismatch — resolver returned wrong assembly. This correction will be recorded.</span>
              ) : resolverResult !== "idle" && resolverResult !== null ? (
                <span className="font-medium text-status-success">Resolver is already correct.</span>
              ) : (
                <span className="text-text-secondary">Set the resolver result first to compare.</span>
              )}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!sourceText.trim() || !correctOption || saved}
            className="rounded-xl bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-50 border border-border-default"
          >
            {saved ? "Saved ✓" : "Save Training Pair"}
          </button>
        </div>
      </div>

      {/* Training data table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-base font-semibold text-text-primary">Training Data</h2>
            <span className="rounded-full bg-surface-overlay px-2 py-0.5 text-xs font-medium text-text-secondary">{pairs.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-xl border border-border-default bg-surface-base px-3 py-1.5 text-xs text-text-primary focus:outline-none"
            >
              <option value="all">All types</option>
              {EQUIPMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <label className="cursor-pointer rounded-xl border border-border-default bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-overlay">
              Import JSON
              <input type="file" accept=".json" onChange={importJson} className="hidden" />
            </label>
            <button
              onClick={exportJson}
              disabled={pairs.length === 0}
              className="rounded-xl border border-border-default bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export JSON
            </button>
          </div>
        </div>

        {visiblePairs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-default p-8 text-center text-sm text-text-tertiary">
            No training pairs yet. Resolve an assembly name above and save a correction.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border-default">
            <table className="w-full text-sm">
              <thead className="border-b border-border-default bg-surface-raised">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">AI Assembly Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Resolver Returned</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Correct Assembly</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary"></th>
                </tr>
              </thead>
              <tbody>
                {visiblePairs.map((pair) => {
                  const mismatch = pair.resolverResult && pair.resolverResult.id !== pair.correctAssemblyId;
                  const noMatch = !pair.resolverResult;
                  return (
                    <tr key={pair.id} className="border-b border-border-default last:border-0 hover:bg-surface-raised">
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-surface-overlay px-2 py-0.5 font-mono text-xs text-text-secondary">
                          {pair.equipmentType}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary">{pair.sourceText}</td>
                      <td className="px-4 py-3">
                        {pair.resolverResult ? (
                          <span className={`text-xs ${mismatch ? "text-status-danger" : "text-status-success"}`}>
                            [{pair.resolverResult.id}] {pair.resolverResult.name}
                          </span>
                        ) : (
                          <span className="text-xs text-status-warning">No match</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary">{pair.correctAssemblyName}</div>
                        <div className="font-mono text-xs text-text-tertiary">[{pair.correctAssemblyId}] {pair.correctComponentId}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deletePair(pair.id)}
                          className="text-xs text-text-tertiary transition hover:text-status-danger"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
