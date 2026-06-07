# Runtime Neutrality Audit — System Template Renderer

Branch: `chore/template-renderer-stabilization`
Question this audit answers: **does anything that reaches the browser at
runtime (markup, JSON payloads, asset URLs, debug output) leak vendor/source
identifiers — `jci-*` attributes, `Johnson Controls`/`Program Files`/
`ProgramData` strings, or absolute filesystem paths?**

This is the read-only counterpart to `template_attribute_neutralization.md`
(which documents the mirroring fix) and
`template_runtime_cleanliness_report.md` (which documents the automated check
added to keep this true going forward).

## Method

Traced every path data can take from the imported source bundle to the
browser:

1. registry JSON (`projecthub_system_template_registry.json`) → server-only
   `systemTemplateRegistry.ts`
2. normalized markup (`normalized_template.html`) → `extractTemplateSvgMarkup`
3. assembly (`templateGraphicPackage.ts`) → JSON response from
   `/api/projecthub/system-templates/{templateId}/graphic`
4. binary assets → `/api/system-template-preview/assets/{templateId}/...`
5. the two render surfaces (`ProjectHubTemplateGraphicPanel`,
   `system-template-preview`) and their debug output

For each hop, checked whether vendor identifiers could pass through unchanged.

## Findings

### 1. `notes` — sanitized at every client-facing exit point ✅

`projecthub_system_template_registry.json` legitimately contains absolute
vendor source paths in `notes` (e.g. `"source file: C:\\Program Files
(x86)\\Johnson Controls\\UI Offline\\API\\Templates\\..."`) — this is expected
import-provenance metadata, not a bug. Two independent client-facing exits
both strip it before it can reach the browser:

- `templateGraphicPackage.ts` → `sanitizeNotes()` replaces any note matching
  `/source file:/i`, `/program files/i`, or `/programdata/i` with the literal
  placeholder `"Private source reference retained in debug metadata."`
- `system-template-preview/page.tsx` applies the **identical** regex inline
  when building `displayTemplate` (this duplication is flagged in
  `template_renderer_separation_audit.md` as a candidate for sharing one
  function, but functionally both paths are correct today)

`listSystemTemplates()` (used to populate the template picker in the preview
page) is mapped through `.map((entry) => ({ ...entry, notes: [] }))` — notes
are zeroed entirely for that list, so no per-entry sanitization regex is even
needed there.

**Verified**: no code path returns `template.notes` (or raw registry entries)
to the client without going through one of these two filters.

### 2. `jci-*` vendor attributes — absent from runtime query code ✅

Searched `ProjectHubTemplateGraphicPanel.tsx`, `system-template-preview.tsx`,
`templateCleanup.ts`, and `templateGraphicPackage.ts` for `jci-` — **zero
matches**. Runtime selector/matching code keys exclusively on neutral surfaces:
`data-template-*` attributes set by the renderer itself, `data-filter` /
`short-name` / `sname` (vendor markup attributes that are *position*-neutral —
they encode the point's short name, not an importer-tool identity), and
`key-data-attr` (the `<use>` binding mechanism, also point-name-keyed, not
vendor-identity-keyed).

The **only** place `jci-*` strings appear in code that runs against live markup
is `tools/template-import/generate-point-visibility.mjs` — an offline,
import-time script whose output (`*_point_visibility.json`) is the thing the
runtime actually consumes. That script's discovery use of `jci-id` is
appropriate (it has to read the vendor markup to build the manifest); what
matters is that its *output* never re-encodes `jci-*` as a runtime selector —
confirmed by the Part 4 fix, which replaced the one place that *did* leak a
`jci-id`-keyed selector into a rule (`image_selectors:
["svg[jci-id=\"smoke_detector\"]", ...]`) with exact node ids (see
`mixed_air_instance_mapping_audit.md`).

`templateAttributeNeutralization.ts` also references `jci-*` — by name, in its
mapping table — because mirroring requires naming the source attribute. This is
the intended exception: the neutralizer's *output* (`data-template-component-id`
etc.) is what the runtime should eventually standardize on, while the original
`jci-*` attributes are mirrored (not stripped) so nothing currently depending on
them silently breaks. See `template_attribute_neutralization.md`.

### 3. SVG/HTML markup sent to the browser — asset paths rewritten, vendor attributes mirrored ✅

`templateGraphicPackage.ts` pipes `svgMarkup` through, in order:
`neutralizeTemplateMarkupAttributes(rewriteTemplateAssetReferences(svgMarkup,
templateId))`, then `stripAliasText`. `rewriteTemplateAssetReferences`
(`templateAssetReferences.ts`) rewrites every `xlink:href`/`href`/`src`/CSS
`url()` reference that points at the imported asset bundle into a repo-relative
`./assets/...` path served by `/api/system-template-preview/assets/...` — no
`C:\`, `Program Files`, or `file://` strings survive into the markup the
browser receives. `neutralizeTemplateMarkupAttributes` mirrors `jci-*`
attributes onto `data-template-*` equivalents (see
`template_attribute_neutralization.md`); originals are kept, by design, because
stripping them outright was judged higher-risk than mirroring.

### 4. Binary asset URLs — repo-relative, no filesystem paths exposed ✅

`/api/system-template-preview/assets/[templateId]/[...assetPath]/route.ts`
resolves the request to a filesystem path via `getTemplateAssetFilePath`
(which validates the resolved path stays inside the template's asset bundle —
a path-traversal guard, not strictly a neutrality concern, but worth noting as
a sound adjacent control) and streams the bytes back. The URL the browser sees
is always `/api/system-template-preview/assets/{templateId}/{relativePath}` —
never the underlying `C:\Users\...\OneDrive...` or `Program Files` path.

### 5. Debug surfaces — clean payloads, but exposure is broader than it should be ⚠️

`window.__projecthubTemplateDebug` and `window.__hideTemplateGlyphTest`
(`ProjectHubTemplateGraphicPanel.tsx`) and the "Debug metadata" panel
(`system-template-preview.tsx`) all surface **node ids, selectors, computed
styles, and selection-id strings** — none of which are vendor/source
identifiers; they're either generated ids (`svg_123_6`) or point short names
(`RA-SD`) that already appear in the visible UI. **No vendor-string leakage was
found in debug payloads.**

However, the exposure *mechanism* is broader than necessary — the `window`
globals are installed unconditionally (not gated to development), which is a
separate, non-neutrality concern documented in full in
`template_debug_surface_notes.md` (Part 6). It is noted here because "debug
surfaces leak no vendor data" and "debug surfaces should not exist outside
development" are two different properties, and this audit only attests to the
first.

## Summary

| Surface | Vendor/source leakage? | Mechanism |
| --- | --- | --- |
| `notes` in graphic package / preview page | No | `sanitizeNotes()` regex filter (duplicated, but consistent) |
| Runtime selector/matching code | No | keys on `data-template-*`, `data-filter`, `short-name`, `key-data-attr` — never `jci-*` |
| SVG/HTML markup sent to browser | No | `rewriteTemplateAssetReferences` + `neutralizeTemplateMarkupAttributes` |
| Binary asset URLs | No | repo-relative `/api/.../assets/...`, traversal-guarded |
| Debug snapshots / globals | No (payload) / Yes (exposure scope — see Part 6) | ids + selection keys only; but installed unconditionally |

**Overall: the runtime is neutral with respect to vendor/source identifiers.**
The one open item is *exposure scope* of debug surfaces, not data leakage
within them — tracked in `template_debug_surface_notes.md`.
