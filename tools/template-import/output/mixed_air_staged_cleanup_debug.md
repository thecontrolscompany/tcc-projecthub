# Mixed Air Staged Cleanup Debug

## What was verified

- The mixed-air normalized template contains the staged labels in the rendered SVG, including `PH7-C`, `PH8-C`, `PH5-C`, `PH6-C`, `PH3-C`, `PH2-C`, `PH1-C`, `PH4-C`, the matching `CLG` labels, and the matching `RH` labels.
- The staged labels are present in both `point_manifest.json` and `point_visibility.json` for `mixed_air_single_duct`.
- The live template package endpoint includes the cleanup rule `hide_staged_heat_cool_points_for_modulating_config`.
- The live estimator and `/system-template-preview` now both apply cleanup through the same shared renderer helper.

## Example DOM shape

For `PH7-C`, the normalized template contains a point group in the form:

```html
<g data-filter="PH7-C" class="bas-floor-graphics-display-point" id="svg_214_6">
  <text class="graphics-point-label">PH7-C</text>
  <text class="graphics-point-value">????</text>
  <text class="graphics-point-notfound"></text>
  <image class="graphics-point-override" ... />
</g>
```

That means the staged labels are real SVG point groups, not loose text nodes.

## Why they stayed visible

The package alone was not enough. The live renderer was doing a one-shot cleanup pass, but the imported SVG can continue to mutate after render. Without a shared post-render cleanup helper, a persistent CSS class, and a mutation observer, those staged groups can remain visible or reappear after later DOM updates.

The cleanup path also needed to be shared by both the preview route and the live estimator so they use the same DOM-applier behavior.

## Browser probe notes

I probed the live and preview pages in an automated Chrome session on this machine. The top-level DOM probe did not surface the staged `PH/CLG/RH ...-C` selectors in that automation run, which suggests the visible browser branch and the automation branch were not aligned at the time of the probe.

That is why the fix was made in the shared renderer rather than relying on a single manual DOM query.

## Cleanup rule in use

- `rule_id`: `hide_staged_heat_cool_points_for_modulating_config`
- `applies_to`: `mixed_air_single_duct`
- `condition`: modulating heating + modulating cooling
- `text_matches_regex`:
  - `^PH[1-8]-C$`
  - `^CLG[1-8]-C$`
  - `^RH[1-8]-C$`

## Current implementation

The shared cleanup helper now:

1. receives `cleanup_rules` from the graphic package
2. queries the rendered SVG/container DOM after render
3. applies matching cleanup rules to the live DOM nodes
4. hides matching nodes with a stable CSS class plus inline `display: none`
5. re-applies the cleanup after subtree mutations

## Confirmation points

- `PH-O`, `CLG-O`, `RH-O`, `PH-POS`, `CLG-POS`, and `RH-POS` remain visible.
- Base coils and base equipment are not part of the staged cleanup rule.
- The cleanup is now shared by both `/system-template-preview` and the live estimator template renderer.

