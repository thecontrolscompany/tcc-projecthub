# Template Visual QA

- QA scope limited to: mixed_air_single_duct, vav_single_duct, air_cooled_chiller_plant_one_chiller_two_pumps
- Review performed against normalized bundles under `tools/template-import/output/normalized-system-templates/`.
- Runtime preview remains vendor-neutral and isolated from the live estimator.

## mixed_air_single_duct

- Render status: pass
- Asset status: clean
- Visual quality notes: stable preview, moderate point density, strong label coverage
- Visible clutter: moderate
- Point toggle behavior: works_at_label_group_level
- Device glyph toggle behavior: proven_for_key_points
- Problems found: manual review still needed for a handful of ambiguous fan/reheat mappings
- Recommended readiness status: ready_for_estimator_trial
- Point labels visible: yes
- Strong glyph mappings: 136
- Exact ontology matches: 22
- Manual review points: 63

## vav_single_duct

- Render status: pass
- Asset status: clean
- Visual quality notes: compact layout, good fit in preview pane, some abbreviated labels
- Visible clutter: low to moderate
- Point toggle behavior: works_at_label_group_level
- Device glyph toggle behavior: partial_manual_review
- Problems found: alias bridge covers core supply air points; some output semantics remain ambiguous
- Recommended readiness status: needs_mapping_cleanup
- Point labels visible: yes
- Strong glyph mappings: 21
- Exact ontology matches: 15
- Manual review points: 8

## air_cooled_chiller_plant_one_chiller_two_pumps

- Render status: pass
- Asset status: clean
- Visual quality notes: plant layout spans wide canvas, readable but dense in inspection mode
- Visible clutter: moderate to high due to dense plant controls
- Point toggle behavior: works_at_label_group_level
- Device glyph toggle behavior: partial_manual_review
- Problems found: plant points are renderable, but most mappings are still source-short-name driven
- Recommended readiness status: needs_mapping_cleanup
- Point labels visible: yes
- Strong glyph mappings: 16
- Exact ontology matches: 6
- Manual review points: 0

