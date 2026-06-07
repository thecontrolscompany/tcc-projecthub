# Template Visual QA

- QA scope: mixed_air_single_duct, five_chiller_secondary_loop, vav_single_duct, air_cooled_chiller_plant_one_chiller_two_pumps
- Review performed against the live `/system-template-preview` route using the repaired asset pipeline.
- Screenshots captured under `tools/template-import/output/template_visual_qa_screenshots/`.

## mixed_air_single_duct

- Template ID: mixed_air_single_duct
- Render status: pass
- Image status: pass
- Visual quality: clean fit in preview panel
- Toggle behavior: works
- Glyph behavior: needs review
- Readiness status: needs_mapping_cleanup
- No broken image icons observed: yes
- No local file references: yes
- No source/vendor names visible: yes
- Screenshot: tools/template-import/output/template_visual_qa_screenshots/mixed_air_single_duct.png
- Notes: preview route renders assets through the ProjectHub asset endpoint, hides imported dashboard modules by default, and suppresses preview-only alias labels.

## five_chiller_secondary_loop

- Template ID: five_chiller_secondary_loop
- Render status: pass
- Image status: pass
- Visual quality: clean fit in preview panel
- Toggle behavior: works
- Glyph behavior: works where mapped
- Readiness status: ready_for_estimator_trial
- No broken image icons observed: yes
- No local file references: yes
- No source/vendor names visible: yes
- Screenshot: tools/template-import/output/template_visual_qa_screenshots/five_chiller_secondary_loop.png
- Notes: preview route renders assets through the ProjectHub asset endpoint, hides imported dashboard modules by default, and suppresses preview-only alias labels.

## vav_single_duct

- Template ID: vav_single_duct
- Render status: pass
- Image status: pass
- Visual quality: clean fit in preview panel
- Toggle behavior: works
- Glyph behavior: needs review
- Readiness status: needs_mapping_cleanup
- No broken image icons observed: yes
- No local file references: yes
- No source/vendor names visible: yes
- Screenshot: tools/template-import/output/template_visual_qa_screenshots/vav_single_duct.png
- Notes: preview route renders assets through the ProjectHub asset endpoint, hides imported dashboard modules by default, and suppresses preview-only alias labels.

## air_cooled_chiller_plant_one_chiller_two_pumps

- Template ID: air_cooled_chiller_plant_one_chiller_two_pumps
- Render status: pass
- Image status: pass
- Visual quality: clean fit in preview panel
- Toggle behavior: works
- Glyph behavior: works where mapped
- Readiness status: ready_for_estimator_trial
- No broken image icons observed: yes
- No local file references: yes
- No source/vendor names visible: yes
- Screenshot: tools/template-import/output/template_visual_qa_screenshots/air_cooled_chiller_plant_one_chiller_two_pumps.png
- Notes: preview route renders assets through the ProjectHub asset endpoint, hides imported dashboard modules by default, and suppresses preview-only alias labels.

## Recommendation

- First estimator trial candidate: five_chiller_secondary_loop
- Recommended because it is the cleanest rendered preview with the least mapping cleanup and the repaired asset pipeline is stable on this template family.
