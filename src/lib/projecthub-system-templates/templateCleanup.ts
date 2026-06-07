import type {
  ProjectHubSystemTemplateCleanupRule,
  ProjectHubSystemTemplateVisibilityRule,
} from './types';

export type ProjectHubTemplateCleanupDiagnosticsRule = {
  rule_id: string;
  matched_node_count: number;
  hidden_node_count: number;
  selector_count: number;
  text_match_count: number;
  attribute_match_count: number;
};

export type ProjectHubTemplateCleanupDiagnostics = {
  rule_count: number;
  matched_node_count: number;
  hidden_node_count: number;
  rules: ProjectHubTemplateCleanupDiagnosticsRule[];
};

export type ProjectHubTemplateCleanupLabelSample = {
  label: string;
  textContent: string | null;
  closestSvgId: string | null;
  closestGroupId: string | null;
  closestDataFilterAncestor: string | null;
  closestShortNameAncestor: string | null;
  closestSnameAncestor: string | null;
  closestClass: string | null;
  computedFill: string | null;
  computedDisplay: string | null;
  computedVisibility: string | null;
  computedOpacity: string | null;
  targetedForHiding: boolean;
  insideCleanupRoot: boolean;
};

export type ProjectHubTemplateCleanupDebugSnapshot = {
  templateId: string | null;
  selectedSourceShortNames: string[];
  cleanupMode: 'selected_points_only' | 'cleanup_only' | 'none';
  cleanupRootFound: boolean;
  totalTextNodes: number;
  visibleKnownPointLabels: string[];
  visibleUnselectedKnownPointLabels: string[];
  visibleSelectedGlyphs: string[];
  visibleUnselectedGlyphs: string[];
  hiddenGlyphCount: number;
  hiddenNodeCount: number;
  sampleLabels: ProjectHubTemplateCleanupLabelSample[];
};

export type ProjectHubTemplatePointPresentationItem = {
  selection_id: string;
  display_label: string;
  mapped_source_short_name: string | null;
  template_node_ids: string[];
  confidence: number;
  estimator_role: string | null;
  reason?: 'no_template_alias' | 'alias_has_no_node' | 'manual_review_required' | 'intentionally_panel_only';
  ontology_id?: string | null;
};

export type ProjectHubTemplateSelectedEstimatorItem = {
  selection_id: string;
  display_label: string;
  estimator_role: string | null;
  ontology_id: string | null;
  mapped_source_short_names: string[];
  confidence: number;
};

export type ProjectHubTemplatePointPresentation = {
  selected_estimator_items: ProjectHubTemplatePointPresentationItem[];
  represented: ProjectHubTemplatePointPresentationItem[];
  additional: ProjectHubTemplatePointPresentationItem[];
  dropped_selected_items: ProjectHubTemplatePointPresentationItem[];
};

export type ProjectHubTemplateVisibilityResult = {
  selected_template_keys: string[];
  visible_template_keys: string[];
  visible_label_keys: string[];
  visible_glyph_keys: string[];
  visible_unselected_glyphs: string[];
  hidden_label_count: number;
  hidden_glyph_count: number;
};

export type ProjectHubTemplateCleanupOptions = {
  revealCleanupNodes?: boolean;
  hideUnlinkedPointGroups?: boolean;
  selectedPointsOnly?: boolean;
  selectedSelectionIds?: string[];
  selectedSourceShortNames?: string[];
  selectedTemplateKeys?: string[];
  preserveLabels?: string[];
  templateId?: string;
};

const CLEANUP_HIDDEN_CLASS = 'projecthub-template-cleanup-hidden';

/**
 * Shared DOM-query helpers for the template renderer.
 *
 * These are intentionally framework-agnostic (no React, no template-specific
 * business rules) so that `ProjectHubTemplateGraphicPanel` (estimator runtime)
 * and `SystemTemplatePreview` (internal QA preview) can both consume the same
 * matching logic instead of maintaining copy-pasted selector code that drifts
 * out of sync over time.
 */

export function matchesAnySelector(node: Element, selectors: string[] | undefined) {
  return Boolean(selectors?.some((selector) => {
    try {
      return node.matches(selector);
    } catch {
      return false;
    }
  }));
}

export function findCleanupContainer(root: ParentNode, startNode: Element, ancestorSelectors?: string[]) {
  let current: Element | null = startNode;
  while (current && root.contains(current)) {
    if (matchesAnySelector(current, ancestorSelectors)) {
      return current;
    }
    if (/^(g|svg|foreignobject|div|rect)$/i.test(current.tagName)) {
      return current;
    }
    current = current.parentElement;
  }
  return startNode;
}

export function addMatchedNodes(root: ParentNode, selector: string, nodes: Set<Element>) {
  root.querySelectorAll(selector).forEach((node) => nodes.add(node));
}

export function addAttributeMatchedNodes(root: ParentNode, rule: ProjectHubSystemTemplateCleanupRule, nodes: Set<Element>) {
  rule.attribute_matches?.forEach(({ name, contains }) => {
    const selector = `[${name}*="${contains.replace(/"/g, '\\"')}"]`;
    addMatchedNodes(root, selector, nodes);
  });
}

/**
 * Resolves the DOM nodes that a single point-visibility rule refers to.
 *
 * Prefer `label_group_ids` / `device_group_ids` / `related_node_ids` (exact,
 * instance-specific node ids resolved at import time) over `image_selectors`
 * and `fallback_selectors` (broad CSS selectors). Broad selectors are a known
 * collision risk when a template contains repeated glyph families (see
 * `tools/template-import/output/mixed_air_instance_mapping_audit.md`).
 */
export function collectRuleNodes(root: ParentNode, rule: ProjectHubSystemTemplateVisibilityRule) {
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
  addMatchedNodes(root, `g[data-filter="${sourceShortName}"], g[short-name="${sourceShortName}"]`, nodes);
  addMatchedNodes(root, `use[key-data-attr*="pointShortName':'${sourceShortName}'"]`, nodes);
  addMatchedNodes(root, `use[key-data-attr*="pointShortName:\\"${sourceShortName}\\""]`, nodes);

  return nodes;
}

/**
 * Records that a DOM node participates in one or more estimator selections.
 * Multiple visibility rules can resolve to the same node (e.g. a glyph shared
 * between a label group and a device group); this keeps the full set so
 * `data-template-point-selected` reflects "selected by any rule", not just the
 * most recently processed one.
 */
export function appendSelectionIds(node: Element, selectionId: string) {
  const current = node.getAttribute('data-template-selection-ids');
  const values = new Set<string>(
    (current ? current.split(',') : [])
      .map((value) => value.trim())
      .filter(Boolean)
  );
  values.add(selectionId);
  node.setAttribute('data-template-selection-ids', [...values].join(','));
}

export function collectCleanupNodes(root: ParentNode, rule: ProjectHubSystemTemplateCleanupRule) {
  const nodes = new Set<Element>();

  rule.selectors?.forEach((selector) => addMatchedNodes(root, selector, nodes));
  addAttributeMatchedNodes(root, rule, nodes);

  rule.text_matches?.forEach((textMatch) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      const textNode = current as Text;
      if (textNode.textContent?.toUpperCase().includes(textMatch.toUpperCase())) {
        const parent = textNode.parentElement;
        if (parent) {
          nodes.add(findCleanupContainer(root, parent, rule.ancestor_selectors));
        }
      }
      current = walker.nextNode();
    }
  });

  const resolvedNodes = new Set<Element>();
  nodes.forEach((node) => {
    const container = findCleanupContainer(root, node, rule.ancestor_selectors);
    resolvedNodes.add(container);

    if (rule.hide_descendants) {
      container.querySelectorAll('*').forEach((descendant) => resolvedNodes.add(descendant));
    }
  });

  return resolvedNodes;
}

function setNodeHidden(node: Element, hidden: boolean) {
  const styledNode = node as SVGElement | HTMLElement;
  styledNode.classList.toggle(CLEANUP_HIDDEN_CLASS, hidden);
  styledNode.style.display = hidden ? 'none' : '';
  styledNode.style.opacity = hidden ? '0' : '';
  styledNode.style.pointerEvents = hidden ? 'none' : '';
  styledNode.style.visibility = hidden ? 'hidden' : '';
  styledNode.setAttribute('aria-hidden', hidden ? 'true' : 'false');

  if (hidden) {
    styledNode.setAttribute('data-template-cleanup-hidden', 'true');
  } else {
    styledNode.removeAttribute('data-template-cleanup-hidden');
  }
}

function getSelectionIds(node: Element) {
  const raw = node.getAttribute('data-template-selection-ids');
  if (!raw) {
    const single = node.getAttribute('data-template-selection-id');
    return single ? [single] : [];
  }
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function setSelectionMetadata(node: Element, selectedIds: Set<string>) {
  const styledNode = node as SVGElement | HTMLElement;
  const ids = [...new Set(getSelectionIds(node))];
  if (ids.length) {
    styledNode.setAttribute('data-template-selection-ids', ids.join(','));
    styledNode.setAttribute('data-template-point-selected', String(ids.some((id) => selectedIds.has(id))));
  }
}

function normalizeLabel(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function buildPresentationItem(
  selectionId: string,
  displayLabel: string,
  mappedSourceShortName: string | null,
  templateNodeIds: string[],
  confidence: number,
  estimatorRole: string | null,
  reason?: ProjectHubTemplatePointPresentationItem['reason'],
  ontologyId?: string | null
): ProjectHubTemplatePointPresentationItem {
  return {
    selection_id: selectionId,
    display_label: displayLabel,
    mapped_source_short_name: mappedSourceShortName,
    template_node_ids: templateNodeIds,
    confidence,
    estimator_role: estimatorRole,
    reason,
    ontology_id: ontologyId ?? null,
  };
}

export function resolveTemplatePointPresentation(
  selectedEstimatorItems: ProjectHubTemplateSelectedEstimatorItem[],
  visibilityResult: ProjectHubTemplateVisibilityResult
): ProjectHubTemplatePointPresentation {
  const visibleTemplateKeys = new Set([
    ...visibilityResult.visible_template_keys,
    ...visibilityResult.visible_glyph_keys,
  ]);
  const presentedItems: ProjectHubTemplatePointPresentationItem[] = [];
  const represented: ProjectHubTemplatePointPresentationItem[] = [];
  const additional: ProjectHubTemplatePointPresentationItem[] = [];
  const droppedSelectedItems: ProjectHubTemplatePointPresentationItem[] = [];

  selectedEstimatorItems.forEach((item) => {
    const mappedKeys = [...new Set(item.mapped_source_short_names)];
    const matchedKeys = mappedKeys.filter((key) => visibleTemplateKeys.has(key));
    const presentationItem = buildPresentationItem(
      item.selection_id,
      item.display_label,
      mappedKeys[0] ?? null,
      matchedKeys,
      item.confidence,
      item.estimator_role,
      matchedKeys.length ? undefined : (mappedKeys.length ? 'alias_has_no_node' : 'no_template_alias'),
      item.ontology_id
    );

    presentedItems.push(presentationItem);
    if (matchedKeys.length) {
      represented.push(presentationItem);
      return;
    }

    additional.push(presentationItem);
  });

  return {
    selected_estimator_items: presentedItems,
    represented,
    additional,
    dropped_selected_items: droppedSelectedItems,
  };
}

function getSelectionSourceShortName(node: Element) {
  return (
    node.getAttribute('data-template-source-short-name') ||
    node.getAttribute('data-filter') ||
    node.getAttribute('short-name') ||
    node.getAttribute('sname') ||
    node.getAttribute('data-shortname') ||
    ''
  ).trim();
}

export function isVisibleElement(node: Element) {
  const style = getComputedStyle(node);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function getKnownPointLabelSet(root: ParentNode) {
  const labels = new Set<string>();
  root.querySelectorAll('g.bas-floor-graphics-display-point, g[data-filter], g[short-name], g[sname]').forEach((node) => {
    const element = node as Element;
    const labelCandidates = [
      element.getAttribute('data-template-source-short-name'),
      element.getAttribute('data-filter'),
      element.getAttribute('short-name'),
      element.getAttribute('sname'),
      element.getAttribute('data-shortname'),
      normalizeLabel(element.textContent ?? ''),
    ]
      .map((value) => normalizeLabel(value ?? ''))
      .filter(Boolean);
    labelCandidates.forEach((label) => labels.add(label));
  });
  return labels;
}

function hideExactLabels(root: ParentNode, labels: string[]) {
  const matched = new Set<Element>();
  const normalizedLabels = labels.map((label) => normalizeLabel(label));

  root.querySelectorAll('text, tspan, g, use, image, svg').forEach((node) => {
    const element = node as Element;
    const text = normalizeLabel(element.textContent ?? '');
    const dataFilter = normalizeLabel(element.getAttribute('data-filter') ?? '');
    const shortName = normalizeLabel(element.getAttribute('short-name') ?? '');
    const sname = normalizeLabel(element.getAttribute('sname') ?? '');
    const sourceShortName = normalizeLabel(element.getAttribute('data-template-source-short-name') ?? '');
    if (!text && !dataFilter && !shortName && !sname && !sourceShortName) return;

    if (normalizedLabels.some((label) => label === text || label === dataFilter || label === shortName || label === sname || label === sourceShortName)) {
      const container = findCleanupContainer(root, element);
      matched.add(container);
      if (element !== container) matched.add(element);
    }
  });

  matched.forEach((node) => setNodeHidden(node, true));
  return matched.size;
}

function hidePatternLabels(root: ParentNode, pattern: RegExp, ancestorSelectors?: string[]) {
  const matched = new Set<Element>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();

  while (current) {
    const textNode = current as Text;
    const text = normalizeLabel(textNode.textContent ?? '');
    if (text && pattern.test(text)) {
      const parent = textNode.parentElement;
      if (parent) {
        matched.add(findCleanupContainer(root, parent, ancestorSelectors));
      }
    }
    current = walker.nextNode();
  }

  root.querySelectorAll('g[data-filter], g[short-name], g[sname], text, tspan, use, image').forEach((node) => {
    const element = node as Element;
    const candidates = [
      element.textContent,
      element.getAttribute('data-filter'),
      element.getAttribute('short-name'),
      element.getAttribute('sname'),
      element.getAttribute('data-shortname'),
      element.getAttribute('data-template-source-short-name'),
    ]
      .map((value) => normalizeLabel(value ?? ''))
      .filter(Boolean);

    if (candidates.some((value) => pattern.test(value))) {
      matched.add(findCleanupContainer(root, element, ancestorSelectors));
    }
  });

  matched.forEach((node) => {
    setNodeHidden(node, true);
  });

  return matched.size;
}

function hideExactSelectors(root: ParentNode, selectors: string[]) {
  const matched = new Set<Element>();

  selectors.forEach((selector) => {
    root.querySelectorAll(selector).forEach((node) => matched.add(node as Element));
  });

  matched.forEach((node) => setNodeHidden(node, true));
  return matched.size;
}

function setReadableLabelStyles(node: Element) {
  const styledNode = node as SVGElement | HTMLElement;
  styledNode.style.setProperty('fill', '#111827', 'important');
  styledNode.style.setProperty('color', '#111827', 'important');
  styledNode.style.setProperty('opacity', '1', 'important');
  styledNode.style.setProperty('visibility', 'visible', 'important');
  styledNode.style.setProperty('display', '', 'important');
  styledNode.style.setProperty('stroke', 'none', 'important');
  styledNode.style.setProperty('filter', 'none', 'important');

  if (styledNode instanceof SVGElement) {
    styledNode.setAttribute('fill', '#111827');
  }
}

export function ensureSelectedPointLabelReadability(
  root: ParentNode,
  selectedSourceShortNames: string[]
) {
  const selected = new Set(selectedSourceShortNames.map((label) => normalizeLabel(label)));
  let styledCount = 0;

  root.querySelectorAll('g.bas-floor-graphics-display-point, g[data-filter], g[short-name], g[sname]').forEach((node) => {
    const element = node as Element;
    if (!isVisibleElement(element)) return;

    const sourceShortName = normalizeLabel(getSelectionSourceShortName(element));
    const selectedByAttribute = element.getAttribute('data-template-point-selected') === 'true';
    const selectedByLookup = Boolean(sourceShortName && selected.has(sourceShortName));
    if (!selectedByAttribute && !selectedByLookup) return;

    const targets = new Set<Element>([
      element,
      ...Array.from(element.querySelectorAll('text, tspan')),
    ]);

    targets.forEach((target) => {
      setReadableLabelStyles(target);
      styledCount += 1;
    });

    element.setAttribute('data-template-label-readable', 'true');
  });

  return styledCount;
}

function findClosestMatchingAncestor(node: Element, selectors: string[]) {
  return selectors.reduce<Element | null>((current, selector) => {
    if (current) return current;
    let cursor: Element | null = node;
    while (cursor) {
      try {
        if (cursor.matches(selector)) return cursor;
      } catch {
        return current;
      }
      cursor = cursor.parentElement;
    }
    return current;
  }, null);
}

function getLabelSample(root: ParentNode, label: string): ProjectHubTemplateCleanupLabelSample {
  const escaped = label.replace(/"/g, '\\"');
  const candidates = [
    ...root.querySelectorAll(`text, tspan, g, use, image, svg`),
  ].filter((node): node is Element => Boolean(node));

  const direct = candidates.find((node) => {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    const filter = node.getAttribute('data-filter') ?? '';
    const shortName = node.getAttribute('short-name') ?? '';
    const sname = node.getAttribute('sname') ?? '';
    return text === label || filter === label || shortName === label || sname === label || node.getAttribute('data-template-source-short-name') === label;
  }) || null;

  const foundNode = direct || root.querySelector(`[data-filter="${escaped}"], [short-name="${escaped}"], [sname="${escaped}"]`);
  const element = foundNode instanceof Element ? foundNode : null;
  const parent = element?.parentElement ?? null;
  const closestSvg = element?.closest('svg') ?? null;
  const closestDataFilterAncestor = element ? findClosestMatchingAncestor(element, ['[data-filter]']) : null;
  const closestShortNameAncestor = element ? findClosestMatchingAncestor(element, ['[short-name]']) : null;
  const closestSnameAncestor = element ? findClosestMatchingAncestor(element, ['[sname]']) : null;
  const closestGroup = element ? element.closest('g') : null;
  const target = element ?? parent;
  const computed = target ? getComputedStyle(target) : null;

  const insideCleanupRoot = Boolean(element && root.contains(element));
  const targetedForHiding = Boolean(
    element?.getAttribute('data-template-cleanup-hidden') === 'true' ||
    element?.classList.contains(CLEANUP_HIDDEN_CLASS) ||
    (computed && computed.display === 'none')
  );

  return {
    label,
    textContent: element?.textContent?.trim() ?? null,
    closestSvgId: closestSvg?.id ?? null,
    closestGroupId: closestGroup?.id ?? null,
    closestDataFilterAncestor: closestDataFilterAncestor?.getAttribute('data-filter') ?? null,
    closestShortNameAncestor: closestShortNameAncestor?.getAttribute('short-name') ?? null,
    closestSnameAncestor: closestSnameAncestor?.getAttribute('sname') ?? null,
    closestClass: element?.getAttribute('class') ?? target?.getAttribute?.('class') ?? null,
    computedFill: computed?.fill ?? null,
    computedDisplay: computed?.display ?? null,
    computedVisibility: computed?.visibility ?? null,
    computedOpacity: computed?.opacity ?? null,
    targetedForHiding,
    insideCleanupRoot,
  };
}

function hideUnlinkedPointGroups(root: ParentNode) {
  const nodes = root.querySelectorAll('g[data-filter], g[short-name], g[sname]');
  nodes.forEach((node) => {
    if (node.hasAttribute('data-template-selection-id') || node.querySelector('[data-template-selection-id]')) return;
    setNodeHidden(node, true);
    node.setAttribute('data-template-point-unlinked', 'true');
  });
  return nodes.length;
}

function applySelectedPointsOnly(
  root: ParentNode,
  selectedSelectionIds: Set<string>,
  selectedTemplateKeys: Set<string>,
  preserveLabels: Set<string>
) : ProjectHubTemplateVisibilityResult {
  const pointGroups = root.querySelectorAll('g.bas-floor-graphics-display-point, g[data-filter], g[short-name], g[sname]');
  const knownPointLabels = getKnownPointLabelSet(root);
  let hiddenLabelCount = 0;
  let hiddenGlyphCount = 0;

  pointGroups.forEach((node) => {
    const exactSourceShortName = getSelectionSourceShortName(node);
    const exactSelectionIds = getSelectionIds(node);
    const shouldShow = Boolean(
      exactSourceShortName &&
      (selectedTemplateKeys.has(exactSourceShortName) ||
        selectedSelectionIds.has(exactSourceShortName) ||
        exactSelectionIds.some((selectionId) => selectedSelectionIds.has(selectionId)))
    );

    setNodeHidden(node, !shouldShow);
    setSelectionMetadata(node, selectedSelectionIds);
  });

  root.querySelectorAll('[data-template-selection-id], [data-template-selection-ids]').forEach((node) => {
    const element = node as Element;
    const exactSelectionIds = getSelectionIds(element);
    const exactSourceShortName = getSelectionSourceShortName(element);
    const shouldShow = Boolean(
      exactSelectionIds.some((selectionId) => selectedSelectionIds.has(selectionId)) ||
      (exactSourceShortName && (selectedTemplateKeys.has(exactSourceShortName) || selectedSelectionIds.has(exactSourceShortName)))
    );

    setNodeHidden(element, !shouldShow);
    setSelectionMetadata(element, selectedSelectionIds);

    if (!shouldShow) {
      hiddenGlyphCount += 1;
    }
  });

  root.querySelectorAll('text, tspan').forEach((node) => {
    const element = node as Element;
    const text = normalizeLabel(element.textContent ?? '');
    if (!text || preserveLabels.has(text) || !knownPointLabels.has(text)) return;

    const shouldShow = selectedSelectionIds.has(text) || selectedTemplateKeys.has(text);
    setNodeHidden(element, !shouldShow);
    if (!shouldShow) hiddenLabelCount += 1;
  });

  const visibleTemplateKeys = [...new Set(
    [...pointGroups]
      .filter((node) => isVisibleElement(node as Element))
      .map((node) => normalizeLabel(getSelectionSourceShortName(node as Element) || (node as Element).textContent || ''))
      .filter(Boolean)
  )];

  const visibleLabelKeys = [...new Set(
    [...root.querySelectorAll('text.graphics-point-label, text.graphics-point-value, text.graphics-point-notfound')]
      .filter((node) => isVisibleElement(node as Element))
      .map((node) => normalizeLabel((node as Element).textContent || ''))
      .filter(Boolean)
  )];

  const visibleGlyphKeys = [...new Set(
    [...root.querySelectorAll('[data-template-selection-id], [data-template-selection-ids]')]
      .filter((node) => isVisibleElement(node as Element))
      .map((node) => normalizeLabel(getSelectionSourceShortName(node as Element) || (node as Element).textContent || ''))
      .filter(Boolean)
  )];

  const visibleUnselectedGlyphs = [...new Set(
    [...root.querySelectorAll('[data-template-selection-id], [data-template-selection-ids]')]
      .filter((node) => isVisibleElement(node as Element))
      .filter((node) => {
        const element = node as Element;
        const exactSelectionIds = getSelectionIds(element);
        const exactSourceShortName = getSelectionSourceShortName(element);
        return !(
          exactSelectionIds.some((selectionId) => selectedSelectionIds.has(selectionId)) ||
          (exactSourceShortName && (selectedTemplateKeys.has(exactSourceShortName) || selectedSelectionIds.has(exactSourceShortName)))
        );
      })
      .map((node) => normalizeLabel(getSelectionSourceShortName(node as Element) || (node as Element).textContent || ''))
      .filter(Boolean)
  )];

  return {
    selected_template_keys: [...selectedTemplateKeys],
    visible_template_keys: visibleTemplateKeys,
    visible_label_keys: visibleLabelKeys,
    visible_glyph_keys: visibleGlyphKeys,
    visible_unselected_glyphs: visibleUnselectedGlyphs,
    hidden_label_count: hiddenLabelCount,
    hidden_glyph_count: hiddenGlyphCount,
  };
}

export function applyTemplateVisibility(
  root: ParentNode,
  selectedTemplateKeys: Set<string>,
  selectedSelectionIds: Set<string>,
  preserveLabels: Set<string>
) {
  return applySelectedPointsOnly(root, selectedSelectionIds, selectedTemplateKeys, preserveLabels);
}

export function applyTemplateCleanupRules(
  root: ParentNode,
  cleanupRules: ProjectHubSystemTemplateCleanupRule[],
  options: ProjectHubTemplateCleanupOptions = {}
): ProjectHubTemplateCleanupDiagnostics {
  const revealCleanupNodes = options.revealCleanupNodes ?? false;
  const selectedSelectionIds = new Set(options.selectedSelectionIds ?? []);
  const diagnostics: ProjectHubTemplateCleanupDiagnostics = {
    rule_count: 0,
    matched_node_count: 0,
    hidden_node_count: 0,
    rules: [],
  };

  const matchedNodes = new Set<Element>();

  cleanupRules.forEach((rule) => {
    if (rule.mode !== 'hide') return;

    const nodes = collectCleanupNodes(root, rule);
    diagnostics.rule_count += 1;
    diagnostics.rules.push({
      rule_id: rule.rule_id,
      matched_node_count: nodes.size,
      hidden_node_count: revealCleanupNodes ? 0 : nodes.size,
      selector_count: rule.selectors?.length ?? 0,
      text_match_count: rule.text_matches?.length ?? 0,
      attribute_match_count: rule.attribute_matches?.length ?? 0,
    });

    nodes.forEach((node) => {
      matchedNodes.add(node);
      setNodeHidden(node, !revealCleanupNodes);
    });
  });

  diagnostics.matched_node_count = matchedNodes.size;
  diagnostics.hidden_node_count = revealCleanupNodes ? 0 : matchedNodes.size;

  if (root instanceof Element) {
    root.setAttribute('data-template-cleanup-rule-count', String(diagnostics.rule_count));
    root.setAttribute('data-template-cleanup-matched-count', String(diagnostics.matched_node_count));
    root.setAttribute('data-template-cleanup-hidden-count', String(diagnostics.hidden_node_count));
  }

  if (options.hideUnlinkedPointGroups) {
    const hiddenCount = hideUnlinkedPointGroups(root);
    if (root instanceof Element) {
      root.setAttribute('data-template-unlinked-hidden-count', String(hiddenCount));
    }
  }

  if (options.selectedPointsOnly) {
    const selectedDiagnostics = applyTemplateVisibility(
      root,
      new Set(options.selectedTemplateKeys ?? options.selectedSourceShortNames ?? []),
      selectedSelectionIds,
      new Set((options.preserveLabels ?? []).map((label) => normalizeLabel(label)))
    );
    if (root instanceof Element) {
      root.setAttribute('data-template-selected-visible-count', String(selectedDiagnostics.visible_template_keys.length));
      root.setAttribute('data-template-selected-hidden-label-count', String(selectedDiagnostics.hidden_label_count));
      root.setAttribute('data-template-selected-hidden-glyph-count', String(selectedDiagnostics.hidden_glyph_count));
    }

    ensureSelectedPointLabelReadability(root, [...new Set(options.selectedTemplateKeys ?? options.selectedSourceShortNames ?? [])]);

    const softwareHiddenCount = hidePatternLabels(
      root,
      /(^|\b)[A-Z0-9_-]+-SP(\b|$)/i,
      ['g.bas-floor-graphics-display-point', 'g[data-filter]', 'g[short-name]', 'g[sname]', 'svg']
    );
    if (root instanceof Element) {
      root.setAttribute('data-template-software-point-hidden-count', String(softwareHiddenCount));
    }
  }

  if (options.templateId === 'mixed_air_single_duct') {
    const hiddenCount = hideExactLabels(root, ['BLDG-P', 'BLDG-SP']);
    const backgroundHiddenCount = hideExactSelectors(root, [
      '#svg_616',
      'g[custom-temp-title="Background"] #svg_616',
      'g[custom-temp-title="Background"] > g#svg_516 > rect#svg_616',
    ]);
    if (root instanceof Element) {
      root.setAttribute('data-template-mixed-air-bldg-hidden-count', String(hiddenCount));
      root.setAttribute('data-template-mixed-air-bldg-background-hidden-count', String(backgroundHiddenCount));
    }
  }

  return diagnostics;
}

export function buildTemplateCleanupDebugSnapshot(
  root: ParentNode | null,
  cleanupRules: ProjectHubSystemTemplateCleanupRule[],
  options: ProjectHubTemplateCleanupOptions = {}
): ProjectHubTemplateCleanupDebugSnapshot {
  const selectedSelectionIds = new Set(options.selectedSelectionIds ?? []);
  const selectedSourceShortNames = [...new Set(options.selectedSourceShortNames ?? [])];
  const cleanupRootFound = Boolean(root);
  const totalTextNodes = root ? (() => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let count = 0;
    let current = walker.nextNode();
    while (current) {
      if ((current.textContent ?? '').trim()) count += 1;
      current = walker.nextNode();
    }
    return count;
  })() : 0;

  const knownPointLabels = root
    ? [...root.querySelectorAll('g[data-filter], g[short-name], g[sname]')]
        .map((node) => (node.getAttribute('data-filter') || node.getAttribute('short-name') || node.getAttribute('sname') || '').trim())
        .filter(Boolean)
    : [];

  const visibleKnownPointLabels = [...new Set(
    root
      ? knownPointLabels.filter((label) => {
          const target = root.querySelector(`[data-filter="${label.replace(/"/g, '\\"')}"], [short-name="${label.replace(/"/g, '\\"')}"], [sname="${label.replace(/"/g, '\\"')}"]`);
          return Boolean(target && isVisibleElement(target as Element));
        })
      : []
  )];

  const visibleUnselectedKnownPointLabels = [...new Set(
    root
      ? knownPointLabels.filter((label) => {
          const isSelected = selectedSelectionIds.has(label) || selectedSourceShortNames.includes(label);
          const target = root.querySelector(`[data-filter="${label.replace(/"/g, '\\"')}"], [short-name="${label.replace(/"/g, '\\"')}"], [sname="${label.replace(/"/g, '\\"')}"]`);
          return !isSelected && Boolean(target && isVisibleElement(target as Element));
        })
      : []
  )];

  const glyphNodes = root
    ? [...root.querySelectorAll('[data-template-selection-id], [data-template-selection-ids]')].filter((node): node is Element => Boolean(node))
    : [];

  const visibleSelectedGlyphs = [...new Set(
    glyphNodes
      .filter((node) => isVisibleElement(node))
      .filter((node) => {
        const selectionIds = getSelectionIds(node);
        const sourceShortName = getSelectionSourceShortName(node);
        return selectionIds.some((id) => selectedSelectionIds.has(id)) || (sourceShortName && selectedSourceShortNames.includes(sourceShortName));
      })
      .map((node) => normalizeLabel(node.getAttribute('data-template-source-short-name') || node.getAttribute('data-filter') || node.getAttribute('short-name') || node.getAttribute('sname') || node.textContent || ''))
      .filter(Boolean)
  )];

  const visibleUnselectedGlyphs = [...new Set(
    glyphNodes
      .filter((node) => isVisibleElement(node))
      .filter((node) => {
        const selectionIds = getSelectionIds(node);
        const sourceShortName = getSelectionSourceShortName(node);
        return !(selectionIds.some((id) => selectedSelectionIds.has(id)) || (sourceShortName && selectedSourceShortNames.includes(sourceShortName)));
      })
      .map((node) => normalizeLabel(node.getAttribute('data-template-source-short-name') || node.getAttribute('data-filter') || node.getAttribute('short-name') || node.getAttribute('sname') || node.textContent || ''))
      .filter(Boolean)
  )];

  const sampleLabels = ['RF-O', 'PH-POS', 'DAT-SP', 'PHWL-T', 'MOAD-C', 'BLDG-P'].map((label) =>
    root ? getLabelSample(root, label) : {
      label,
      textContent: null,
      closestSvgId: null,
      closestGroupId: null,
      closestDataFilterAncestor: null,
      closestShortNameAncestor: null,
      closestSnameAncestor: null,
      closestClass: null,
      computedFill: null,
      computedDisplay: null,
      computedVisibility: null,
      computedOpacity: null,
      targetedForHiding: false,
      insideCleanupRoot: false,
    }
  );

  return {
    templateId: options.templateId ?? null,
    selectedSourceShortNames,
    cleanupMode: options.selectedPointsOnly ? 'selected_points_only' : (cleanupRules.length ? 'cleanup_only' : 'none'),
    cleanupRootFound,
    totalTextNodes,
    visibleKnownPointLabels,
    visibleUnselectedKnownPointLabels,
    visibleSelectedGlyphs,
    visibleUnselectedGlyphs,
    hiddenGlyphCount: root ? root.querySelectorAll('[data-template-selection-id], [data-template-selection-ids]').length - visibleSelectedGlyphs.length : 0,
    hiddenNodeCount: root ? root.querySelectorAll(`.${CLEANUP_HIDDEN_CLASS}`).length : 0,
    sampleLabels,
  };
}

export function installTemplateCleanupObserver(
  root: ParentNode,
  cleanupRules: ProjectHubSystemTemplateCleanupRule[],
  options: ProjectHubTemplateCleanupOptions = {}
) {
  const target = root instanceof Element ? root : null;
  if (!target || typeof MutationObserver === 'undefined') {
    applyTemplateCleanupRules(root, cleanupRules, options);
    return () => {};
  }

  let frame = 0;
  const run = () => {
    frame = 0;
    applyTemplateCleanupRules(root, cleanupRules, options);
  };
  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(run);
  };

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
      schedule();
    }
  });

  observer.observe(target, {
    childList: true,
    subtree: true,
  });

  applyTemplateCleanupRules(root, cleanupRules, options);

  return () => {
    observer.disconnect();
    if (frame) {
      window.cancelAnimationFrame(frame);
    }
  };
}
