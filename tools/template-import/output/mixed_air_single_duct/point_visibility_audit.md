# Point Visibility Audit

- Total point labels found: 142
- Total point-like controls found in template markup: 164
- Total glyph targets found: 43
- Point labels linked to glyphs: 142
- Point labels without glyphs: 0
- Ambiguous mappings: 20

## Mapped examples

- RA-SD: smoke detector asset and label are both controlled by the same point rule.
- RF-S / RF-C / RF-O: bound fan symbol use nodes are linked through pointShortName.
- RA-T / RA-H / RAT-SP / RAH-SP: bound sensor symbol use nodes are linked through pointShortName.
- RA-P / RAP-SP: bound static pressure sensor use nodes are linked through pointShortName.

## Manual review

- Points with label-only visibility:
  - 
- Confidence below 0.80:
  - MAD-O (0.93), PFILT-S (0.93), PH-O (0.93), PH-POS (0.93), CLG-O (0.93), CLG-POS (0.93), RH-O (0.93), RH-POS (0.93), FFILT-S (0.93), DAT-SP (0.93), MAD-O (0.93), PH-O (0.93), PH-POS (0.93), CLG-POS (0.93), CLG-O (0.93)
- Smoke detector rule:
  - confirmed
