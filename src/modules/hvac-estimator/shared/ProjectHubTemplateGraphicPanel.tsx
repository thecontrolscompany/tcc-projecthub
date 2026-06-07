'use client';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import type {
  ProjectHubSystemTemplateVisibilityRule,
  ProjectHubTemplateGraphicPackage,
} from '@/lib/projecthub-system-templates/types';
import {
  buildTemplateCleanupDebugSnapshot,
  ensureSelectedPointLabelReadability,
  installTemplateCleanupObserver,
  applyTemplateVisibility,
  addMatchedNodes,
  appendSelectionIds,
  collectCleanupNodes,
  collectRuleNodes,
  findCleanupContainer,
  isVisibleElement,
  type ProjectHubTemplateSelectedEstimatorItem,
  type ProjectHubTemplatePointPresentation,
  resolveTemplatePointPresentation,
} from '@/lib/projecthub-system-templates/templateCleanup';
import { isProjectHubTemplateGraphicsPreviewEnabled } from './projecthubTemplateGraphics';

type Props = {
  templateId: string;
  selectedOntologyIds: string[];
  selectedSelectionIds?: string[];
  selectedSelectionLabelsById?: Record<string, string>;
  selectedSelectionRolesById?: Record<string, string>;
  selectedTemplateKeysBySelectionId?: Record<string, string[]>;
  fallback: ReactNode;
  className?: string;
};

const PRESERVE_LABELS = ['OA', 'RA', 'EA', 'DA', 'CWS', 'CWR', 'CHWS', 'CHWR', 'CHWS-T', 'OA Min'];

type TemplateDebugSnapshot = ReturnType<typeof buildTemplateCleanupDebugSnapshot>;

type TemplateDebugState = {
  mounted: boolean;
  templateId: string;
  cleanupMode: 'selected_points_only';
  selectedSelectionIds: string[];
  selectedSourceShortNames: string[];
  visibility: {
    selectedTemplateKeys: string[];
    visibleTemplateKeys: string[];
    visibleLabelKeys: string[];
    visibleGlyphKeys: string[];
    hiddenGlyphCount: number;
    visibleUnselectedGlyphs: string[];
  };
  presentation: {
    selectedEstimatorItems: ProjectHubTemplateSelectedEstimatorItem[];
    representedItems: ProjectHubTemplatePointPresentation['represented'];
    additionalItems: ProjectHubTemplatePointPresentation['additional'];
    droppedSelectedItems: ProjectHubTemplatePointPresentation['dropped_selected_items'];
  };
  selectedEstimatorItems: ProjectHubTemplateSelectedEstimatorItem[];
  representedItems: ProjectHubTemplatePointPresentation['represented'];
  additionalItems: ProjectHubTemplatePointPresentation['additional'];
  droppedSelectedItems: ProjectHubTemplatePointPresentation['dropped_selected_items'];
  cleanupRootFound: boolean;
  cleanupRootTagName: string | null;
  beforeCleanup: TemplateDebugSnapshot | null;
  afterCleanup: TemplateDebugSnapshot | null;
};

type PanState = {
  x: number;
  y: number;
};

const EMPTY_STRING_ARRAY: string[] = [];
const EMPTY_STRING_RECORD: Record<string, string> = {};
const EMPTY_STRING_ARRAY_RECORD: Record<string, string[]> = {};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

type TemplateNodeProbe = {
  tagName: string;
  id: string | null;
  className: string | null;
  href: string | null;
  xlinkHref: string | null;
  closestSvgId: string | null;
  closestGroupId: string | null;
  closestSelectionIdAncestor: string | null;
  closestSelectionIdsAncestor: string | null;
  closestDataFilterAncestor: string | null;
  computedDisplay: string | null;
  computedVisibility: string | null;
  computedOpacity: string | null;
  insideCleanupRoot: boolean;
  visible: boolean;
};

function describeTemplateNode(root: ParentNode, node: Element): TemplateNodeProbe {
  const element = node as SVGElement | HTMLElement;
  const svg = node.closest('svg');
  const closestGroup = node.closest('g');
  const closestSelectionIdAncestor = node.closest('[data-template-selection-id]')?.getAttribute('data-template-selection-id') ?? null;
  const closestSelectionIdsAncestor = node.closest('[data-template-selection-ids]')?.getAttribute('data-template-selection-ids') ?? null;
  const closestDataFilterAncestor = node.closest('[data-filter]')?.getAttribute('data-filter') ?? null;
  const computed = getComputedStyle(element);
  const insideCleanupRoot = root instanceof Element || root instanceof Document
    ? root.contains(node)
    : false;

  return {
    tagName: node.tagName,
    id: node.id || null,
    className: node.getAttribute('class') || null,
    href: node.getAttribute('href') || null,
    xlinkHref: node.getAttribute('xlink:href') || null,
    closestSvgId: svg?.id ?? null,
    closestGroupId: closestGroup?.id ?? null,
    closestSelectionIdAncestor,
    closestSelectionIdsAncestor,
    closestDataFilterAncestor,
    computedDisplay: computed.display,
    computedVisibility: computed.visibility,
    computedOpacity: computed.opacity,
    insideCleanupRoot,
    visible: isVisibleElement(node),
  };
}

function collectVisibilityGlyphNodes(root: ParentNode, rule: ProjectHubSystemTemplateVisibilityRule) {
  const nodes = new Set<Element>();
  collectRuleNodes(root, rule).forEach((node) => nodes.add(node));
  return nodes;
}

function collectManualCleanupNodes(root: ParentNode, selectors: string[], textMatches: string[]) {
  const nodes = new Set<Element>();

  selectors.forEach((selector) => addMatchedNodes(root, selector, nodes));

  textMatches.forEach((textMatch) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      const textNode = current as Text;
      if (textNode.textContent?.toUpperCase().includes(textMatch.toUpperCase())) {
        const parent = textNode.parentElement;
        if (parent) {
          nodes.add(findCleanupContainer(root, parent));
        }
      }
      current = walker.nextNode();
    }
  });

  return nodes;
}

function setVisibility(node: Element, shouldShow: boolean, visibilityMode: ProjectHubSystemTemplateVisibilityRule['visibility_mode']) {
  const styledNode = node as SVGElement | HTMLElement;

  if (visibilityMode === 'hide_when_unselected') {
    styledNode.style.display = shouldShow ? '' : 'none';
    styledNode.style.opacity = shouldShow ? '1' : '0';
    styledNode.style.filter = shouldShow ? 'none' : 'grayscale(1) saturate(0.35)';
  } else {
    styledNode.style.display = '';
    styledNode.style.opacity = shouldShow ? '1' : '0.28';
    styledNode.style.filter = shouldShow ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.35))' : 'none';
  }

  styledNode.style.pointerEvents = shouldShow ? '' : 'none';
  styledNode.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
}

function isSoftwarePoint(sourceShortName: string) {
  return /-SP$/i.test(sourceShortName);
}

function isStagedHeatCoolPoint(sourceShortName: string) {
  return /^(PH|CLG|RH)\d*-C$/i.test(sourceShortName);
}

function isStagedHeatCoolText(value: string) {
  return /^(PH|CLG|RH)\d+-C$/i.test(value) || /\b(PH|CLG|RH)\d+-C\b/i.test(value);
}

function collectLabelNodesForSource(root: ParentNode, sourceShortName: string) {
  const escaped = sourceShortName.replace(/"/g, '\\"');
  const selectors = [
    `g[data-filter="${escaped}"]`,
    `g[short-name="${escaped}"]`,
    `g[sname="${escaped}"]`,
    `text.graphics-point-label[data-shortname="${escaped}"]`,
    `text.graphics-point-value[data-shortname="${escaped}"]`,
    `text.graphics-point-notfound[data-shortname="${escaped}"]`,
    `g[data-filter="${escaped}"] text.graphics-point-label`,
    `g[data-filter="${escaped}"] text.graphics-point-value`,
    `g[data-filter="${escaped}"] text.graphics-point-notfound`,
    `g[short-name="${escaped}"] text.graphics-point-label`,
    `g[short-name="${escaped}"] text.graphics-point-value`,
    `g[short-name="${escaped}"] text.graphics-point-notfound`,
    `g[sname="${escaped}"] text.graphics-point-label`,
    `g[sname="${escaped}"] text.graphics-point-value`,
    `g[sname="${escaped}"] text.graphics-point-notfound`,
  ];

  const nodes = new Set<Element>();
  selectors.forEach((selector) => addMatchedNodes(root, selector, nodes));
  return nodes;
}

function collectSoftwarePointNodes(root: ParentNode) {
  const nodes = new Set<Element>();
  root.querySelectorAll('text, tspan, g, use, image').forEach((node) => {
    const text = node.textContent?.toUpperCase() ?? '';
    const dataFilter = (node.getAttribute('data-filter') ?? '').toUpperCase();
    const shortName = (node.getAttribute('short-name') ?? node.getAttribute('sname') ?? node.getAttribute('data-shortname') ?? '').toUpperCase();
    const sourceShortName = (node.getAttribute('data-template-source-short-name') ?? '').toUpperCase();
    const candidates = [text, dataFilter, shortName, sourceShortName];

    if (candidates.some((value) => /(^|\b)[A-Z0-9_-]+-SP(\b|$)/i.test(value) || /\bBLDG-(P|SP)\b/i.test(value))) {
      nodes.add(node);
    }
  });
  return nodes;
}

function collectStagedHeatCoolNodes(root: ParentNode) {
  const nodes = new Set<Element>();
  root.querySelectorAll('text, tspan, g, use, image').forEach((node) => {
    const text = node.textContent?.toUpperCase() ?? '';
    const dataFilter = (node.getAttribute('data-filter') ?? '').toUpperCase();
    const shortName = (node.getAttribute('short-name') ?? node.getAttribute('sname') ?? node.getAttribute('data-shortname') ?? '').toUpperCase();
    const sourceShortName = (node.getAttribute('data-template-source-short-name') ?? '').toUpperCase();
    const candidates = [text, dataFilter, shortName, sourceShortName];

    if (candidates.some((value) => isStagedHeatCoolText(value))) {
      nodes.add(node);
    }
  });
  return nodes;
}

function getSelectedSourceShortNames(packageData: ProjectHubTemplateGraphicPackage, selectedSelectionIds: Set<string>) {
  const selected = new Set<string>();
  packageData.visibility_rules.forEach((rule) => {
    const selectionId = rule.ontology_id || rule.source_short_name;
    if (selectedSelectionIds.has(selectionId) || selectedSelectionIds.has(rule.source_short_name)) {
      selected.add(rule.source_short_name);
    }
  });
  return [...selected];
}

export function ProjectHubTemplateGraphicPanel({
  templateId,
  selectedOntologyIds,
  selectedSelectionIds,
  selectedSelectionLabelsById,
  selectedSelectionRolesById,
  selectedTemplateKeysBySelectionId,
  fallback,
  className,
}: Props) {
  const [packageData, setPackageData] = useState<ProjectHubTemplateGraphicPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1.24);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [presentation, setPresentation] = useState<ProjectHubTemplatePointPresentation>({
    selected_estimator_items: [],
    represented: [],
    additional: [],
    dropped_selected_items: [],
  });
  const [additionalExpanded, setAdditionalExpanded] = useState(false);
  const [showAdditionalDebug, setShowAdditionalDebug] = useState(false);
  const previewFlagEnabled = isProjectHubTemplateGraphicsPreviewEnabled();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debugStateRef = useRef<TemplateDebugState | null>(null);
  const panStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const suppressNextClickRef = useRef(false);
  const effectiveSelectedSelectionIds = selectedSelectionIds ?? EMPTY_STRING_ARRAY;
  const effectiveSelectedSelectionLabelsById = selectedSelectionLabelsById ?? EMPTY_STRING_RECORD;
  const effectiveSelectedSelectionRolesById = selectedSelectionRolesById ?? EMPTY_STRING_RECORD;
  const effectiveSelectedTemplateKeysBySelectionId = selectedTemplateKeysBySelectionId ?? EMPTY_STRING_ARRAY_RECORD;

  const selectedEstimatorItems = useMemo<ProjectHubTemplateSelectedEstimatorItem[]>(() => (
    unique(effectiveSelectedSelectionIds).map((selectionId) => {
      const mappedSourceShortNames = unique(effectiveSelectedTemplateKeysBySelectionId[selectionId] ?? []);
      return {
        selection_id: selectionId,
        display_label: effectiveSelectedSelectionLabelsById[selectionId] || selectionId,
        estimator_role: effectiveSelectedSelectionRolesById[selectionId] || null,
        ontology_id: null,
        mapped_source_short_names: mappedSourceShortNames,
        confidence: mappedSourceShortNames.length ? 0.9 : 0.1,
      };
    })
  ), [
    effectiveSelectedSelectionIds,
    effectiveSelectedSelectionLabelsById,
    effectiveSelectedSelectionRolesById,
    effectiveSelectedTemplateKeysBySelectionId,
  ]);

  const selectedTemplateKeys = useMemo(() => unique(
    selectedEstimatorItems.flatMap((item) => item.mapped_source_short_names)
  ), [selectedEstimatorItems]);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setPackageData(null);
    setError(null);

    fetch(`/api/projecthub/system-templates/${encodeURIComponent(templateId)}/graphic`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Template package request failed with ${response.status}`);
        }
        return response.json() as Promise<ProjectHubTemplateGraphicPackage>;
      })
      .then((packageData) => {
        setPackageData(packageData);
        setError(null);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string } | null)?.name === 'AbortError') return;
        setPackageData(null);
        setError(error instanceof Error ? error.message : 'Template package request failed.');
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [templateId]);

  const activeSelectionIds = useMemo(() => {
    if (!packageData) return new Set<string>();

    const next = new Set<string>();
    unique(selectedOntologyIds).forEach((ontologyId) => {
      next.add(ontologyId);
      packageData.selection_keys_by_ontology_id[ontologyId]?.forEach((key) => next.add(key));
    });
    return next;
  }, [packageData, selectedOntologyIds]);

  const zoomStep = 0.08;
  const zoomOut = () => setZoom((current) => Math.max(0.8, Number((current - zoomStep).toFixed(2))));
  const zoomIn = () => setZoom((current) => Math.min(2, Number((current + zoomStep).toFixed(2))));
  const zoomReset = () => {
    setZoom(1.24);
    setPan({ x: 0, y: 0 });
  };

  const handlePanPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    panStartRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
      moved: false,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePanPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = panStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const dx = event.clientX - start.startX;
    const dy = event.clientY - start.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      start.moved = true;
      setPan({
        x: start.originX + dx,
        y: start.originY + dy,
      });
    }
  };

  const finishPanDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = panStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore pointer capture release errors from interrupted drags.
    }

    if (start.moved) {
      suppressNextClickRef.current = true;
    }

    panStartRef.current = null;
    setIsPanning(false);
  };

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root || !packageData) return;
    const selectedSourceShortNames = getSelectedSourceShortNames(packageData, activeSelectionIds);
    const cleanupObserverRef = { current: null as (() => void) | null };

    try {

    const nodesBySelectionId = new Map<string, Set<Element>>();

    packageData.visibility_rules.forEach((rule) => {
      if (isSoftwarePoint(rule.source_short_name) || isStagedHeatCoolPoint(rule.source_short_name)) return;

      const selectionId = rule.ontology_id || rule.source_short_name;
      const matchedNodes = collectRuleNodes(root, rule);

      matchedNodes.forEach((node) => {
        let selectionSet = nodesBySelectionId.get(selectionId);
        if (!selectionSet) {
          selectionSet = new Set<Element>();
          nodesBySelectionId.set(selectionId, selectionSet);
        }
        selectionSet.add(node);
        node.setAttribute('data-template-selection-id', selectionId);
        node.setAttribute('data-template-source-short-name', rule.source_short_name);
        appendSelectionIds(node, selectionId);
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
      const firstSelectionId = [...selectionIds][0];
      const visibilityMode =
        packageData.visibility_rules.find((rule) => (rule.ontology_id || rule.source_short_name) === firstSelectionId)?.visibility_mode ??
        'hide_when_unselected';
      setVisibility(node, false, visibilityMode);
    });

    const cleanupTargets = new Set<Element>();
    packageData.cleanup_rules.forEach((rule) => {
      if (rule.mode !== 'hide') return;
      collectCleanupNodes(root, rule).forEach((node) => cleanupTargets.add(node));
    });

    cleanupTargets.forEach((node) => {
      setVisibility(node, false, 'hide_when_unselected');
    });

    if (templateId === 'mixed_air_single_duct') {
      collectManualCleanupNodes(
        root,
        [
          '[data-template-source-short-name="RAPLO-A"]',
          '[data-filter="RAPLO-A"]',
          '[short-name="RAPLO-A"]',
          '[sname="RAPLO-A"]',
          '[data-shortname="RAPLO-A"]',
          'g[data-filter="RAPLO-A"]',
          'g[short-name="RAPLO-A"]',
        ],
        ['BLDG-P', 'BLDG-SP']
      ).forEach((node) => {
        setVisibility(node, false, 'hide_when_unselected');
      });
    }

    packageData.visibility_rules
      .filter((rule) => isSoftwarePoint(rule.source_short_name) || isStagedHeatCoolPoint(rule.source_short_name))
      .forEach((rule) => {
        collectRuleNodes(root, rule).forEach((node) => {
          setVisibility(node, false, rule.visibility_mode ?? 'hide_when_unselected');
        });
      });

    collectSoftwarePointNodes(root).forEach((node) => {
      setVisibility(node, false, 'hide_when_unselected');
    });

    collectStagedHeatCoolNodes(root).forEach((node) => {
      setVisibility(node, false, 'hide_when_unselected');
    });

    nodeSelectionIds.forEach((selectionIds, node) => {
      const shouldShow = [...selectionIds].some((selectionId) => activeSelectionIds.has(selectionId));
      const firstSelectionId = [...selectionIds][0];
      const sourceShortName =
        packageData.visibility_rules.find((rule) => (rule.ontology_id || rule.source_short_name) === firstSelectionId)?.source_short_name ??
        firstSelectionId;
      if (isSoftwarePoint(sourceShortName) || isStagedHeatCoolPoint(sourceShortName)) {
        setVisibility(node, false, 'hide_when_unselected');
        collectLabelNodesForSource(root, sourceShortName).forEach((labelNode) => {
          if (labelNode !== node) {
            setVisibility(labelNode, false, 'hide_when_unselected');
          }
        });
        return;
      }
      const visibilityMode =
        packageData.visibility_rules.find((rule) => (rule.ontology_id || rule.source_short_name) === firstSelectionId)?.visibility_mode ??
        'hide_when_unselected';

      setVisibility(node, shouldShow, visibilityMode);
      collectLabelNodesForSource(root, sourceShortName).forEach((labelNode) => {
        if (labelNode !== node) {
          setVisibility(labelNode, shouldShow, visibilityMode);
        }
      });
    });

    const debugOptions = {
      revealCleanupNodes: false,
      hideUnlinkedPointGroups: true,
      selectedPointsOnly: true,
      selectedSelectionIds: [...activeSelectionIds],
      selectedSourceShortNames: [...selectedTemplateKeys],
      selectedTemplateKeys,
      preserveLabels: PRESERVE_LABELS,
      templateId,
    };

    const visibilityResult = applyTemplateVisibility(
      root,
      new Set(selectedTemplateKeys),
      new Set(activeSelectionIds),
      new Set(PRESERVE_LABELS)
    );

    const selectedVisibilityKeys = new Set([
      ...selectedTemplateKeys,
      ...selectedSourceShortNames,
      ...selectedEstimatorItems.flatMap((item) => item.mapped_source_short_names),
    ]);
    const visibleUnselectedGlyphsFromRules = new Set(visibilityResult.visible_unselected_glyphs);
    packageData.visibility_rules.forEach((rule) => {
      const sourceShortName = rule.source_short_name.trim();
      if (!sourceShortName || selectedVisibilityKeys.has(sourceShortName)) return;
      const glyphNodes = collectVisibilityGlyphNodes(root, rule);
      if ([...glyphNodes].some((node) => isVisibleElement(node))) {
        visibleUnselectedGlyphsFromRules.add(sourceShortName);
      }
    });

    const beforeCleanup = buildTemplateCleanupDebugSnapshot(root, packageData.cleanup_rules, debugOptions);

    cleanupObserverRef.current = installTemplateCleanupObserver(root, packageData.cleanup_rules, {
      ...debugOptions,
    });
    ensureSelectedPointLabelReadability(root, selectedTemplateKeys);
    const pointPresentation = resolveTemplatePointPresentation(selectedEstimatorItems, visibilityResult);
    setPresentation(pointPresentation);

    const afterCleanup = buildTemplateCleanupDebugSnapshot(root, packageData.cleanup_rules, debugOptions);

    debugStateRef.current = {
      mounted: true,
      templateId,
      cleanupMode: 'selected_points_only',
      selectedSelectionIds: [...activeSelectionIds],
      selectedSourceShortNames: [...selectedTemplateKeys],
      visibility: {
        selectedTemplateKeys: visibilityResult.selected_template_keys,
        visibleTemplateKeys: visibilityResult.visible_template_keys,
        visibleLabelKeys: visibilityResult.visible_label_keys,
        visibleGlyphKeys: visibilityResult.visible_glyph_keys,
        hiddenGlyphCount: visibilityResult.hidden_glyph_count,
        visibleUnselectedGlyphs: [...visibleUnselectedGlyphsFromRules],
      },
      presentation: {
        selectedEstimatorItems,
        representedItems: pointPresentation.represented,
        additionalItems: pointPresentation.additional,
        droppedSelectedItems: pointPresentation.dropped_selected_items,
      },
      selectedEstimatorItems,
      representedItems: pointPresentation.represented,
      additionalItems: pointPresentation.additional,
      droppedSelectedItems: pointPresentation.dropped_selected_items,
      cleanupRootFound: Boolean(root),
      cleanupRootTagName: root instanceof Element ? root.tagName : null,
      beforeCleanup,
      afterCleanup,
    };

    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      const debugGetter = () => debugStateRef.current ?? {
        mounted: false,
        templateId,
        cleanupMode: 'selected_points_only' as const,
        selectedSelectionIds: [...activeSelectionIds],
        selectedSourceShortNames: [...selectedTemplateKeys],
        visibility: {
          selectedTemplateKeys: visibilityResult.selected_template_keys,
          visibleTemplateKeys: visibilityResult.visible_template_keys,
          visibleLabelKeys: visibilityResult.visible_label_keys,
          visibleGlyphKeys: visibilityResult.visible_glyph_keys,
          hiddenGlyphCount: visibilityResult.hidden_glyph_count,
          visibleUnselectedGlyphs: [...visibleUnselectedGlyphsFromRules],
        },
        presentation: {
          selectedEstimatorItems,
          representedItems: pointPresentation.represented,
          additionalItems: pointPresentation.additional,
          droppedSelectedItems: pointPresentation.dropped_selected_items,
        },
        selectedEstimatorItems: [],
        representedItems: [],
        additionalItems: [],
        droppedSelectedItems: [],
        cleanupRootFound: Boolean(root),
        cleanupRootTagName: root instanceof Element ? root.tagName : null,
        beforeCleanup: null,
        afterCleanup: null,
      };
      (window as Window & { __projecthubTemplateDebug?: () => unknown }).__projecthubTemplateDebug = debugGetter;
      root.setAttribute('data-template-debug-mounted', 'true');
      root.setAttribute('data-template-debug-template-id', templateId);
      root.setAttribute('data-template-debug-selected-source-short-names', selectedSourceShortNames.join(','));
      root.setAttribute('data-template-debug-cleanup-mode', 'selected_points_only');
      root.setAttribute('data-template-debug-selection-ids', [...activeSelectionIds].join(','));
      (window as Window & {
        __hideTemplateGlyphTest?: (sourceShortName: string) => unknown;
      }).__hideTemplateGlyphTest = (sourceShortName: string) => {
        const normalizedSource = sourceShortName.trim();
        const matchingRules = packageData.visibility_rules.filter((rule) => rule.source_short_name.trim() === normalizedSource);
        const matchedNodes = new Set<Element>();

        matchingRules.forEach((rule) => {
          collectVisibilityGlyphNodes(root, rule).forEach((node) => matchedNodes.add(node));
        });

        const before = [...matchedNodes].map((node) => describeTemplateNode(root, node));
        matchedNodes.forEach((node) => setVisibility(node, false, 'hide_when_unselected'));
        const after = [...matchedNodes].map((node) => describeTemplateNode(root, node));

        return {
          sourceShortName: normalizedSource,
          ruleCount: matchingRules.length,
          matchedNodeCount: matchedNodes.size,
          visibleBeforeCount: before.filter((entry) => entry.visible).length,
          visibleAfterCount: after.filter((entry) => entry.visible).length,
          nodesBefore: before,
          nodesAfter: after,
        };
      };
    }
    } catch (effectError) {
      cleanupObserverRef.current?.();
      setPresentation({
        selected_estimator_items: [],
        represented: [],
        additional: [],
        dropped_selected_items: [],
      });
      setError(effectError instanceof Error ? effectError.message : 'Template graphics cleanup failed.');
    }

    return () => {
      cleanupObserverRef.current?.();
      debugStateRef.current = null;
      if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
        delete (window as Window & { __projecthubTemplateDebug?: () => unknown }).__projecthubTemplateDebug;
        delete (window as Window & { __hideTemplateGlyphTest?: (sourceShortName: string) => unknown }).__hideTemplateGlyphTest;
      }
    };
  }, [
    activeSelectionIds,
    packageData,
    templateId,
    zoom,
    selectedEstimatorItems,
    selectedTemplateKeys,
    effectiveSelectedSelectionIds,
    selectedOntologyIds,
    effectiveSelectedSelectionLabelsById,
    effectiveSelectedSelectionRolesById,
    effectiveSelectedTemplateKeysBySelectionId,
  ]);

  if (loading) {
    return <div className={className} />;
  }

  const showTemplatePreviewBadge = process.env.NODE_ENV !== 'production' && previewFlagEnabled;
  const fallbackStatus = error ? 'active' : packageData ? 'standby' : 'loading';
  const previewBadge = showTemplatePreviewBadge ? (
    <div
      style={{
        position: 'absolute',
        left: 12,
        top: 12,
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px 10px',
        borderRadius: 12,
        border: '1px solid rgba(148, 163, 184, 0.35)',
        background: 'rgba(15, 23, 42, 0.82)',
        color: '#e2e8f0',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
        pointerEvents: 'none',
        backdropFilter: 'blur(10px)',
      }}
      data-template-graphics-preview-badge="true"
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.2 }}>Template Graphics Preview</div>
      <div style={{ fontSize: 10.5, color: '#cbd5e1' }}>Template: {templateId}</div>
      <div style={{ fontSize: 10.5, color: '#cbd5e1' }}>Flag: on</div>
      <div style={{ fontSize: 10.5, color: '#cbd5e1' }}>Fallback: {fallbackStatus}</div>
    </div>
  ) : null;

  if (!packageData || error) {
    return (
      <div className={className} style={{ position: 'relative', overflow: 'visible' }}>
        {previewBadge}
        {fallback}
      </div>
    );
  }

  return (
    <div className={className} style={{ position: 'relative', overflow: 'visible', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <style jsx global>{`
        .projecthub-template-cleanup-hidden,
        .projecthub-template-cleanup-hidden * {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }
      `}</style>
      <div
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 540,
          height: 'clamp(540px, 68vh, 780px)',
          border: '1px solid rgba(148, 163, 184, 0.22)',
          borderRadius: 16,
          background: 'linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(255, 255, 255, 0.98))',
          boxShadow: '0 6px 22px rgba(15, 23, 42, 0.05)',
          overflow: 'hidden',
        }}
      >
        {previewBadge}
        <div
          style={{
            position: 'absolute',
            right: 12,
            top: 12,
            zIndex: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            borderRadius: 12,
            background: 'rgba(248, 250, 252, 0.92)',
            border: '1px solid rgba(148, 163, 184, 0.35)',
            boxShadow: '0 8px 22px rgba(15, 23, 42, 0.08)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 0.2 }}>Zoom</span>
          <button type="button" onClick={zoomOut} aria-label="Zoom out" style={zoomButtonStyle}>-</button>
          <button type="button" onClick={zoomReset} aria-label="Reset zoom" style={zoomButtonStyle}>{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={zoomIn} aria-label="Zoom in" style={zoomButtonStyle}>+</button>
          <button type="button" onClick={zoomReset} aria-label="Reset view" style={zoomButtonStyle}>Reset</button>
        </div>
        <div
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            touchAction: 'none',
            userSelect: 'none',
            cursor: isPanning ? 'grabbing' : 'grab',
          }}
          onPointerDown={handlePanPointerDown}
          onPointerMove={handlePanPointerMove}
          onPointerUp={finishPanDrag}
          onPointerCancel={finishPanDrag}
          onClickCapture={(event) => {
            if (!suppressNextClickRef.current) return;
            suppressNextClickRef.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <div
            ref={containerRef}
            style={{
              width: '100%',
              minHeight: '100%',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top left',
              willChange: 'transform',
              userSelect: 'none',
            }}
            dangerouslySetInnerHTML={{ __html: packageData.svg_markup }}
          />
        </div>
        {presentation.additional.length > 0 ? (
          <div
            style={{
              position: 'absolute',
              right: 16,
              bottom: 16,
              zIndex: 5,
              width: 'min(340px, calc(100% - 32px))',
              maxWidth: 340,
              maxHeight: additionalExpanded ? 240 : 'none',
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                border: '1px solid rgba(148, 163, 184, 0.28)',
                borderRadius: 14,
                background: 'rgba(248, 250, 252, 0.94)',
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                padding: '10px 12px',
                backdropFilter: 'blur(10px)',
                maxHeight: additionalExpanded ? 240 : 'none',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => setAdditionalExpanded((current) => !current)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: 0,
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                aria-expanded={additionalExpanded}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                    Additional Points
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                    {presentation.additional.length} selected
                  </div>
                  {!additionalExpanded && presentation.additional.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
                      {presentation.additional.slice(0, 2).map((item) => (
                        <span
                          key={item.selection_id}
                          style={{
                            padding: '3px 7px',
                            borderRadius: 999,
                            background: '#fff',
                            border: '1px solid rgba(203, 213, 225, 0.9)',
                            fontSize: 10.5,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            maxWidth: 130,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.display_label}
                        </span>
                      ))}
                      {presentation.additional.length > 2 ? (
                        <span style={{ fontSize: 10.5, color: '#64748b' }}>+{presentation.additional.length - 2}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <span style={{ fontSize: 11, color: '#64748b' }}>{additionalExpanded ? 'Collapse' : 'Expand'}</span>
              </button>

              {additionalExpanded ? (
                <div
                  style={{
                    marginTop: 10,
                    maxHeight: 180,
                    overflowY: 'auto',
                    paddingRight: 4,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  {presentation.additional.map((item) => (
                    <div
                      key={item.selection_id}
                      style={{
                        minWidth: 0,
                        maxWidth: '100%',
                        padding: '7px 9px',
                        borderRadius: 10,
                        background: '#fff',
                        border: '1px solid rgba(203, 213, 225, 0.9)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>{item.display_label}</div>
                      {item.estimator_role ? (
                        <div style={{ fontSize: 10.5, color: '#64748b', lineHeight: 1.2 }}>{item.estimator_role}</div>
                      ) : null}
                      {showAdditionalDebug && process.env.NODE_ENV !== 'production' ? (
                        <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.2 }}>
                          {item.selection_id}
                          {item.reason ? ` · ${item.reason}` : ''}
                          {typeof item.confidence === 'number' ? ` · ${Math.round(item.confidence * 100)}%` : ''}
                          {item.mapped_source_short_name ? ` · ${item.mapped_source_short_name}` : ''}
                          {item.ontology_id ? ` · ${item.ontology_id}` : ''}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {process.env.NODE_ENV !== 'production' ? (
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowAdditionalDebug((current) => !current)}
                    style={{
                      border: '1px solid rgba(148, 163, 184, 0.45)',
                      background: '#fff',
                      color: '#334155',
                      borderRadius: 999,
                      padding: '3px 9px',
                      fontSize: 10.5,
                      cursor: 'pointer',
                    }}
                  >
                    {showAdditionalDebug ? 'Hide review details' : 'Show review details'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const zoomButtonStyle: CSSProperties = {
  minWidth: 34,
  height: 28,
  padding: '0 10px',
  borderRadius: 10,
  border: '1px solid rgba(148, 163, 184, 0.5)',
  background: '#fff',
  color: '#0f172a',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};
