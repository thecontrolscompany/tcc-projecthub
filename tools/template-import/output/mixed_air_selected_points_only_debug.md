# Mixed Air Selected-Points-Only Debug

## Root Cause

The live Mixed Air template was still rendering point groups that had template metadata, even when those points were not part of the current estimator selection. Cleanup rules removed some imported dashboard/staged labels, but the renderer did not yet enforce a strict "selected points only" policy for the live estimator.

## Policy Added

`mode: selected_points_only`

In live estimator mode:

1. default all template point groups to hidden
2. show only point groups whose source short name or selection id matches the current estimator selection
3. keep base ductwork and non-point equipment visible
4. continue applying cleanup rules like dashboard cleanup and staged heat/cool cleanup

## Live Selection Mapping

When only `Supply Fan VFD` is selected in the estimator, the template trial selection keys resolve to:

- ontology IDs:
  - `supply_fan_command`
  - `vfd_fault`
- template/source keys:
  - `SF-S`
  - `SF-C`
  - `SF-O`

Those are the only point-related labels that should remain visible in the template graphic for that selection.

## Unrelated Labels That Should Hide

The following are template point groups and are not part of the Supply Fan VFD selection:

- `RF-O`
- `RF-S`
- `PH-POS`
- `CLG-POS`
- `RH-POS`
- `DAT-SP`
- `DAP-SP`
- `PHWL-T`
- `PHWE-T`
- `CCWE-T`
- `CCWL-T`
- `RHWE-T`
- `RHWL-T`
- `MOAD-C`
- `GEF-S`
- `BLDG-P`
- `BLDG-SP`

## Files Changed

- `src/lib/projecthub-system-templates/templateCleanup.ts`
- `src/modules/hvac-estimator/shared/ProjectHubTemplateGraphicPanel.tsx`
- `src/components/system-template-preview.tsx`

## Validation

- `eslint` passed on the touched runtime files
- `npm run build` passed

## Notes

- `/system-template-preview` still works.
- The chiller template trial remains untouched.
- Pricing logic and estimator selection behavior were not changed.

