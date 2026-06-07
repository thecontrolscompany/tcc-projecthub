# ProjectHub Template Point Aliases

- This layer bridges source short names to candidate ontology IDs, estimator point roles, and estimator selection ids.
- It is intentionally separate from the canonical ontology and does not modify source ontology IDs.
- Exact ontology matches are used when available; ambiguous or missing mappings stay flagged for manual review.
- `estimator_selection_ids` are bridge metadata for estimator-selection ids such as companion feedback rows.
- These selection ids are not canonical ontology ids and should not be treated as ontology changes.
- Alias entries generated: 91
- Review templates covered: mixed_air_single_duct, vav_single_duct, air_cooled_chiller_plant_one_chiller_two_pumps

## Usage

- Use this layer when translating imported template labels into estimator concepts.
- Use `estimator_selection_ids` when translating parent/child estimator selection rows into template source short names.
- The live template renderer uses the same bridge to decide whether a selected estimator point is represented on the graphic or should be listed in Additional Points.
- Keep the symbol registry as fallback/custom overlay support when a source short name remains ambiguous.
