"use client";

import { useState, useEffect, useRef } from "react";
import type { CatalogOption, ResolverResult } from "./page";

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

// ---- Parsed scope types (matches AI output) ----
type ParsedAssembly = { assemblyRef: string; assemblyName: string; qty: number; notes: string };
type ParsedPoint = { name: string; qty: number; assemblies: ParsedAssembly[]; notes: string };
type ParsedSystem = { name: string; type: string; qty: number; location: string; points: ParsedPoint[]; notes: string };
type ScopeImport = { systems: ParsedSystem[] };

// ---- Per-assembly review row ----
type AssemblyRow = {
  rowId: string;
  systemName: string;
  inferredType: string;
  assemblyName: string;
  resolverResult: ResolverResult;
  overrideEmtId: string;   // correct EMT assembly ID; empty = no override
  overridePlnId: string;   // correct Plenum assembly ID; empty = no override
};

// Build option lists keyed by install type
function emtOptions(opts: CatalogOption[]): { value: string; label: string; componentId: string; name: string }[] {
  return opts.map((o) => ({ value: o.emtAID, label: `[${o.emtAID}] ${o.name}`, componentId: o.componentId, name: o.name }));
}
function plnOptions(opts: CatalogOption[]): { value: string; label: string; componentId: string; name: string }[] {
  return opts.map((o) => ({ value: o.plnAID, label: `[${o.plnAID}] ${o.name}`, componentId: o.componentId, name: o.name }));
}

function inferEquipmentType(system: ParsedSystem): string {
  const name = (system.name + " " + system.type).toLowerCase();
  if (name.includes("vav")) return "vav";
  if (name.includes("ahu") || name.includes("air handling")) return "ahu";
  if (name.includes("rtu") || name.includes("rooftop")) return "rtu";
  if (name.includes("fcu") || name.includes("fan coil")) return "fcu";
  if (name.includes("unit heater") || name.includes(" uh")) return "uh";
  if (name.includes("vrf")) return "vrf";
  if (name.includes("dx") || name.includes("split") || name.includes("ductless")) return "dx";
  if (name.includes("exhaust") || name.includes(" ef")) return "exhaust-fan";
  if (name.includes("network") || name.includes("bas")) return "network";
  if (name.includes("chiller") || name.includes("boiler") || name.includes("plant") || name.includes("pump")) return "plant";
  return "custom";
}

function loadPairs(): TrainingPair[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}
function savePairs(pairs: TrainingPair[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pairs));
}

type Props = {
  catalogByType: Record<string, CatalogOption[]>;
  organizationId: string;
  resolveAssembly: (sourceText: string, equipmentType: string) => Promise<ResolverResult>;
  resolveAllAssemblies: (assemblies: { sourceText: string; equipmentType: string }[]) => Promise<ResolverResult[]>;
};

export function AssemblyTrainingClient({ catalogByType, organizationId, resolveAssembly, resolveAllAssemblies }: Props) {
  // ---- Single resolver tester ----
  const [testText, setTestText] = useState("");
  const [testType, setTestType] = useState("vav");
  const [testResolving, setTestResolving] = useState(false);
  const [testResult, setTestResult] = useState<ResolverResult | "idle">("idle");
  const [testCorrect, setTestCorrect] = useState("");
  const [testSaved, setTestSaved] = useState(false);

  // ---- Document parse + review ----
  const [provider, setProvider] = useState("");
  const [providers, setProviders] = useState<{ id: string; label: string }[]>([]);
  const [scopeText, setScopeText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [rows, setRows] = useState<AssemblyRow[]>([]);
  const [resolving, setResolving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Training data ----
  const [pairs, setPairs] = useState<TrainingPair[]>([]);
  const [filterType, setFilterType] = useState("all");

  useEffect(() => { setPairs(loadPairs()); }, []);

  // Load available AI providers from connections
  useEffect(() => {
    if (!organizationId) return;
    fetch(`/api/estimating/ai-connections?organizationId=${encodeURIComponent(organizationId)}`)
      .then((r) => r.json())
      .then((json) => {
        const conns: { provider: string; label: string }[] = json?.connections ?? [];
        const opts = conns.map((c) => ({ id: c.provider, label: c.label || c.provider }));
        setProviders(opts);
        if (opts.length > 0 && !provider) setProvider(opts[0].id);
      })
      .catch(() => {});
  }, [organizationId]);

  // ---- Single test resolver ----
  async function handleTestResolve() {
    if (!testText.trim()) return;
    setTestResolving(true);
    setTestResult("idle");
    setTestCorrect("");
    try {
      const result = await resolveAssembly(testText.trim(), testType);
      setTestResult(result);
      if (result) {
        const match = (catalogByType[testType] ?? []).find((o) => o.emtAID === result.id || o.plnAID === result.id);
        if (match) setTestCorrect(match.componentId);
      }
    } finally {
      setTestResolving(false);
    }
  }

  function handleTestSave() {
    const option = (catalogByType[testType] ?? []).find((o) => o.componentId === testCorrect);
    if (!testText.trim() || !option) return;
    const pair: TrainingPair = {
      id: crypto.randomUUID(),
      sourceText: testText.trim(),
      equipmentType: testType,
      resolverResult: testResult === "idle" ? null : testResult,
      correctAssemblyId: option.emtAID,
      correctAssemblyName: option.name,
      correctComponentId: option.componentId,
      createdAt: new Date().toISOString(),
    };
    const next = [pair, ...pairs];
    setPairs(next);
    savePairs(next);
    setTestSaved(true);
    setTimeout(() => setTestSaved(false), 1500);
    setTestText("");
    setTestResult("idle");
    setTestCorrect("");
  }

  // ---- Document parse ----
  async function handleParse() {
    if (!provider) { setParseError("Select an AI provider."); return; }
    if (!scopeText && files.length === 0) { setParseError("Add scope text or upload a file."); return; }
    setParsing(true);
    setParseError("");
    setRows([]);
    try {
      const fd = new FormData();
      fd.set("organizationId", organizationId);
      fd.set("provider", provider);
      fd.set("scopeText", scopeText);
      for (const f of files) fd.append("files", f);

      const res = await fetch("/api/estimating/ai-takeoff-training", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Parsing failed.");

      const scope: ScopeImport = json.scopeImport ?? json;
      const systems: ParsedSystem[] = Array.isArray(scope.systems) ? scope.systems : [];

      // Flatten all assemblies into rows
      const flatAssemblies: { sourceText: string; equipmentType: string }[] = [];
      const rawRows: Omit<AssemblyRow, "resolverResult">[] = [];

      for (const system of systems) {
        const equipType = inferEquipmentType(system);
        for (const point of system.points ?? []) {
          for (const asm of point.assemblies ?? []) {
            rawRows.push({
              rowId: crypto.randomUUID(),
              systemName: system.name,
              inferredType: equipType,
              assemblyName: asm.assemblyName || asm.assemblyRef || "Unknown",
              overrideEmtId: "",
              overridePlnId: "",
            });
            flatAssemblies.push({ sourceText: asm.assemblyName || asm.assemblyRef || "", equipmentType: equipType });
          }
        }
      }

      setResolving(true);
      const results = await resolveAllAssemblies(flatAssemblies);
      const assembled: AssemblyRow[] = rawRows.map((r, i) => ({ ...r, resolverResult: results[i] ?? null }));
      setRows(assembled);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Parsing failed.");
    } finally {
      setParsing(false);
      setResolving(false);
    }
  }

  function updateRowEmtOverride(rowId: string, assemblyId: string) {
    setRows((prev) => prev.map((r) => r.rowId === rowId ? { ...r, overrideEmtId: assemblyId } : r));
  }
  function updateRowPlnOverride(rowId: string, assemblyId: string) {
    setRows((prev) => prev.map((r) => r.rowId === rowId ? { ...r, overridePlnId: assemblyId } : r));
  }

  function saveAllCorrections() {
    // Build lookup: assemblyId → {name, componentId} across all catalog options
    const allOpts = Object.values(catalogByType).flat();
    const byEmtId = new Map(allOpts.map((o) => [o.emtAID, o]));
    const byPlnId = new Map(allOpts.map((o) => [o.plnAID, o]));

    const newPairs: TrainingPair[] = [];
    for (const row of rows) {
      // Save EMT correction if set and different from resolver
      if (row.overrideEmtId && row.resolverResult?.id !== row.overrideEmtId) {
        const opt = byEmtId.get(row.overrideEmtId);
        newPairs.push({
          id: crypto.randomUUID(),
          sourceText: row.assemblyName,
          equipmentType: row.inferredType,
          resolverResult: row.resolverResult,
          correctAssemblyId: row.overrideEmtId,
          correctAssemblyName: opt ? `${opt.name} · EMT` : row.overrideEmtId,
          correctComponentId: opt?.componentId ?? "",
          createdAt: new Date().toISOString(),
        });
      }
      // Save Plenum correction if set and different from resolver
      if (row.overridePlnId && row.resolverResult?.id !== row.overridePlnId) {
        const opt = byPlnId.get(row.overridePlnId);
        newPairs.push({
          id: crypto.randomUUID(),
          sourceText: `${row.assemblyName} (Plenum)`,
          equipmentType: row.inferredType,
          resolverResult: row.resolverResult,
          correctAssemblyId: row.overridePlnId,
          correctAssemblyName: opt ? `${opt.name} · Plenum` : row.overridePlnId,
          correctComponentId: opt?.componentId ?? "",
          createdAt: new Date().toISOString(),
        });
      }
    }
    if (!newPairs.length) return;
    const next = [...newPairs, ...pairs].filter(
      (p, i, arr) => arr.findIndex((q) => q.sourceText === p.sourceText && q.equipmentType === p.equipmentType) === i,
    );
    setPairs(next);
    savePairs(next);
  }

  function deletePair(id: string) {
    const next = pairs.filter((p) => p.id !== id);
    setPairs(next);
    savePairs(next);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(pairs, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "assembly-training.json" });
    a.click();
    URL.revokeObjectURL(a.href);
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
      } catch { alert("Invalid JSON."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // Flat deduplicated list of all assemblies across all types — used as fallback for types with no catalog
  const allCatalogOptions = Object.entries(catalogByType).flatMap(([type, opts]) =>
    opts.map((o) => ({ ...o, equipmentType: type }))
  ).filter((o, i, arr) => arr.findIndex((x) => x.emtAID === o.emtAID && x.equipmentType === o.equipmentType) === i);

  const visiblePairs = filterType === "all" ? pairs : pairs.filter((p) => p.equipmentType === filterType);
  const testCatalogOptions = catalogByType[testType] ?? [];
  const testMismatch = testResult !== "idle" && testResult !== null && testCorrect &&
    !testCatalogOptions.find((o) => o.componentId === testCorrect && (o.emtAID === testResult?.id || o.plnAID === testResult?.id));

  const correctionsAvailable = rows.some((r) => r.overrideEmtId || r.overridePlnId);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Assembly Resolver Training</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Parse a scope document, review how the resolver maps each assembly, correct what&apos;s wrong, and save the corrections as training data.
        </p>
      </div>

      {/* ===== SECTION 1: Parse document ===== */}
      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-text-primary">Parse Document</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">AI Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            >
              <option value="">— select provider —</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              {providers.length === 0 && <option value="anthropic">Anthropic (Claude)</option>}
            </select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Upload Files <span className="normal-case text-text-tertiary">(PDF, max 4 MB each)</span>
            </label>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm text-text-secondary transition hover:bg-surface-overlay">
                Choose files
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt,.doc,.docx" className="hidden"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
              </label>
              {files.length > 0 && (
                <span className="text-sm text-text-secondary">{files.map((f) => f.name).join(", ")}</span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Or paste scope text</label>
          <textarea
            value={scopeText}
            onChange={(e) => setScopeText(e.target.value)}
            rows={4}
            placeholder="Paste scope of work text here…"
            className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleParse}
            disabled={parsing || resolving}
            className="rounded-xl bg-brand-primary px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {parsing ? "Parsing…" : resolving ? "Resolving…" : "Parse & Resolve"}
          </button>
          {parseError && <span className="text-sm text-status-danger">{parseError}</span>}
        </div>
      </section>

      {/* ===== SECTION 2: Assembly review ===== */}
      {rows.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-text-primary">Review Assemblies</h2>
            <button
              onClick={saveAllCorrections}
              disabled={!correctionsAvailable}
              className="rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save Corrections
            </button>
          </div>
          <p className="text-xs text-text-tertiary">
            Only overrides that differ from the resolver&apos;s output are saved as training pairs.
          </p>

          <div className="overflow-x-auto rounded-2xl border border-border-default">
            <table className="w-full text-sm">
              <thead className="border-b border-border-default bg-surface-raised">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">System</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">AI Assembly Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Resolver Result</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-brand-primary">EMT Correct</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Plenum Correct</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const catalogOpts = catalogByType[row.inferredType] ?? [];
                  const fallbackOpts = catalogOpts.length > 0
                    ? catalogOpts
                    : Object.values(catalogByType).flat();

                  const emtOpts = emtOptions(fallbackOpts);
                  const plnOpts = plnOptions(fallbackOpts);

                  // Group for optgroup display
                  const buildGrouped = (opts: CatalogOption[], getter: (o: CatalogOption) => string) =>
                    Object.entries(
                      catalogOpts.length > 0
                        ? { [row.inferredType]: catalogOpts }
                        : Object.fromEntries(Object.entries(catalogByType).filter(([, v]) => v.length > 0))
                    ).map(([type, typeOpts]) => ({
                      type,
                      options: typeOpts.map((o) => ({ value: getter(o), label: `[${getter(o)}] ${o.name}`, componentId: o.componentId })),
                    }));

                  const emtGrouped = buildGrouped(fallbackOpts, (o) => o.emtAID);
                  const plnGrouped = buildGrouped(fallbackOpts, (o) => o.plnAID);

                  const emtMismatch = row.overrideEmtId && row.resolverResult?.id !== row.overrideEmtId;
                  const plnMismatch = row.overridePlnId && row.resolverResult?.id !== row.overridePlnId;

                  const makeSelect = (
                    value: string,
                    onChange: (v: string) => void,
                    grouped: { type: string; options: { value: string; label: string }[] }[],
                    mismatch: boolean,
                  ) => (
                    <select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className={`w-full rounded-lg border px-2 py-1 text-xs focus:outline-none ${mismatch ? "border-status-danger/40 bg-status-danger/5 text-status-danger" : "border-border-default bg-surface-base text-text-primary"}`}
                    >
                      <option value="">—</option>
                      {grouped.map(({ type, options }) => (
                        <optgroup key={type} label={type.toUpperCase()}>
                          {options.map((opt) => (
                            <option key={`${type}-${opt.value}`} value={opt.value}>{opt.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  );

                  return (
                    <tr key={row.rowId} className="border-b border-border-default last:border-0 hover:bg-surface-raised">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-text-primary">{row.systemName}</div>
                        <span className="rounded-full bg-surface-overlay px-1.5 py-0.5 font-mono text-xs text-text-tertiary">{row.inferredType}</span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-text-primary">{row.assemblyName}</td>
                      <td className="px-4 py-2.5">
                        {row.resolverResult ? (
                          <div>
                            <div className="text-xs font-medium text-text-primary">{row.resolverResult.name}</div>
                            <div className="font-mono text-xs text-text-tertiary">[{row.resolverResult.id}] via {row.resolverResult.matchedBy}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-status-danger">No match</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 min-w-[200px]">
                        {makeSelect(row.overrideEmtId, (v) => updateRowEmtOverride(row.rowId, v), emtGrouped, !!emtMismatch)}
                      </td>
                      <td className="px-4 py-2.5 min-w-[200px]">
                        {makeSelect(row.overridePlnId, (v) => updateRowPlnOverride(row.rowId, v), plnGrouped, !!plnMismatch)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===== SECTION 3: Single resolver tester ===== */}
      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-text-primary">Test Single Assembly</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-border-default bg-surface-raised p-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Equipment Type</label>
              <select value={testType} onChange={(e) => { setTestType(e.target.value); setTestResult("idle"); setTestCorrect(""); }}
                className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none">
                {EQUIPMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">AI Assembly Name</label>
              <input value={testText} onChange={(e) => setTestText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTestResolve()}
                placeholder={`e.g. "Enclosure (Small) Controller/ Xfmr"`}
                className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand-primary focus:outline-none" />
            </div>
            <button onClick={handleTestResolve} disabled={!testText.trim() || testResolving}
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
              {testResolving ? "Resolving…" : "Resolve"}
            </button>
            {testResult !== "idle" && (
              <div className={`rounded-xl border p-3 ${testResult ? "border-status-success/30 bg-status-success/5" : "border-status-warning/30 bg-status-warning/5"}`}>
                {testResult ? (
                  <div className="space-y-0.5">
                    <div className="font-medium text-text-primary">{testResult.name}</div>
                    <div className="font-mono text-xs text-text-secondary">[{testResult.id}] via {testResult.matchedBy}</div>
                  </div>
                ) : (
                  <div className="text-sm text-status-warning">No match — would be unresolved custom.</div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-border-default bg-surface-raised p-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Correct Assembly for <span className="text-brand-primary">{EQUIPMENT_TYPES.find((t) => t.value === testType)?.label}</span>
              </label>
              <select value={testCorrect} onChange={(e) => setTestCorrect(e.target.value)}
                className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none">
                <option value="">— pick correct assembly —</option>
                {testCatalogOptions.map((opt) => (
                  <option key={opt.componentId} value={opt.componentId}>
                    [{opt.emtAID}] {opt.name} · {opt.cat}
                  </option>
                ))}
              </select>
            </div>
            {testCorrect && (
              <div className={`rounded-xl border p-3 text-sm ${testMismatch ? "border-status-danger/30 bg-status-danger/5" : "border-status-success/30 bg-status-success/5"}`}>
                <span className={`font-medium ${testMismatch ? "text-status-danger" : "text-status-success"}`}>
                  {testMismatch ? "Mismatch — will be recorded." : testResult !== "idle" ? "Already correct." : "Set resolver result first."}
                </span>
              </div>
            )}
            <button onClick={handleTestSave} disabled={!testText.trim() || !testCorrect || testSaved}
              className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-base disabled:opacity-50">
              {testSaved ? "Saved ✓" : "Save Training Pair"}
            </button>
          </div>
        </div>
      </section>

      {/* ===== SECTION 4: Training data table ===== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-lg font-semibold text-text-primary">Training Data</h2>
            <span className="rounded-full bg-surface-overlay px-2 py-0.5 text-xs font-medium text-text-secondary">{pairs.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="rounded-xl border border-border-default bg-surface-base px-3 py-1.5 text-xs text-text-primary focus:outline-none">
              <option value="all">All types</option>
              {EQUIPMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <label className="cursor-pointer rounded-xl border border-border-default bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-overlay">
              Import JSON
              <input type="file" accept=".json" onChange={importJson} className="hidden" />
            </label>
            <button onClick={exportJson} disabled={pairs.length === 0}
              className="rounded-xl border border-border-default bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-overlay disabled:opacity-50">
              Export JSON
            </button>
          </div>
        </div>

        {visiblePairs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-default p-8 text-center text-sm text-text-tertiary">
            No training pairs yet. Parse a document or test a single assembly name above.
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
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {visiblePairs.map((pair) => {
                  const mismatch = pair.resolverResult && pair.resolverResult.id !== pair.correctAssemblyId;
                  return (
                    <tr key={pair.id} className="border-b border-border-default last:border-0 hover:bg-surface-raised">
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-surface-overlay px-2 py-0.5 font-mono text-xs text-text-secondary">{pair.equipmentType}</span>
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
                        <div className="font-mono text-xs text-text-tertiary">[{pair.correctAssemblyId}]</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deletePair(pair.id)} className="text-xs text-text-tertiary transition hover:text-status-danger">Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
