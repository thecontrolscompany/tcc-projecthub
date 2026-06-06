# ProjectHub System Template Contract

This folder defines the runtime contract for normalized system graphics.

## Intent

- Normalize complete system graphics into a first-class template registry.
- Keep the existing symbol registry as a fallback/custom overlay layer.
- Avoid wiring the live estimator until the template loader is validated in isolation.
- Keep source traceability private and out of ProjectHub-facing runtime paths.

## Registry Fields

Each registry entry carries:

- `template_id`
- `display_name`
- `equipment_family`
- `system_type`
- `normalized_template_path`
- `asset_base_path`
- `point_manifest_path`
- `visibility_manifest_path`
- `supported_ontology_ids`
- `ontology_crosswalk`
- `unmapped_source_points`
- `fallback_symbol_roles`
- `replacement_ready`
- `notes`

The registry also allows private preview-only metadata such as `private_source_bundle_path` so local tooling can resolve the normalized bundle without exposing vendor-specific or install-path details at runtime.

## Loader Contract

The `src/lib/projecthub-system-templates` helper exports:

- `getTemplateForSystemType(systemType)`
- `getTemplateForOntologyIds(systemType, ontologyIds)`
- `getPointManifest(templateId)`
- `loadNormalizedTemplateMarkup(templateId)`
- `extractTemplateSvgMarkup(templateId)`
- `getTemplateAssetFilePath(templateId, assetPath)`

These helpers are server-side only and are meant to back the isolated preview route and future template-driven graphics loading.

## Mixed Air Baseline

The first concrete registry entry is `mixed_air_single_duct`.

- It is normalized from the private investigation bundle.
- It has a local point manifest.
- It has local assets copied into the bundle.
- It is marked `replacement_ready` for future runtime integration, but it is not wired into the estimator yet.

## Preview Surface

The isolated preview route uses the normalized Mixed Air bundle and the asset-serving route under `api/system-template-preview`.

The preview also consumes a point visibility manifest so label and glyph visibility can be driven from data instead of one-off selectors.

It is intentionally separate from:

- live estimator logic
- pricing logic
- existing AHU graphics components

## Limitations

- Only one concrete registry entry is populated right now.
- Asset serving is preview-only and private.
- Some source templates may still need normalization cleanup before they are good replacement candidates.
- The registry contract is designed for future expansion across AHU, VAV, FCU, CRAC, boiler, chiller, pump, tower, and plant graphics.
