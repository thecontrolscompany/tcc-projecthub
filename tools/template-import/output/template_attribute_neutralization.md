# Template Attribute Neutralization

Branch: `chore/template-renderer-stabilization`
Deliverable: a sanitizer that mirrors vendor (`jci-*`) markup attributes onto
neutral `data-template-*` equivalents, wired into the rendering pipeline, plus
this note documenting the design decision.

## Why this exists

Imported template markup carries attribute names inherited from the original
authoring tool — `jci-id`, `jci-width`, `jci-height`, `jci-align`,
`jci-joints`. Two problems follow from runtime code depending on these names
directly:

1. **Source-naming leakage.** A selector like `svg[jci-id="smoke_detector"]`
   embeds the importer-tool's vocabulary into ProjectHub's own runtime —
   coupling our code to a name we don't control and didn't choose.
2. **Collision risk.** `jci-id` identifies a *component type*, not an
   *instance*. When a template contains more than one glyph of the same type
   (as `mixed_air_single_duct` does for `smoke_detector` — four instances —
   and `horizontal_opposed_damper` — two instances), a `jci-id`-keyed selector
   cannot distinguish between them. This is exactly what caused the RA-SD /
   DA-SD collision documented in `mixed_air_instance_mapping_audit.md`: the
   broad selector `svg[jci-id="smoke_detector"]` matched all four smoke
   detector glyphs at once.

The user's addendum to this stabilization brief states the rule directly:
*"runtime code should not depend on source/vendor attributes such as jci-id
for per-point visibility."* This module is the mechanical enforcement of that
rule for markup that ships to the browser.

## What was built

`src/lib/projecthub-system-templates/templateAttributeNeutralization.ts`
exports:

- `neutralizeTemplateMarkupAttributes(markup: string): string` — scans raw
  SVG/HTML markup for the five known vendor attributes and **mirrors** each
  onto its neutral equivalent immediately after the original, preserving the
  original attribute and its value:

  | vendor attribute | neutral equivalent |
  | --- | --- |
  | `jci-id` | `data-template-component-id` |
  | `jci-width` | `data-template-source-width` |
  | `jci-height` | `data-template-source-height` |
  | `jci-align` | `data-template-align` |
  | `jci-joints` | `data-template-joints` |

  Example transformation (smoke-tested during this pass):
  ```
  <svg jci-id="smoke_detector" jci-width="24" jci-align="center" id="svg_123_6">
  ```
  becomes
  ```
  <svg jci-id="smoke_detector" data-template-component-id="smoke_detector"
       jci-width="24" data-template-source-width="24"
       jci-align="center" data-template-align="center"
       id="svg_123_6">
  ```

- `getNeutralTemplateAttributeName(vendorAttributeName): string | null` — name
  lookup, for any future code that needs to translate between the two
  vocabularies (e.g. import tooling, debug surfaces).

- `TEMPLATE_NEUTRAL_ATTRIBUTE_NAMES` — the list of neutral names, exported so
  validation tooling (`validate-template-runtime-cleanliness.mjs`, Part 7) and
  any future selector code has a single source of truth for "the attributes
  it's safe to query."

## Design decision: mirror, don't strip

The brief explicitly allowed either approach ("keep originals if removal risky,
but stop querying them at runtime"). Mirroring was chosen over stripping
because:

- The imported markup may contain its own styling or scripting that depends on
  `jci-*` attributes (none was found during this pass, but the normalized
  bundle is large and not exhaustively executed) — removing them is an
  irreversible, untested risk for zero runtime benefit.
- Mirroring is **additive and inert**: it cannot break anything that currently
  works, and it immediately gives runtime code (and future selector authors) a
  neutral name to use instead.
- It keeps the regenerable artifact (normalized markup) and the runtime markup
  in sync without needing a second normalization pass — the mirror happens at
  package-assembly time, in `templateGraphicPackage.ts`, on every request.

## How it's wired in

`templateGraphicPackage.ts` runs the neutralizer as one stage of the existing
markup pipeline:

```ts
svg_markup: stripAliasText(
  neutralizeTemplateMarkupAttributes(rewriteTemplateAssetReferences(svgMarkup, template.template_id))
),
```

Order matters: asset references are rewritten first (so the neutralizer's
attribute scan sees final `href`/`xlink:href` values, though it only touches
the five `jci-*` names and ignores asset attributes), then attributes are
mirrored, then alias placeholder text is stripped/recolored. The neutralized
markup — with both the original `jci-*` and the new `data-template-*`
attributes present — is what reaches the browser.

## What "stop querying them at runtime" means in practice

No runtime selector, matcher, or debug tool added or modified in this pass
references `jci-*`. `runtime_neutrality_audit.md` confirms this is true of the
*existing* runtime code as well — a `grep` for `jci-` across
`ProjectHubTemplateGraphicPanel.tsx`, `system-template-preview.tsx`,
`templateCleanup.ts`, and `templateGraphicPackage.ts` returns zero matches.
The neutral names exist now so that **if** a future template requires a
selector-based fallback (e.g. for a component that can't be resolved to an
exact instance — see the spatial-matching discussion in
`mixed_air_instance_mapping_audit.md` for when that's even safe to do), it can
be written against `data-template-component-id` instead of `jci-id`, without
embedding the vendor's vocabulary into ProjectHub's selector set.

## Verification performed

- Smoke-tested the regex transformation against representative markup
  fragments (shown above) — confirmed it mirrors without removing or
  duplicating beyond the intended single neutral attribute per vendor
  attribute, and is case-insensitive on the attribute name while preserving
  the original quote style and value.
- `npx tsc --noEmit` — clean.
- `npx eslint` on the new module and its caller — clean.
- Confirmed via the regenerated `mixed_air_single_duct` package that
  `data-template-component-id="smoke_detector"` etc. now appear alongside
  `jci-id="smoke_detector"` in the markup served to the browser.
