# Template Renderer Stabilization — Developer Notes

Branch: `chore/template-renderer-stabilization`
Audience: anyone touching the system-template graphic pipeline next — adding a
new template, editing `point_visibility`/`cleanup` rules, or extending the
estimator-facing panel or the internal QA preview.

This is Part 8 of an 8-part stabilization pass over the `mixed_air_single_duct`
template renderer (the only template wired end-to-end today). It is the single
place to start; every claim here is backed by one of the seven other documents
in `tools/template-import/output/`, linked inline.

## The one rule to internalize before touching point-visibility rules

**A `point_visibility` rule that resolves a point to a glyph by a broad CSS
selector is only safe if the matched component is unique in the template.**
The moment a second instance of the same glyph exists — a duplicated symbol, a
decorative legend copy, a second physical device of the same type — a
selector-based rule silently starts controlling *both* instances together.

### The concrete example: RA-SD / DA-SD smoke detectors

`mixed_air_single_duct`'s source markup contains **four** `<svg
jci-id="smoke_detector">` instances — two real, point-bound device glyphs
(the return-air smoke detector, `RA-SD`, and the discharge-air smoke detector,
`DA-SD`) and two decorative legend duplicates that happen to carry the same
vendor component id. The generation script used to special-case `RA-SD` by
collecting *every* node with `jci-id="smoke_detector"`:

```js
if (shortName === 'RA-SD') {
  const smokeDetectorSvgIds = [...templateHtml.matchAll(
    /<svg\b[^>]*jci-id="smoke_detector"[^>]*id="([^"]+)"/g
  )].map((m) => m[1]);
  deviceGroupIds.push(...smokeDetectorSvgIds);
}
```

— while `DA-SD` fell back to the generic selector `svg[jci-id="smoke_detector"]`,
which *also* matched all four. **Selecting either point toggled both real smoke
detectors (and the legend artifacts) together.** This is documented in full,
with the exact node-id mapping and a verified-disjoint result, in
`mixed_air_instance_mapping_audit.md`.

The fix replaced the hardcoded special case with a general, reusable
**spatial nearest-neighbor resolver**: each point label carries an `(x, y)`
position in the manifest; the resolver computes the Euclidean distance
(`Math.hypot`) from the label to every candidate glyph instance of the same
component family and keeps only the closest one. `RA-SD`'s label resolves to
glyph `svg_123_6` at 151.8px (vs. 771.8px to the `DA-SD` glyph); `DA-SD`'s
label resolves to glyph `svg_198_6` at 289.1px (vs. 692.4px to the `RA-SD`
glyph). The resulting `device_group_ids` sets — `{svg_123_6, svg_173_6,
svg_174_6}` and `{svg_198_6, svg_233_6, svg_234_6}` — are completely disjoint,
with confidence `0.97` on both rules and **zero** broad selectors remaining in
either rule's `image_selectors`.

### Generalizing the lesson — the rules that now govern this codebase

This collision was not a one-off quirk — it is the predictable consequence of
two facts that are true of *every* imported template: imported markup reuses
vendor component ids across instances (duplicated symbols, legend copies,
multiple identical devices), and CSS attribute selectors match by value, not
by instance. From that, the following now govern all point-visibility mapping
work in this codebase (verbatim from the brief's generalization addendum,
incorporated into `mixed_air_instance_mapping_audit.md`'s "Generalizing the
lesson" section and cross-linked from `runtime_neutrality_audit.md` and
`template_attribute_neutralization.md`):

- Broad component selectors are unsafe for per-point visibility whenever
  multiple matching instances exist.
- `point_visibility` records should prefer exact glyph node ids over selector
  strings whenever an instance can be resolved unambiguously.
- If exact node ids are unavailable up front, resolve them via spatially
  resolved label-to-glyph mapping — nearest-neighbor distance between the
  point label's coordinates and each candidate instance's coordinates, exactly
  as implemented for RA-SD/DA-SD (`collectGlyphFamilyInstances` +
  `resolveNearestGlyphInstance` in `generate-point-visibility.mjs`).
- Runtime code should not depend on source/vendor attributes such as `jci-id`
  for per-point visibility — they are an importer-time discovery convenience,
  not a stable per-instance identity.
- Repeated glyph families need a collision audit before they are trusted. The
  families most likely to recur in HVAC/controls drawings — and therefore most
  likely to hide the same class of bug — are: **smoke detectors, temperature
  sensors, pressure sensors, dampers, and valves.** Run the "count instances
  per `jci-id`" scan (reproduced in `mixed_air_instance_mapping_audit.md`)
  on every new template import, before point-visibility rules are generated.

A second latent instance of this exact risk class was found and documented
during this pass: `horizontal_opposed_damper` also has two instances
(`svg_92_6`, `svg_74`). It is not currently buggy — both damper points resolve
correctly through bound `<use>` symbol nodes — but it is exactly the shape of
thing that would silently break if a future alias or generation-script change
ever routed a damper point through a `jci-id`-keyed selector. `generate-point-visibility.mjs`'s
`REPEATED_GLYPH_FAMILIES` config is structured so that adding it (and any
future find from the families list above) is a one-line addition — see
"Recommended next steps" below.

## What changed in this pass, by deliverable

| Part | Deliverable | What it covers |
| --- | --- | --- |
| 1 | `template_renderer_architecture_audit.md` | Full pipeline trace (import-time → build-time → runtime), module responsibilities, fragility-risk summary table |
| 2 | `runtime_neutrality_audit.md` | Confirms nothing reaching the browser leaks vendor/source identifiers — 5 findings, each traced hop-by-hop |
| 3 | `template_attribute_neutralization.md` | The `jci-* → data-template-*` mirror: design rationale (mirror, don't strip), exact mapping, wiring, verification |
| 4 | `mixed_air_instance_mapping_audit.md` | The RA-SD/DA-SD fix: full instance mapping, distance matrix, verified-disjoint result, the generalized lesson (reproduced above) |
| 5 | `template_renderer_separation_audit.md` | Consolidated duplicated DOM helpers into `templateCleanup.ts` (fixed a real `hide_descendants` inconsistency + a `MutationObserver` cleanup leak); documents what was *not* refactored and why |
| 6 | `template_debug_surface_notes.md` | Gated `window.__projecthubTemplateDebug`/`__hideTemplateGlyphTest` (and their teardown + `data-template-debug-*` DOM attributes) behind `process.env.NODE_ENV !== 'production'`, matching the pre-existing `showTemplatePreviewBadge` pattern |
| 7 | `validate-template-runtime-cleanliness.mjs` + `template_runtime_cleanliness_report.md` | Automated, repeatable check encoding the neutrality + debug-gating findings — run it after any change to the pipeline |
| 8 | this document | Consolidated developer orientation |

## How to add or audit a template safely (the checklist this pass produced)

1. **Run the repeated-glyph-family scan first.** Before generating
   `point_visibility` rules, count `jci-id` occurrences per component and flag
   any family with more than one instance (snippet in
   `mixed_air_instance_mapping_audit.md`). Pay special attention to the five
   families named above.
2. **For any flagged family that a point needs to bind to, resolve the
   instance spatially**, not by selector. Use `collectGlyphFamilyInstances` +
   `resolveNearestGlyphInstance` (or extend `REPEATED_GLYPH_FAMILIES` if the
   family is new) so the resolution happens once, at generation time, and the
   exact node ids are baked into the manifest.
3. **Never write a `point_visibility` or `cleanup` rule that selects by
   `jci-*`.** Use `data-template-*` neutral equivalents
   (`template_attribute_neutralization.md`) if a selector is unavoidable, and
   prefer exact ids (`device_group_ids`/`label_group_ids`) over selectors in
   all cases.
4. **Run `node tools/template-import/validate-template-runtime-cleanliness.mjs`**
   after touching the pipeline — it encodes findings 1–4 above as automated,
   regression-proof checks (zero `jci-*` in runtime matching code, neutralizer
   wired in, debug globals gated, served artifacts free of vendor paths).
5. **Don't duplicate DOM-matching helpers.** `templateCleanup.ts` is the single
   source of truth for `collectRuleNodes`/`collectCleanupNodes`/
   `applyTemplateVisibility`/etc. — both the estimator panel and the QA
   preview import from it (Part 5's consolidation; see
   `template_renderer_separation_audit.md` for what that fixed).

## Remaining risks (not fixed in this pass — out of scope, documented for awareness)

- **`/system-template-preview` and `/api/system-template-preview` bypass the
  global auth gate in all environments** via `publicPaths` in
  `src/lib/supabase/middleware.ts`, contradicting that file's own comment that
  "the mixed-air preview is a local-only review surface and should not
  participate in auth redirects." This is pre-existing, committed
  (`c143ab2 fix(auth): bypass localhost auth gating for dev`), and touches
  shared auth/middleware — squarely outside a template-renderer stabilization
  pass. Flagging it here so it isn't lost.
- **The oversized `useLayoutEffect`** in `ProjectHubTemplateGraphicPanel.tsx`
  (rule matching, multiple template-specific overrides, cleanup delegation,
  debug-state publication, all in one ~290-line block) and the **inline
  `mixed_air_single_duct`-specific conditionals** in both the panel and
  `templateCleanup.ts` are documented but not split apart — see
  `template_renderer_separation_audit.md` for the reasoning (splitting risks
  new ordering bugs; the template-specific blocks can't be meaningfully
  generalized from a single data point).
- **Duplicated note-sanitization logic** between `templateGraphicPackage.ts`'s
  `sanitizeNotes()` and an inline equivalent in
  `system-template-preview/page.tsx` — both correct today, but a drift risk;
  see `template_renderer_separation_audit.md` for why merging them was
  deferred (server/import-boundary considerations) and the recommended
  follow-up shape.

## Recommended next steps (non-binding, for whoever picks this up next)

1. When a second template is wired end-to-end, extract the
   `mixed_air_single_duct`-specific override blocks into a
   `templateOverrides` registry — at that point there are two real data points
   to generalize from instead of one to guess from.
2. Add `horizontal_opposed_damper` to `REPEATED_GLYPH_FAMILIES` proactively (it
   is currently latent, not buggy, but costs one line to harden).
3. Extract `sanitizeTemplateNotes`/alias-stripping into
   `templateGraphicPackage.ts` (already `server-only`) and import it from the
   preview page, retiring the duplicated regex.
4. Wire `validate-template-runtime-cleanliness.mjs` into CI (or at least the
   pre-merge checklist for system-template changes) so the neutrality and
   debug-gating guarantees this pass established can't silently regress.
