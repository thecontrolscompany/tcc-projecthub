# System Template Renderer — Architecture Audit

Branch: `chore/template-renderer-stabilization`
Scope: the runtime pipeline that turns an imported vendor SVG/HTML template into
an interactive, point-aware graphic in the estimator (`mixed_air_single_duct`
is the only template wired end-to-end today).

This is Part 1 of an 8-part stabilization pass. It documents what exists today
— it does not change behavior. See `template_renderer_stabilization_notes.md`
for the consolidated recommendations that follow from this and the other
audits.

## Pipeline overview

```
import-time (offline, one-shot)
  tools/template-import/generate-point-visibility.mjs
    reads:  tools/template-import/output/<template>/normalized_template.html
            tools/template-import/output/<template>/point_manifest.json
    writes: src/data/projecthub/system-templates/<template>_point_visibility.json
            tools/template-import/output/source_safety_audit.md
            tools/template-import/output/<template>/point_visibility_audit.md
            tools/template-import/output/<template>/asset_reference_audit.md

build/registry-time (server, per request)
  systemTemplateRegistry.ts  → loads registry JSON + normalized markup + manifests
  templateGraphicPackage.ts  → assembles the `ProjectHubTemplateGraphicPackage`
        ├─ rewriteTemplateAssetReferences  (vendor asset paths → repo-relative)
        ├─ neutralizeTemplateMarkupAttributes  (jci-* → data-template-* mirrors)
        └─ stripAliasText / recolor placeholder "Alias" labels

runtime (client, per render)
  ProjectHubTemplateGraphicPanel.tsx   (estimator-facing, behind a feature flag)
  system-template-preview.tsx          (internal QA tool, /system-template-preview)
        both consume:
          templateCleanup.ts  → shared DOM matching / hide / observer helpers
```

## Modules and responsibilities

### 1. Generation script — `tools/template-import/generate-point-visibility.mjs`

Offline Node script, run manually after a template is normalized. Reads the
normalized HTML/SVG and the point manifest, and produces the
`point_visibility.json` manifest that the runtime consumes — plus three audit
markdown files. This is the **only** place that should ever need to reason
about vendor markup shape (`jci-id`, coordinate attributes, `<use>` binding via
`key-data-attr`); everything downstream works from its output.

Key responsibilities (as of this pass):
- Bind point labels to glyph nodes via `pointShortName` in `key-data-attr`
  (the primary, reliable mechanism — used for fans, sensors, dampers, etc.)
- Resolve **repeated-glyph families** (multiple instances sharing the same
  `jci-id`) to a single exact instance via spatial nearest-neighbor matching
  (`REPEATED_GLYPH_FAMILIES` / `collectGlyphFamilyInstances` /
  `resolveNearestGlyphInstance` — added in this pass; see
  `mixed_air_instance_mapping_audit.md`)
- Emit `device_group_ids` (exact node ids — preferred) and
  `image_selectors`/`fallback_selectors` (broad CSS selectors — last resort,
  collision-prone)

### 2. Registry — `systemTemplateRegistry.ts`

Server-only module (`import 'server-only'`). Loads the per-template registry
entry, the normalized SVG/HTML markup, the point manifest, the visibility
manifest, and the cleanup-rules manifest from repo-local JSON/HTML files. Pure
data access — no DOM, no business rules about which points to show.

### 3. Package assembly — `templateGraphicPackage.ts`

Server-only. Builds the `ProjectHubTemplateGraphicPackage` returned to the
client (via `/api/projecthub/system-templates/{templateId}/graphic`):
- runs the markup through `rewriteTemplateAssetReferences` (vendor asset URLs
  → repo-relative `./assets/...` paths served from the public bundle)
- runs the markup through `neutralizeTemplateMarkupAttributes` (mirrors
  `jci-*` vendor attributes onto `data-template-*` neutral equivalents —
  added in this pass; see `template_attribute_neutralization.md`)
- strips/recolors placeholder "Alias" text nodes (`stripAliasText`)
- sanitizes template `notes` so private source-path strings never reach the
  client (`sanitizeNotes`)
- builds `selection_keys_by_ontology_id` from the point-alias lookup so the
  estimator's selection ids can be matched back to template source short names

### 4. Shared DOM helpers — `templateCleanup.ts`

Framework-agnostic DOM matching/visibility helpers, intentionally factored out
so the estimator runtime panel and the internal QA preview consume **one**
implementation instead of drifting copies (this consolidation is the Part 5
refactor in this pass — see `template_renderer_separation_audit.md`).
Responsibilities:
- resolve a `point_visibility` rule to DOM nodes (`collectRuleNodes`),
  preferring exact `device_group_ids`/`label_group_ids` over broad selectors
- resolve a `cleanup` rule to DOM nodes, including `hide_descendants`
  (`collectCleanupNodes`)
- apply/observe "selected points only" visibility (`applyTemplateVisibility`,
  `installTemplateCleanupObserver` via `MutationObserver` + rAF batching)
- build debug snapshots for QA (`buildTemplateCleanupDebugSnapshot`)
- presentation reconciliation: which selected estimator items are actually
  represented on the template vs. additional/dropped (`resolveTemplatePointPresentation`)

### 5. Estimator runtime — `ProjectHubTemplateGraphicPanel.tsx`

Client component (`'use client'`) embedded in the estimator behind
`isProjectHubTemplateGraphicsPreviewEnabled()`. Fetches the package, injects
the SVG via `dangerouslySetInnerHTML`, and runs a `useLayoutEffect` that:
1. walks `visibility_rules`, tags matched DOM nodes with
   `data-template-selection-id(s)` / `data-template-source-short-name`
2. applies several **template-specific overrides** inline (software points
   `-SP`, staged heat/cool `(PH|CLG|RH)\d*-C`, a hardcoded
   `templateId === 'mixed_air_single_duct'` block for `RAPLO-A`/`BLDG-P` —
   see `template_renderer_separation_audit.md` for why these are flagged)
3. delegates the general "selected points only" visibility pass and the
   cleanup-rule pass to `templateCleanup.ts`
4. publishes a debug snapshot to `window.__projecthubTemplateDebug` /
   `window.__hideTemplateGlyphTest` (see `template_debug_surface_notes.md` —
   this is currently **not** gated to development)
5. handles zoom/pan UI state (orthogonal to template logic; correctly kept
   local to the component)

### 6. Internal QA preview — `system-template-preview.tsx` + `/system-template-preview`

Server page + client component used to visually QA a template's point mapping
and cleanup rules outside the estimator flow. Shares `templateCleanup.ts` for
all DOM matching (after this pass's consolidation) and renders a "Debug
metadata" panel showing rule match counts, selectors, and node probes.

## How a point goes from "selected in the estimator" to "visible glyph on screen"

1. Estimator passes `selectedOntologyIds` / `selectedSelectionIds` to the panel.
2. The panel expands those into `activeSelectionIds` via
   `selection_keys_by_ontology_id` (built at package-assembly time from
   `pointAliases.ts` lookups).
3. For each `visibility_rule`, `collectRuleNodes` resolves the rule to DOM
   nodes — preferring exact ids (`label_group_ids`, `device_group_ids`,
   `value_group_ids`, `related_node_ids`) and falling back to selectors
   (`image_selectors`, `fallback_selectors`, plus a few hardcoded
   `data-filter`/`short-name`/`key-data-attr` selector patterns).
4. Matched nodes are tagged with `data-template-selection-id(s)` and
   `data-template-source-short-name`, then shown/hidden based on whether their
   selection id is in `activeSelectionIds`.
5. `templateCleanup.ts`'s `applyTemplateVisibility` / cleanup-rule pass then
   does a second, broader sweep (label visibility, "selected points only" mode,
   unlinked-group hiding, template-specific exact-label/selector hides for
   `mixed_air_single_duct`).
6. A `MutationObserver` (via `installTemplateCleanupObserver`) re-applies the
   cleanup pass whenever the injected SVG subtree mutates, so dynamically
   inserted nodes don't escape the rules.

## Where the fragility lives (summary — see linked audits for detail)

| Risk | Where | Detail |
| --- | --- | --- |
| Repeated glyph instances sharing one vendor id collide under broad selectors | `point_visibility` generation + `collectRuleNodes` fallback selectors | `mixed_air_instance_mapping_audit.md` |
| Runtime queries vendor `jci-*` attributes directly | (pre-pass) markup + selectors | `runtime_neutrality_audit.md`, `template_attribute_neutralization.md` |
| Functions doing DOM matching + business rules + presentation in one pass | `ProjectHubTemplateGraphicPanel`'s `useLayoutEffect`, (pre-pass) duplicated helpers | `template_renderer_separation_audit.md` |
| Debug globals exposed unconditionally on `window` | `ProjectHubTemplateGraphicPanel.tsx` | `template_debug_surface_notes.md` |
| No automated check that the rendered output stays free of vendor/source leakage | n/a (gap) | `template_runtime_cleanliness_report.md` + `validate-template-runtime-cleanliness.mjs` |

## Explicitly out of scope for this pass

Per the stabilization brief: pricing logic, estimator selection behavior,
original installed vendor source files (`Program Files`/`ProgramData`), and
merging to `main`. No changes described in this audit alter what an estimator
user can select or how billing/pricing is computed — they change *how reliably
the graphic reflects an existing selection* and *how cleanly the runtime is
separated from vendor-specific implementation details*.
