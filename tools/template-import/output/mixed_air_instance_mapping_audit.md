# Mixed Air Single Duct — Repeated-Glyph Instance Mapping Audit

Branch: `chore/template-renderer-stabilization`
Scope: `mixed_air_single_duct` template — how `point_visibility` rules resolve a
point label to the correct on-screen glyph instance when the imported markup
contains more than one glyph carrying the same vendor component id (`jci-id`).

## TL;DR

The generation script (`tools/template-import/generate-point-visibility.mjs`)
previously special-cased one point (`RA-SD`) by collecting **every** SVG node
whose `jci-id="smoke_detector"`, including the glyph that visually belongs to a
different point (`DA-SD`). Selecting either point therefore showed/hid both
smoke detectors together. The fix replaces the hardcoded special case with a
general, reusable **spatial nearest-neighbor resolver** that picks the single
closest glyph instance to each point's label and records only that instance's
exact node ids. The smoke-detector collision is fixed and verified disjoint;
a second latent collision (`horizontal_opposed_damper`) was found during the
audit and is flagged below for the same treatment.

## The concrete example: RA-SD / DA-SD smoke detectors

### What the source markup actually contains

`tools/template-import/output/mixed_air_single_duct/normalized_template.html`
contains **four** `<svg jci-id="smoke_detector">` instances, all referencing the
same imported asset `./assets/img/AHU/HVACAirSensors/AirSensors_refs/Smoke_Detector.png`:

| svg id | x, y | inner group | inner image | role |
| --- | --- | --- | --- | --- |
| `svg_123_6` | 860.16, 310.26 | `svg_173_6` | `svg_174_6` | **RA-SD glyph** (return-air smoke detector) |
| `svg_198_6` | 1493.05, 865.40 | `svg_233_6` | `svg_234_6` | **DA-SD glyph** (discharge-air smoke detector) |
| `svg_138` | 995.22, 441.61 | `svg_186` | `svg_187` | decorative legend duplicate |
| `svg_294` | 995.22, 441.61 | `svg_186_293` | `svg_187_293` | decorative legend duplicate (co-located with `svg_138`) |

Two of these are real, point-bound device glyphs; two are decorative legend
artifacts that happen to share the same `jci-id`. A selector keyed only on
`jci-id="smoke_detector"` cannot tell any of the four apart.

### The bug

The old generation logic was:

```js
if (shortName === 'RA-SD') {
  const smokeDetectorSvgIds = [...templateHtml.matchAll(
    /<svg\b[^>]*jci-id="smoke_detector"[^>]*id="([^"]+)"/g
  )].map((m) => m[1]);
  deviceGroupIds.push(...smokeDetectorSvgIds);
}
```

This collected **all four** matching `id`s — including `svg_198_6` (the DA-SD
glyph) and the two legend duplicates — into the `RA-SD` rule's
`device_group_ids`. `DA-SD` itself fell back to a generic
`svg[jci-id="smoke_detector"]` selector in `image_selectors`, which *also*
matched all four instances. Net effect: selecting either `RA-SD` or `DA-SD`
toggled both real smoke-detector glyphs (and the legend artifacts) together —
collision in both directions.

### The fix: spatial nearest-neighbor resolution

Each point label in `point_manifest.json` carries its own `(x, y)` position.
The fix (in `generate-point-visibility.mjs`) computes the Euclidean distance
(`Math.hypot(dx, dy)`) from each `-SD` point's label position to every
`smoke_detector` glyph instance's position, and keeps only the closest one:

```
RA-SD  label (1005.6, 267.0) → svg_123_6 (860.16, 310.26): 151.8px  ← nearest, selected
                              → svg_138/svg_294 (995.22, 441.61):  174.9px
                              → svg_198_6 (1493.05, 865.40):        771.8px

DA-SD  label (1499.4, 576.4) → svg_198_6 (1493.05, 865.40):  289.1px  ← nearest, selected
                              → svg_138/svg_294 (995.22, 441.61): 521.9px
                              → svg_123_6 (860.16, 310.26):        692.4px
```

(A duplicate label position exists for each point — `RA-SD`-alt at
`(1015, 192)` and `DA-SD`-alt at `(1433, 495)` — both also resolve to the same
nearest instance, `svg_123_6` at 194.8px and `svg_198_6` at 375.2px
respectively, confirming the resolution is stable across both label
placements.)

### Verified result — disjoint sets

Regenerated `src/data/projecthub/system-templates/mixed_air_single_duct_point_visibility.json`:

| Point | `device_group_ids` | `image_selectors` | confidence |
| --- | --- | --- | --- |
| `RA-SD` | `svg_139`, `svg_123_6`, `svg_173_6`, `svg_174_6` | `[]` | 0.97 |
| `DA-SD` | `svg_292`, `svg_198_6`, `svg_233_6`, `svg_234_6` | `[]` | 0.97 |

(`svg_139` / `svg_292` are unrelated, legitimately point-bound `<use>` symbol
nodes resolved separately via `pointShortName` in `key-data-attr` — they were
already correct and are preserved unchanged.)

The two `device_group_ids` sets are now **completely disjoint**: `{svg_123_6,
svg_173_6, svg_174_6}` vs `{svg_198_6, svg_233_6, svg_234_6}`. These exact
glyph/group/image node ids match the independently-derived "Codex finding"
mapping:

- RA-SD → glyph `svg_123_6`, inner group `svg_173_6`, image `svg_174_6`
- DA-SD → glyph `svg_198_6`, inner group `svg_233_6`, image `svg_234_6`
- both → asset `./assets/img/AHU/HVACAirSensors/AirSensors_refs/Smoke_Detector.png`

`image_selectors` is now empty for both points — the broad
`svg[jci-id="smoke_detector"]` selector family that caused the collision has
been removed from these two rules entirely (it remains documented here, in the
audit, as the thing *not* to do).

## Generalizing the lesson

The RA-SD / DA-SD collision is not a one-off quirk of this template — it is the
predictable consequence of two design choices that recur across every imported
template:

1. **Imported markup reuses vendor component ids across instances.** Any glyph
   family that appears more than once in a drawing (a duplicated symbol, a
   decorative legend copy, multiple instances of the same equipment accessory)
   will carry the same `jci-id`.
2. **CSS-style attribute selectors match by id value, not by instance.**
   `svg[jci-id="X"]` returns every node with that attribute value — there is no
   way to ask it for "the one near this label."

From this, the rules that should govern all future point-visibility mapping
work are:

- **Broad component selectors are unsafe for per-point visibility whenever
  multiple matching instances exist.** A selector is only safe to use directly
  in a `point_visibility` rule if the generation step has first confirmed the
  matched component id is unique in the template.
- **`point_visibility` records should prefer exact glyph node ids**
  (`device_group_ids` populated with `id`/`getElementById`-resolvable values),
  not selector strings, whenever an instance can be resolved unambiguously.
- **If exact node ids are unavailable up front, resolve them via spatially
  resolved label-to-glyph mapping** — nearest-neighbor distance between the
  point label's coordinates and each candidate instance's coordinates, exactly
  as implemented for RA-SD/DA-SD (`collectGlyphFamilyInstances` +
  `resolveNearestGlyphInstance` in `generate-point-visibility.mjs`). This is a
  generation-time, one-shot computation — the resolved ids are baked into the
  manifest, so the runtime renderer never has to do spatial math.
- **Runtime code should not depend on source/vendor attributes such as
  `jci-id` for per-point visibility.** Vendor attribute values are an
  importer-time convenience for *discovering* candidate instances; they are not
  a stable identity for *selecting* a specific instance at render time. (See
  also `runtime_neutrality_audit.md` and `template_attribute_neutralization.md`
  for the broader neutralization of `jci-*` attributes.)
- **Repeated glyph families need a collision audit before they are trusted.**
  The families most likely to recur in HVAC/controls drawings — and therefore
  most likely to hide the same class of bug — are: smoke detectors, temperature
  sensors, pressure sensors, dampers, and valves. Each new template import
  should run the same "count instances per `jci-id`" check that uncovered this
  issue (see below) before point-visibility rules are generated.

## Second finding: `horizontal_opposed_damper` (latent, same risk class)

While auditing glyph-family instance counts for this template, a second
repeated component id was found:

- `jci-id="horizontal_opposed_damper"` appears on **two** SVG instances:
  `svg_92_6` and `svg_74`.

No point currently maps to this family through a broad selector (the existing
damper points resolve through bound `<use>` symbol nodes via `pointShortName`,
the same mechanism that correctly resolves `svg_139`/`svg_292` above), so this
is **not** an active bug today. It is, however, the same shape of latent risk
as the smoke detector collision: if a future template revision, alias change,
or generation-script change ever causes a damper point to fall through to a
`jci-id`-keyed selector, it would silently re-create the RA-SD/DA-SD bug for
dampers. `REPEATED_GLYPH_FAMILIES` in `generate-point-visibility.mjs` is
structured so that adding `horizontal_opposed_damper` (and any other family
discovered by future audits) is a one-line config addition — see
`template_renderer_stabilization_notes.md` for the recommended next step.

## How to re-run this audit for other templates

`collectGlyphFamilyInstances(componentId)` in `generate-point-visibility.mjs`
scans every `<svg jci-id="...">` tag in the normalized template markup and
returns each instance's `svgId`, position, descendant group/image ids, and
asset href. Running it (or an equivalent one-off scan) over all `jci-id` values
and reporting any with more than one instance is the fastest way to find the
next collision before it ships:

```js
const counts = new Map();
for (const tag of templateHtml.matchAll(/<svg\b[^>]*>/g)) {
  const id = getTagAttributeValue(tag[0], 'jci-id');
  if (id) counts.set(id, (counts.get(id) || 0) + 1);
}
[...counts].filter(([, n]) => n > 1); // → repeated families to review
```

For `mixed_air_single_duct` this returns `smoke_detector` (4 instances) and
`horizontal_opposed_damper` (2 instances) — exactly the two findings documented
above.
