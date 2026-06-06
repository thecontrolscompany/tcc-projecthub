# Estimator Template Integration Readiness

- Scope limited to mixed_air_single_duct, vav_single_duct, and air_cooled_chiller_plant_one_chiller_two_pumps.
- This report assumes the live estimator remains untouched until a trial is explicitly approved.

## mixed_air_single_duct

- Template name: Mixed Air Single Duct
- Safe for limited estimator trial: yes
- Source-short-name only points: MAD-O, RAPLO-A, RA-SD, RA-H, RAH-SP, RA-P, RAP-SP, MOAD-S, MOAD-C, GEF-C, GEF-S, PFILT-S, CC-T, RHC-T, DAPHI-A, FFILT-S, CLG7-C, CLG8-C, CLG6-C, CLG5-C, CLG4-C, CLG3-C, CLG2-C, CLG1-C, RH1-C, RH2-C, RH3-C, RH4-C, RH6-C, RH7-C, RH8-C, RH5-C, PH1-C, PH2-C, PH3-C, PH4-C, PH5-C, PH6-C, PH7-C, PH8-C, PHWL-T, PHWE-T, CCWL-T, CCWE-T, RHWL-T, RHWE-T, DA1-P, DAP-SP, LT-A
- Reliable ontology points: RF-C, RF-S, RF-O, RA-T, RAT-SP, MA-T, PH-O, PH-POS, PH-T, CLG-O, CLG-POS, RH-O, RH-POS, DA-SD, DA-T, DAT-SP, RA-F, MOA-F, OA-F, SF-S, SF-C, SF-O
- Manual review required points: RF-C, MAD-O, RF-S, RF-O, RAPLO-A, RA-SD, RA-H, RAH-SP, RA-P, RAP-SP, MOAD-S, MOAD-C, GEF-C, GEF-S, PFILT-S, PH-O, PH-POS, CLG-O, CLG-POS, CC-T, RH-O, RH-POS, RHC-T, DAPHI-A, FFILT-S, DA-SD, DA-T, CLG7-C, CLG8-C, CLG6-C, CLG5-C, CLG4-C, CLG3-C, CLG2-C, CLG1-C, RH1-C, RH2-C, RH3-C, RH4-C, RH6-C, RH7-C, RH8-C, RH5-C, MOA-F, PH1-C, PH2-C, PH3-C, PH4-C, PH5-C, PH6-C, PH7-C, PH8-C, OA-F, PHWL-T, PHWE-T, CCWL-T, CCWE-T, RHWL-T, RHWE-T, DA1-P, DAP-SP, SF-O, LT-A
- Proven device glyph points: RF-C, MAD-O, RF-S, RF-O, RAPLO-A, RA-SD, RA-T, RAT-SP, RA-H, RAH-SP, RA-P, RAP-SP, MOAD-S, MOAD-C, GEF-C, GEF-S, PFILT-S, MA-T, PH-O, PH-POS, PH-T, CLG-O, CLG-POS, CC-T, RH-O, RH-POS, RHC-T, DAPHI-A, FFILT-S, DA-SD, DA-T, DAT-SP, CLG7-C, CLG8-C, CLG6-C, CLG5-C, CLG4-C, CLG3-C, CLG2-C, CLG1-C, RH1-C, RH2-C, RH3-C, RH4-C, RH6-C, RH7-C, RH8-C, RH5-C, RA-F, MOA-F, PH1-C, PH2-C, PH3-C, PH4-C, PH5-C, PH6-C, PH7-C, PH8-C, OA-F, PHWL-T, PHWE-T, CCWL-T, CCWE-T, RHWL-T, RHWE-T, DA1-P, DAP-SP, SF-S, SF-C, SF-O, LT-A
- Remaining risks: fan/reheat/pressure sub-mappings still rely on manual review, but the template is stable enough for a limited trial

## vav_single_duct

- Template name: VAV Single Duct Terminal Unit
- Safe for limited estimator trial: no
- Source-short-name only points: SF-FB, DPR-O
- Reliable ontology points: SF-S, SF-O, SF-C, SA-F, SAFLOW-SP, SUPHTG-C, SUPHTG-O, CLG-O, HTG1-C, HTG3-C, HTG2-C, HTG-O, HC-O, SUMWIN-C, DA-T
- Manual review required points: SF-O, SF-FB, DPR-O, SUPHTG-O, CLG-O, HTG-O, HC-O, DA-T
- Proven device glyph points: SF-S, SF-O, SF-C, SF-FB, DPR-O, SA-F, SAFLOW-SP, SUPHTG-C, SUPHTG-O, CLG-O, HTG1-C, HTG3-C, HTG2-C, HTG-O, HC-O, SUMWIN-C, DA-T
- Remaining risks: output semantics need cleanup around HTG/CLG and SF-O points

## air_cooled_chiller_plant_one_chiller_two_pumps

- Template name: Air Cooled Chiller Plant One Chiller Two Pumps
- Safe for limited estimator trial: no
- Source-short-name only points: PCHWP1-S, PCHWP2-S
- Reliable ontology points: PCHWR-T, CH1-S, CH1-EN, PCHWS-T, PCHWP1-C, PCHWP2-C
- Manual review required points: none
- Proven device glyph points: PCHWR-T, CH1-S, CH1-EN, PCHWS-T, PCHWP1-C, PCHWP1-S, PCHWP2-S, PCHWP2-C
- Remaining risks: plant point roles still skew to source-short-name semantics and need alias refinement before estimator use

## Recommendation

- First estimator trial candidate: `mixed_air_single_duct`.
- Hold `vav_single_duct` and the plant template until alias cleanup proves stable across another preview cycle.
