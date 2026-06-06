# ProjectHub System Template Registry Notes

- The registry now treats normalized complete-system templates as the primary graphics source.
- The symbol registry remains fallback and custom overlay support.
- Runtime paths are vendor-neutral and point into ProjectHub-controlled template bundles.
- Private source bundle paths remain local to the workspace and are not used in ProjectHub-facing route names.

## Bulk import contract

- `normalized_template_path` points to the browser-loadable template shell.
- `asset_base_path` points to the preview/runtime asset root.
- `point_manifest_path` points to the source-to-point contract.
- `visibility_manifest_path` points to point-to-glyph visibility rules.
- `fallback_symbol_overlays` carries the fallback/custom overlay selectors for mixed or partial assemblies.
