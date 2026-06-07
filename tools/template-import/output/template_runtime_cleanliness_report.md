# Template Runtime Cleanliness Report

- Generated at: 2026-06-07T19:37:41.418Z
- Companion audit: `runtime_neutrality_audit.md` (manual trace) — this script encodes its findings as a repeatable, automated check

## What this validates
- Runtime matching/selector code (panel, preview component, cleanup helpers, package assembly) never references vendor `jci-*` attribute names — only the offline generation script and the neutralization mirror's mapping table are allowed to name them.
- `templateGraphicPackage.ts` wires both `neutralizeTemplateMarkupAttributes()` and `sanitizeNotes()` into the markup/notes pipeline.
- `templateAttributeNeutralization.ts` defines the full expected set of neutral `data-template-*` attribute names.
- `window.__projecthubTemplateDebug` / `window.__hideTemplateGlyphTest` (and their teardown) are gated behind `process.env.NODE_ENV !== 'production'`, matching the existing `showTemplatePreviewBadge` pattern.
- Served template artifacts (normalized markup, point-visibility manifest) carry no raw vendor source-path strings (`Program Files`, `ProgramData`, `Johnson Controls`, user-profile paths, `file://`).

## Checks performed
- Scanned for `jci-` references: src/modules/hvac-estimator/shared/ProjectHubTemplateGraphicPanel.tsx
- Scanned for `jci-` references: src/components/system-template-preview.tsx
- Scanned for `jci-` references: src/lib/projecthub-system-templates/templateCleanup.ts
- Scanned for `jci-` references: src/lib/projecthub-system-templates/templateGraphicPackage.ts
- Confirmed neutralizeTemplateMarkupAttributes() and sanitizeNotes() are wired into src/lib/projecthub-system-templates/templateGraphicPackage.ts
- Confirmed src/lib/projecthub-system-templates/templateAttributeNeutralization.ts defines all 5 expected neutral attribute names
- Confirmed window.__projecthubTemplateDebug and window.__hideTemplateGlyphTest are gated behind `process.env.NODE_ENV !== 'production'` in src/modules/hvac-estimator/shared/ProjectHubTemplateGraphicPanel.tsx
- Scanned served artifact for raw vendor source paths: tools/template-import/output/mixed_air_single_duct/normalized_template.html
- Scanned served artifact for raw vendor source paths: src/data/projecthub/system-templates/mixed_air_single_duct_point_visibility.json

## `jci-*` Reference Scan (runtime matching code)
- No `jci-*` references found in runtime matching/selector code.

## Vendor Source-Path Scan (served artifacts)
- No raw vendor source-path strings found in served template artifacts.

## Result
- PASS

## Issues
- None
