# Five Chiller Estimator Trial

Feature flag:
- `NEXT_PUBLIC_PROJECTHUB_TEMPLATE_GRAPHICS_PREVIEW=true`

Scope:
- Trial target template: `five_chiller_secondary_loop`
- Estimator flow: central plant only
- Matching plant type: `chiller-water`
- No AHU, VAV, pricing, or unrelated estimator flow changes

Behavior:
- With the flag off, the existing estimator graphics remain unchanged.
- With the flag on and the selected plant resolving to the chiller-water trial path, the estimator renders the normalized system-template graphic.
- If the template payload cannot be loaded, the estimator falls back to the existing graphics automatically.
- Pricing and estimator state remain the source of truth; the template graphic is presentation only.

Implementation notes:
- The trial uses the existing system template registry and alias helpers.
- The estimator passes selected ontology ids into the template graphic renderer.
- Point labels and glyph visibility are driven from the normalized template visibility rules.
- Private source paths and vendor/source names stay out of the runtime payload and visible UI.

How to test:
1. Set `NEXT_PUBLIC_PROJECTHUB_TEMPLATE_GRAPHICS_PREVIEW=false` and open a chiller-water estimate.
2. Confirm the legacy estimator graphic still renders.
3. Set `NEXT_PUBLIC_PROJECTHUB_TEMPLATE_GRAPHICS_PREVIEW=true`.
4. Open the same chiller-water estimate and confirm the five-chiller secondary loop template renders.
5. Open a non-target plant type and confirm the legacy graphics still render.

Fallback behavior:
- If the flag is disabled, the estimator always uses the existing graphics path.
- If the flag is enabled but the selected estimate does not match the trial plant path, the existing graphics path remains in use.
- If the template request fails or the package is missing, the component falls back to the legacy graphics path.

Known limitations:
- The trial is intentionally limited to one plant template only.
- The feature flag is build-time environment driven for the preview bundle.
- The template renderer is presentation-only and does not alter pricing or estimate state.
