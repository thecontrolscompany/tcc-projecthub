'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type {
  ProjectHubSystemTemplatePointManifestEntry,
  ProjectHubTemplatePointAliasEntry,
  ProjectHubSystemTemplateRegistryEntry,
  ProjectHubSystemTemplateVisibilityRule,
} from '@/lib/projecthub-system-templates';

type SystemTemplatePreviewProps = {
  template: ProjectHubSystemTemplateRegistryEntry;
  availableTemplates: ProjectHubSystemTemplateRegistryEntry[];
  pointAliases: ProjectHubTemplatePointAliasEntry[];
  pointManifest: ProjectHubSystemTemplatePointManifestEntry[];
  visibilityRules: ProjectHubSystemTemplateVisibilityRule[];
  svgMarkup: string;
  assetBaseUrl: string;
};

type HighlightMode = 'highlight' | 'hide';

function uniqueBy<T>(values: T[], key: (value: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const k = key(value);
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(value);
  }
  return result;
}

function getSelectionId(rule: ProjectHubSystemTemplateVisibilityRule) {
  return rule.ontology_id || rule.source_short_name;
}

function addMatchedNodes(root: ParentNode, selector: string, nodes: Set<Element>) {
  root.querySelectorAll(selector).forEach((node) => nodes.add(node));
}

function collectRuleNodes(root: ParentNode, rule: ProjectHubSystemTemplateVisibilityRule) {
  const nodes = new Set<Element>();

  rule.label_group_ids.forEach((id) => {
    const node = document.getElementById(id);
    if (node) nodes.add(node);
  });

  rule.device_group_ids.forEach((id) => {
    const node = document.getElementById(id);
    if (node) nodes.add(node);
  });

  rule.value_group_ids?.forEach((id) => {
    const node = document.getElementById(id);
    if (node) nodes.add(node);
  });

  rule.related_node_ids?.forEach((id) => {
    const node = document.getElementById(id);
    if (node) nodes.add(node);
  });

  rule.image_selectors.forEach((selector) => addMatchedNodes(root, selector, nodes));
  rule.fallback_selectors.forEach((selector) => addMatchedNodes(root, selector, nodes));

  const sourceShortName = rule.source_short_name.replace(/"/g, '\\"');
  addMatchedNodes(
    root,
    `g[data-filter="${sourceShortName}"], g[short-name="${sourceShortName}"]`,
    nodes
  );
  addMatchedNodes(
    root,
    `use[key-data-attr*="pointShortName':'${sourceShortName}'"]`,
    nodes
  );
  addMatchedNodes(
    root,
    `use[key-data-attr*="pointShortName:\\"${sourceShortName}\\""]`,
    nodes
  );

  return nodes;
}

export function SystemTemplatePreview({
  template,
  availableTemplates,
  pointAliases,
  pointManifest,
  visibilityRules,
  svgMarkup,
  assetBaseUrl,
}: SystemTemplatePreviewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [highlightMode, setHighlightMode] = useState<HighlightMode>('highlight');
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(
    () => new Set(visibilityRules.map((rule) => rule.ontology_id || rule.source_short_name))
  );
  const [activeSelectionId, setActiveSelectionId] = useState<string>(
    () => visibilityRules[0]?.ontology_id || visibilityRules[0]?.source_short_name || ''
  );
  const [renderVersion, setRenderVersion] = useState(0);
  const aliasByShortName = useMemo(
    () => new Map(pointAliases.map((alias) => [alias.source_short_name, alias])),
    [pointAliases]
  );

  useEffect(() => {
    setSelectedRuleIds(new Set(visibilityRules.map((rule) => rule.ontology_id || rule.source_short_name)));
    setActiveSelectionId(visibilityRules[0]?.ontology_id || visibilityRules[0]?.source_short_name || '');
    setQuery('');
    setHighlightMode('highlight');
  }, [template.template_id, visibilityRules]);

  const visibilityOptions = useMemo(() => {
    return uniqueBy(
      visibilityRules.map((rule) => ({
        selection_id: rule.ontology_id || rule.source_short_name,
        ontology_id: rule.ontology_id,
        label: rule.label || rule.source_short_name,
        source_short_name: rule.source_short_name,
        confidence: rule.confidence,
      })),
      (option) => option.selection_id
    );
  }, [visibilityRules]);

  const selectedPoints = useMemo(() => {
    return visibilityRules.filter((rule) => selectedRuleIds.has(rule.ontology_id || rule.source_short_name));
  }, [selectedRuleIds, visibilityRules]);

  const visibleOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return visibilityOptions;
    return visibilityOptions.filter((option) =>
      option.selection_id.toLowerCase().includes(normalized) ||
      option.label.toLowerCase().includes(normalized) ||
      option.source_short_name.toLowerCase().includes(normalized)
    );
  }, [query, visibilityOptions]);

  useEffect(() => {
    const root = document.getElementById('system-template-preview-canvas');
    if (!root) return;

    const nodesBySelectionId = new Map<string, Set<Element>>();
    const pointGroups = root.querySelectorAll<SVGGElement>('g[data-filter], g[short-name]');

    pointGroups.forEach((group) => {
      group.style.cursor = 'pointer';
    });

    visibilityRules.forEach((rule) => {
      const selectionId = getSelectionId(rule);
      const matchedNodes = collectRuleNodes(root, rule);

      matchedNodes.forEach((node) => {
        const styledNode = node as SVGElement | HTMLElement;
        let selectionSet = nodesBySelectionId.get(selectionId);
        if (!selectionSet) {
          selectionSet = new Set<Element>();
          nodesBySelectionId.set(selectionId, selectionSet);
        }
        selectionSet.add(node);

        node.setAttribute('data-template-selection-id', selectionId);
        node.setAttribute('data-template-source-short-name', rule.source_short_name);
        styledNode.style.transition = 'opacity 120ms ease, filter 120ms ease';
      });
    });

    const nodeSelectionIds = new Map<Element, Set<string>>();
    nodesBySelectionId.forEach((nodeSet, selectionId) => {
      nodeSet.forEach((node) => {
        let ruleSet = nodeSelectionIds.get(node);
        if (!ruleSet) {
          ruleSet = new Set<string>();
          nodeSelectionIds.set(node, ruleSet);
        }
        ruleSet.add(selectionId);
      });
    });

    nodeSelectionIds.forEach((selectionIds, node) => {
      const styledNode = node as SVGElement | HTMLElement;
      const shouldShow = [...selectionIds].some((selectionId) => selectedRuleIds.has(selectionId));
      node.setAttribute('aria-hidden', String(!shouldShow));
      styledNode.style.display = shouldShow ? '' : 'none';
      styledNode.style.opacity = shouldShow ? '1' : '0';
      styledNode.style.filter =
        shouldShow && highlightMode === 'highlight'
          ? 'drop-shadow(0 0 8px rgba(125, 211, 252, 0.45))'
          : shouldShow
            ? 'none'
            : 'grayscale(1) saturate(0.35)';
    });
  }, [highlightMode, renderVersion, selectedRuleIds, visibilityRules]);

  useEffect(() => {
    const root = document.getElementById('system-template-preview-canvas');
    if (!root) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const interactive = target?.closest('[data-template-selection-id], [short-name], [data-filter], [data-shortname], [sname], [data-point-short-name]');
      if (!interactive || !root.contains(interactive)) return;

      const sourceShortName =
        interactive.getAttribute('data-template-source-short-name') ||
        interactive.getAttribute('short-name') ||
        interactive.getAttribute('data-filter') ||
        '';
      const selectionId =
        interactive.getAttribute('data-template-selection-id') ||
        sourceShortName;
      if (!sourceShortName || !selectionId) return;

      const matchingRule = visibilityRules.find(
        (rule) => (rule.ontology_id || rule.source_short_name) === selectionId
      );
      if (!matchingRule) return;

      setSelectedRuleIds((current) => {
        const next = new Set(current);
        if (next.has(selectionId)) next.delete(selectionId);
        else next.add(selectionId);

        return next;
      });
      setActiveSelectionId(selectionId);
    };

    root.addEventListener('click', handleClick);
    return () => {
      root.removeEventListener('click', handleClick);
    };
  }, [visibilityRules]);

  useEffect(() => {
    setRenderVersion((current) => current + 1);
  }, [svgMarkup]);

  function toggleRuleSelection(selectionId: string) {
    setSelectedRuleIds((current) => {
      const next = new Set(current);
      if (next.has(selectionId)) next.delete(selectionId);
      else next.add(selectionId);
      return next;
    });
    setActiveSelectionId(selectionId);
  }

  function selectAll() {
    setSelectedRuleIds(new Set(visibilityOptions.map((option) => option.selection_id)));
  }

  function clearAll() {
    setSelectedRuleIds(new Set());
  }

  function selectTemplate(nextTemplateId: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('templateId', nextTemplateId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <header className="mb-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/50">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                system template preview
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">{template.display_name}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  Normalized standalone system template rendered from the private investigation bundle, with point
                  rules driving label and glyph visibility against the visibility manifest.
                </p>
              </div>
              <label className="block max-w-md">
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Template
                </span>
                <select
                  value={template.template_id}
                  onChange={(event) => selectTemplate(event.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none ring-0 focus:border-cyan-400/60"
                >
                  {availableTemplates.map((option) => (
                    <option key={option.template_id} value={option.template_id}>
                      {option.display_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
              <Stat label="Template" value={template.template_id} />
              <Stat label="System type" value={template.system_type} />
              <Stat label="Family" value={template.equipment_family} />
              <Stat label="Points" value={String(pointManifest.length)} />
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/75 p-4 shadow-xl shadow-slate-950/40">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Canvas</h2>
                <p className="text-xs text-slate-400">
                  {selectedPoints.length} selected point rules out of {visibilityOptions.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHighlightMode('highlight')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    highlightMode === 'highlight'
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Highlight
                </button>
                <button
                  type="button"
                  onClick={() => setHighlightMode('hide')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    highlightMode === 'hide'
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Hide
                </button>
              </div>
            </div>

            <div
              id="system-template-preview-canvas"
              className="overflow-auto rounded-2xl border border-slate-700 bg-slate-950/70 p-3"
              style={{ minHeight: 720 }}
            >
              <div
                className="template-root"
                data-template-id={template.template_id}
                data-asset-base-url={assetBaseUrl}
                dangerouslySetInnerHTML={{ __html: svgMarkup }}
              />
              <style jsx global>{`
                #system-template-preview-canvas .template-root svg text,
                #system-template-preview-canvas .template-root svg tspan {
                  fill: #e2e8f0 !important;
                  stroke: #e2e8f0 !important;
                }

                #system-template-preview-canvas .template-root svg .graphics-point-notfound,
                #system-template-preview-canvas .template-root svg .graphics-point-value {
                  fill: #cbd5e1 !important;
                }

                #system-template-preview-canvas .template-root svg .graphics-point-label {
                  fill: #f8fafc !important;
                }
              `}</style>
            </div>
          </section>

          <aside className="rounded-3xl border border-slate-800 bg-slate-900/75 p-4 shadow-xl shadow-slate-950/40">
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Point Rules</h2>
                <p className="text-xs text-slate-400">
                  Toggle points by ontology ID, or source short name when no ontology is available.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                >
                  Clear
                </button>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Filter
                </span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search ontology id or label"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-400/60"
                />
              </label>

              <div className="max-h-[70vh] space-y-2 overflow-auto pr-1">
                {visibleOptions.map((option) => {
                  const checked = selectedRuleIds.has(option.selection_id);
                  return (
                    <label
                      key={option.selection_id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 text-sm transition ${
                        checked
                          ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-50'
                          : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700 hover:bg-slate-900/70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRuleSelection(option.selection_id)}
                        className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-400"
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold leading-5">
                          {option.ontology_id || option.source_short_name}
                        </span>
                        <span className="block text-xs text-slate-400">{option.label}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300">
                <div className="mb-2 font-semibold uppercase tracking-[0.18em] text-slate-400">Inspector</div>
                {(() => {
                  const activeRule =
                    visibilityRules.find(
                      (rule) => (rule.ontology_id || rule.source_short_name) === activeSelectionId
                    ) ?? visibilityRules[0];
                  if (!activeRule) return <div className="text-slate-500">No rule selected.</div>;
                  const alias = aliasByShortName.get(activeRule.source_short_name);
                  return (
                    <div className="space-y-2 leading-5">
                      <div>
                        <span className="text-slate-400">Selected:</span> {activeRule.source_short_name}
                      </div>
                      <div>
                        <span className="text-slate-400">Ontology:</span>{' '}
                        {activeRule.ontology_id || 'n/a'}
                      </div>
                      <div>
                        <span className="text-slate-400">Label node count:</span>{' '}
                        {activeRule.label_group_ids.length}
                      </div>
                      <div>
                        <span className="text-slate-400">Value node count:</span>{' '}
                        {activeRule.value_group_ids?.length ?? 0}
                      </div>
                      <div>
                        <span className="text-slate-400">Glyph node count:</span>{' '}
                        {activeRule.device_group_ids.length + activeRule.image_selectors.length}
                      </div>
                      <div>
                        <span className="text-slate-400">Confidence:</span> {activeRule.confidence.toFixed(2)}
                      </div>
                      <div>
                        <span className="text-slate-400">Manual review:</span>{' '}
                        {alias ? String(alias.manual_review_required) : 'unknown'}
                      </div>
                      <div>
                        <span className="text-slate-400">Alias role:</span>{' '}
                        {alias?.estimator_point_role || 'n/a'}
                      </div>
                      <div>
                        <span className="text-slate-400">Alias confidence:</span>{' '}
                        {alias ? alias.confidence.toFixed(2) : 'n/a'}
                      </div>
                      <div>
                        <span className="text-slate-400">Alias ontology:</span>{' '}
                        {alias?.candidate_ontology_id || 'n/a'}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300">
                <div className="mb-2 font-semibold uppercase tracking-[0.18em] text-slate-400">Notes</div>
                <ul className="space-y-2 leading-5">
                  {template.notes.map((note) => (
                    <li key={note}>- {note}</li>
                  ))}
                </ul>
                <div className="mt-4 text-slate-400">
                  Replacement ready: <span className="font-semibold text-slate-200">{String(template.replacement_ready)}</span>
                </div>
                <div className="mt-4 grid gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="font-semibold uppercase tracking-[0.18em] text-slate-400">Debug metadata</div>
                  <div className="text-slate-300">Normalized path: {template.normalized_template_path}</div>
                  <div className="text-slate-300">Asset base: {template.asset_base_path}</div>
                  <div className="text-slate-300">Point manifest: {template.point_manifest_path}</div>
                  <div className="text-slate-300">Visibility manifest: {template.visibility_manifest_path}</div>
                  <div className="text-slate-300">Ontology ids: {template.supported_ontology_ids.length}</div>
                  <div className="text-slate-300">Unmapped points: {template.unmapped_source_points.length}</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-1 break-all text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}
