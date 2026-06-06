'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type {
  ProjectHubSystemTemplateCleanupRule,
  ProjectHubSystemTemplateVisibilityRule,
  ProjectHubTemplateGraphicPackage,
} from '@/lib/projecthub-system-templates';

type Props = {
  templateId: string;
  selectedOntologyIds: string[];
  fallback: ReactNode;
  className?: string;
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function matchesAnySelector(node: Element, selectors: string[] | undefined) {
  return Boolean(selectors?.some((selector) => {
    try {
      return node.matches(selector);
    } catch {
      return false;
    }
  }));
}

function findCleanupContainer(root: ParentNode, startNode: Element, ancestorSelectors?: string[]) {
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

function addMatchedNodes(root: ParentNode, selector: string, nodes: Set<Element>) {
  root.querySelectorAll(selector).forEach((node) => nodes.add(node));
}

function addAttributeMatchedNodes(root: ParentNode, rule: ProjectHubSystemTemplateCleanupRule, nodes: Set<Element>) {
  rule.attribute_matches?.forEach(({ name, contains }) => {
    const selector = `[${name}*="${contains.replace(/"/g, '\\"')}"]`;
    addMatchedNodes(root, selector, nodes);
  });
}

function collectCleanupNodes(root: ParentNode, rule: ProjectHubSystemTemplateCleanupRule) {
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
    resolvedNodes.add(findCleanupContainer(root, node, rule.ancestor_selectors));
  });

  return resolvedNodes;
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
  addMatchedNodes(root, `g[data-filter="${sourceShortName}"], g[short-name="${sourceShortName}"]`, nodes);
  addMatchedNodes(root, `use[key-data-attr*="pointShortName':'${sourceShortName}'"]`, nodes);
  addMatchedNodes(root, `use[key-data-attr*="pointShortName:\\"${sourceShortName}\\""]`, nodes);

  return nodes;
}

export function ProjectHubTemplateGraphicPanel({ templateId, selectedOntologyIds, fallback, className }: Props) {
  const [packageData, setPackageData] = useState<ProjectHubTemplateGraphicPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !packageData) return;

    const nodesBySelectionId = new Map<string, Set<Element>>();

    packageData.visibility_rules.forEach((rule) => {
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

    const cleanupTargets = new Set<Element>();
    packageData.cleanup_rules.forEach((rule) => {
      if (rule.mode !== 'hide') return;
      collectCleanupNodes(root, rule).forEach((node) => cleanupTargets.add(node));
    });

    cleanupTargets.forEach((node) => {
      const styledNode = node as SVGElement | HTMLElement;
      styledNode.style.display = 'none';
      styledNode.style.opacity = '0';
      styledNode.style.pointerEvents = 'none';
    });

    nodeSelectionIds.forEach((selectionIds, node) => {
      const styledNode = node as SVGElement | HTMLElement;
      const shouldShow = [...selectionIds].some((selectionId) => activeSelectionIds.has(selectionId));
      const firstSelectionId = [...selectionIds][0];
      const visibilityMode =
        packageData.visibility_rules.find((rule) => (rule.ontology_id || rule.source_short_name) === firstSelectionId)?.visibility_mode ??
        'hide_when_unselected';

      if (visibilityMode === 'hide_when_unselected') {
        styledNode.style.display = shouldShow ? '' : 'none';
        styledNode.style.opacity = shouldShow ? '1' : '0';
        styledNode.style.filter = shouldShow ? 'none' : 'grayscale(1) saturate(0.35)';
      } else {
        styledNode.style.display = '';
        styledNode.style.opacity = shouldShow ? '1' : '0.28';
        styledNode.style.filter = shouldShow ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.35))' : 'none';
      }
    });
  }, [activeSelectionIds, packageData]);

  if (loading || !packageData || error) {
    return <div className={className}>{fallback}</div>;
  }

  return (
    <div ref={containerRef} className={className} dangerouslySetInnerHTML={{ __html: packageData.svg_markup }} />
  );
}
