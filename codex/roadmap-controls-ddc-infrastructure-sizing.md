# Roadmap — DDC Infrastructure Sizing

## Core concept

Estimates currently have **zero cost for DDC infrastructure** — no DDC
controllers, IO expansion modules, panels, supervisory controller/JACE,
network switches, software licenses, or the engineering labor/graphics that
go with them. `controls_assembly_catalog` already has seeded rows for all of
these categories (generic "by capacity tier" abstractions, same pattern as
the old IO points), but **nothing in `estimateCalc.js` or
`EstimateDetail.jsx` ever selects or sizes them** — they're catalog rows with
no consumer.

This roadmap item adds the calc logic + UI to automatically size and price
this "brains of the system" bill from an estimate's point count and
equipment mix, and curates real Johnson Controls FX/Metasys parts for the
generic tiers.

## Why

Real DDC submittals (Eglin 1416, SOF Human Performance Training Center) show
JACE/supervisor controllers, multiple controller sizes, IO expansion modules,
panels/transformers/UPS, and device-count-tiered software licenses as
substantial line items — often a meaningful fraction of total controls cost
on a job. None of that shows up in a TCC ProjectHub estimate today; Controls
Material/Eng. Labor only reflects per-point IO costs (and, after the Field
Devices redesign, per-device field-part costs). The controller/panel/network
layer is a real, currently-invisible cost gap.

## What's already in place

`controls_assembly_catalog` rows seeded via
`scripts/seed-controls-assembly-catalog.mjs` (generic by-capacity tiers, with
`alternate_ids` cross-linking tiers for substitution):

- **DDC Controllers**: `CTL-DDC-08/16/32/64` (8/16/32/64-point capacity,
  $650-$2400)
- **IO Modules**: `CTL-IO-08/16`
- **Panels**: `CTL-PNL-SM/MD/LG`
- **Network**: `CTL-NET-SUP` (supervisor/JACE), `CTL-NET-SW8/SW16`
- **Software**: `CTL-LIC-DEVICE` (per-controller device license),
  `CTL-LIC-WORKSTATION`
- **Engineering Labor**: `CTL-ENG-PROGRAM/COMMISSION/SUBMITTAL`
- **Graphics**: `CTL-GFX-EQUIP/FLOORPLAN`

All of these already have `CAT_COLOR` entries in `tokens.js`. Phase A of the
Field Devices redesign (`codex/roadmap-controls-field-devices.md`) added
`part_number`/`manufacturer` columns to `controls_assembly_catalog` — these
rows can be curated with real parts via the existing Price Book UI with no
further schema changes.

## What's missing

- No calc step counts total IO points (AI/AO/BI/BO) across an estimate's
  selected components.
- No logic bins a total point count into a quantity of `CTL-DDC-*`
  controllers (8/16/32/64-point tiers).
- No logic for IO module quantity, panel size/quantity, network/JACE
  quantity, or license quantity.
- No per-VAV-box controller line item. VAV boxes use a small dedicated DDC
  controller (one per box), not drawn from the general point-count pool —
  189 of these on the Eglin job alone, 13 on SOF.
- No UI section anywhere shows a computed "DDC infrastructure" bill.
- No engineering labor / graphics / software line items computed from
  controller count or project scope.

## Real parts identified so far (Eglin 1416 + SOF Human Performance BOMs)

| Existing tier | Part # | Manufacturer | Description | Notes |
|---|---|---|---|---|
| `CTL-NET-SUP` | `JCI-FXSC9BASE0` | Johnson Controls | FX90 Supervisory Controller, micro SD, 2 RS485, 2x 10/100MB Ethernet | JACE/supervisor |
| `CTL-DDC-16` (approx) | `F4-CGE09090-0G` / `M4-CGM09090-0G` | Johnson Controls | 18-Point General Purpose Controller, 7UI/2BI/4CO/2AO/3BO, BACnet/IP+MSTP | |
| `CTL-DDC-08` (approx) | `F4-CGE04060-0G` | Johnson Controls | 10-Point General Purpose Controller, 3UI/1BI/4CO/2BO | |
| `CTL-IO-16` (approx) | `F4-XPM09090-0G` / `M4-XPM09090-0G` | Johnson Controls | 18-Point IO Expansion Module, 7UI/2BI/4CO/2AO/3BO | |
| `CTL-IO-08` (approx) | `F4-XPM04060-0G` | Johnson Controls | 10-Point IO Expansion Module, 3UI/1BI/4CO/2BO | |
| *(new — no current tier)* | `M4-XPM18000-0G` | Johnson Controls | 18 Binary Input Expansion Module | all-BI variant, doesn't fit AI/AO/BI/BO mixed tiers |
| `CTL-PNL-*` (approx) | `PA0000002BH0` / `PA0000001AH0` | Johnson Controls | 6x24x36 enclosure w/10 outlets / 6x20x24 w/5 outlets | real dims don't map 1:1 to SM/MD/LG yet |
| *(new — no current tier)* | `PAN-96VAXFR-0` | Johnson Controls | 96VA Transformer Panel | not in current taxonomy |
| *(new — no current tier)* | `UPSPNL550-0` | Johnson Controls | UPS Assembly, 14x16x6, w/DP | not in current taxonomy |
| `CTL-LIC-DEVICE` (approx) | `FX-SC9CL100-0` / `FX-SC9CL025-0` / `FX-SC8DL25-0` | Johnson Controls | FX90 field-device licenses: Core 100, Core 25, +25-device add-on | licensing is tiered by total device count, not flat per-controller |
| *(new — no current tier)* | `FX-SC9D100M1-0` / `FX-SC9D025M1-0` | Johnson Controls | 1-yr software maintenance, 100-199 / 25-99 field devices | annual maintenance — maps loosely to nothing current |
| *(new — per-VAV-box, no catalog row)* | `F4-CVE03050-0PG` / `M4-CVM03050-0PG` | Johnson Controls | VAV Controller, INT ACT, POS FDBK, DPT, 3UI/2CO/3BO, BACnet/N2 | 189 qty at Eglin, 13 at SOF — needs its own catalog row |

## Open design questions for Timothy

- **Point counting after Field Devices redesign**: solved in Field Devices
  Task 115 by adding `ioType` to each `CTL-DEV-*` row, so DDC sizing can
  derive AI/AO/BI/BO counts whether `controlsId` points at legacy
  `CTL-AI/AO/BI/BO/AI-WIRELESS` rows or the newer `CTL-DEV-*` rows.
- **JACE/supervisor sizing**: 1 per project, or 1 per building/floor/system?
  (Eglin's submittal had 7 JACEs total across the building.)
- **License tiering**: licenses are banded by total device count (25/100/etc),
  not a flat per-controller multiplier — needs a lookup table, not simple
  arithmetic.
- **Per-VAV-box controller**: should this be a new Field-Device-style
  catalog row referenced by each VAV box's `controlsId` (reuses the
  substitution/custom-part machinery from Field Devices Phase A/B), or a
  separate "DDC infrastructure" line counted by VAV box quantity? The former
  seems simpler and is effectively a Field Devices Phase C item for the VAV
  equipment type — but the controller is sized once per box, not once per
  point, so it doesn't fit the existing per-point cost model exactly.
- **Panel sizing**: real JCI enclosures (6x20x24, 6x24x36) don't map cleanly
  onto "Small/Medium/Large (N controllers)" — may need re-tiering by actual
  dimensions vs. controller+IO module count, or by controller count directly.

## Phasing (draft)

**Phase 1 — Point-type tagging**
Completed in Field Devices Task 115: `ioType` (AI/AO/BI/BO) is now present on
the 27 `CTL-DEV-*` rows, so total point counts can be derived from an
estimate's selected components independent of whether `controlsId` points at
legacy `CTL-AI/AO/BI/BO` rows or `CTL-DEV-*` rows.

**Phase 2 — Sizing calc**
New function(s) (in `estimateCalc.js` or a new module) that take total point
counts plus equipment counts (e.g. VAV box count) and return a bill of DDC
controllers, IO modules, panels, network/JACE, licenses, engineering labor,
and graphics — bin-packed into the existing capacity tiers.

**Phase 3 — UI**
New read-only section (in `EstimateDetail.jsx` or the Turnkey Cost Summary)
showing the computed DDC infrastructure bill. Project-level, not
per-instance-substitutable like Field Devices.

**Phase 4 — Catalog curation**
Real parts/prices/hours for `CTL-DDC-*`/`CTL-IO-*`/`CTL-PNL-*`/`CTL-NET-*`/
`CTL-LIC-*` using Phase A's `part_number`/`manufacturer` columns (already
exist, no schema change). Add new rows for items with no current tier
(transformer panel, UPS panel, BI-only expansion module, maintenance SKUs).

**Phase 5 — Per-VAV-box controller**
Add a `CTL-DEV-VAV-CTRL`-style catalog row and re-pair the VAV equipment
type's controller `controlsId` to it — effectively a Field Devices Phase C
item for VAV, once this row exists.

## Touched files (anticipated)

- `src/modules/hvac-estimator/components/estimate/estimateCalc.js` — new
  sizing functions
- `src/modules/hvac-estimator/components/estimate/EstimateDetail.jsx` — new
  UI section
- `src/modules/hvac-estimator/shared/tokens.js` — possible new categories/
  colors if new tiers are added (transformer/UPS panels, BI-only expansion)
- `scripts/seed-controls-assembly-catalog.mjs` — new/updated rows
- `src/modules/hvac-estimator/components/vav/vavData.js` — Phase 5 only

No new migration anticipated for Phases 1-3 (existing schema covers it).
Phases 4/5 add catalog rows only (no schema change).

## Priority / Dependencies

- Independent of Field Devices Phases A (done) / B (in progress) for the
  catalog/part-curation side (Phase 4 here).
- Phase 1 (`ioType` tagging) should land alongside or before Field Devices
  Phase C (re-pairing `controlsId`), since Phase C is the natural point to
  add `ioType` to each new `CTL-DEV-*` row.
- Phase 5 (per-VAV-box controller) is effectively a Field Devices Phase C
  item for the VAV equipment type, once the catalog row exists.
- Phases 2/3 (sizing calc + UI) can proceed independently of Field Devices
  using today's `CTL-AI/AO/BI/BO` point types as a starting point, then pick
  up `ioType` from `CTL-DEV-*` rows once Phase 1/Field Devices Phase C land.
