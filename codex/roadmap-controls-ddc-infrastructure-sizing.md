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

## Phase 4 — candidate parts & draft pricing (v1 scope)

Draft retail/list pricing researched from public distributor listings
(Building Controls Group, Radwell, Blackhawk Supply — Kele.com requires
login so not used). **These are JCI list prices, not contractor net** —
expect Timothy to apply a significant discount via his Kele account later;
until then these are placeholder-for-real-shape numbers, several notably
higher than the generic placeholders they replace.

**Re-priced existing tiers** (feed `calcDdcInfrastructure` directly —
computed DDC bill totals will increase accordingly):

| Catalog ID | New `part_number` | `manufacturer` | New `mtl_unit` | Was | Source |
|---|---|---|---|---|---|
| `CTL-DDC-08` | `F4-CGE04060-0G` | Johnson Controls | `1335.00` | `650` | Building Controls Group (list) |
| `CTL-DDC-16` | `F4-CGE09090-0G` | Johnson Controls | `1921.00` | `950` | Building Controls Group (list); Metasys equiv `M4-CGM09090-0G` ~$1,690 new at Radwell |
| `CTL-NET-SUP` | `FX-SC9BASE-0` | Johnson Controls | `3007.89` | `2850` | Building Controls Group (list) |
| `CTL-PNL-MD` | `PA0000002BH0` | Johnson Controls | `954.44` | `685` | Blackhawk Supply |

**Re-priced, calc-inert tiers** (not currently consumed by
`calcDdcInfrastructure` — IO modules aren't sized in v1 per Task 116
simplification #3 — but useful for the Price Book / future IO-module
sizing):

| Catalog ID | New `part_number` | `manufacturer` | New `mtl_unit` | Was | Source |
|---|---|---|---|---|---|
| `CTL-IO-08` | `F4-XPM04060-0G` | Johnson Controls | `1075.80` | `285` | Building Controls Group (list) |
| `CTL-IO-16` | `F4-XPM09090-0G` | Johnson Controls | `1451.48` | `485` | Building Controls Group (list); non-`G` variant $729.96 new at Radwell |

**No real part identified — keep generic placeholder, flagged for future
curation**: `CTL-DDC-32`, `CTL-DDC-64` (no JCI FX/Metasys tier in the BOMs
reviewed maps to 32/64-point capacity), `CTL-PNL-SM` (`PA0000001AH0` exists
but no public pricing found — Kele login needed), `CTL-PNL-LG` (no larger
enclosure identified), `CTL-LIC-DEVICE` (see "License tiering" below —
re-pricing this row is a future calc change, not Phase 4).

**New rows** (catalog-only — not yet consumed by `calcDdcInfrastructure`,
available in the Price Book / for future calc refinement and manual
custom-part additions):

| New Catalog ID | `description` | `category` | `part_number` | `manufacturer` | `mtl_unit` | `hrs_unit` | `alternate_ids` | Source |
|---|---|---|---|---|---|---|---|---|
| `CTL-IO-16-BI` | IO Expansion Module - 18 Point (Binary Input Only) | IO Modules | `M4-XPM18000-0G` | Johnson Controls | `1165.54` | `1.5` | `["CTL-IO-16"]` | Radwell (new) |
| `CTL-PNL-XFMR` | Control Panel - 96VA Transformer | Panels | `PAN-96VAXFR-0` | Johnson Controls | `150.00` | `1.0` | `[]` | No public price found — placeholder |
| `CTL-PNL-UPS` | Control Panel - UPS Assembly (14x16x6) | Panels | `UPSPNL550-0` | Johnson Controls | `614.05` | `2.0` | `[]` | Blackhawk Supply |
| `CTL-LIC-MAINT` | Software Maintenance - Annual (25-99 Devices) | Software | `FX-SC9D025M1-0` | Johnson Controls | `424.32` | `0` | `[]` | Building Controls Group (list) |

Also add `"CTL-IO-16-BI"` to `CTL-IO-16`'s `alternateIds` (two-way cross-link,
same pattern as the existing `CTL-IO-08`/`CTL-IO-16` pairing).

## Phase 5 — candidate part & draft pricing

| New Catalog ID | `description` | `category` | `part_number` | `manufacturer` | `mtl_unit` | `hrs_unit` | `io_type` | `alternate_ids` | Source |
|---|---|---|---|---|---|---|---|---|---|
| `CTL-DEV-VAV-CTRL` | VAV Box Controller w/ Integral Actuator, DPT, BACnet | DDC Controllers | `M4-CVM03050-0` | Johnson Controls | `1306.79` | `1.0` | `null` | `[]` | Radwell (new); FX-line equiv `F4-CVE03050-0PG` found but no public pricing (Stromquist requires login) |

`hrs_unit: 1.0` is a placeholder for controls-side commissioning/point-mapping
labor for this device (separate from the existing `vav-ctrl` component's
$425/2.5hr install-side labor in `vavData.js`, which covers panel/enclosure
mounting and power/network home-run wiring — both costs apply per VAV box
once Phase 5 lands).

## Open design questions for Timothy

- **Point counting after Field Devices redesign**: solved in Field Devices
  Task 115 by adding `ioType` to each `CTL-DEV-*` row, so DDC sizing can
  derive AI/AO/BI/BO counts whether `controlsId` points at legacy
  `CTL-AI/AO/BI/BO/AI-WIRELESS` rows or the newer `CTL-DEV-*` rows.
- **JACE/supervisor sizing**: decided for v1 (Phase 2, shipped) as 1
  `CTL-NET-SUP` per estimate. Phase 4 re-prices this row with a real part but
  doesn't change the qty=1 model. Per-building/floor/system granularity
  (Eglin's submittal had 7 JACEs total) remains unscheduled future work —
  revisit if/when a multi-building estimate use case comes up.
- **License tiering**: NOT resolved by Phase 4 — real JCI licensing is sold
  in 25/100-device bands (~$2,616 / ~$7,728 list, see Phase 4 pricing table)
  that don't map to "qty = 1 per controller" without a banding lookup. Phase
  4 leaves `CTL-LIC-DEVICE` at its generic $125 placeholder rather than
  re-pricing it to a band price that would wildly overstate multi-controller
  jobs. `CTL-LIC-MAINT` (annual maintenance SKU) is added as a catalog-only
  row for the same future "license tiering" work — unscheduled, no phase
  number assigned yet.
- **Per-VAV-box controller**: resolved as Phase 5 — new Field-Device-style
  `CTL-DEV-VAV-CTRL` catalog row, referenced by the existing `vav-ctrl`
  component's `controlsId` in `vavData.js` (currently `null`). Priced via
  the standard per-instance controls cost model (no separate "DDC
  infrastructure" line). `calcDdcInfrastructure` gets a small adjustment so a
  VAV box's other point components (damper actuator, zone temp, etc.) don't
  also draw from the shared `CTL-DDC-*` point pool once it has its own
  dedicated controller — resolves Task 116 assumption #9.
- **Panel sizing**: partially addressed — Phase 4 re-prices `CTL-PNL-MD` with
  a real enclosure part (`PA0000002BH0`) and adds `CTL-PNL-XFMR`/`CTL-PNL-UPS`
  as new catalog-only rows for ancillary panel components seen in real
  submittals. Full dimension-based re-tiering of `CTL-PNL-SM/MD/LG` against
  real JCI enclosure sizes (vs. controller-count bands) remains unscheduled
  future work.

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

**Phase 4 — Catalog curation** Completed: `CTL-DDC-08/16`, `CTL-NET-SUP`,
`CTL-IO-08/16`, and `CTL-PNL-MD` were re-priced with real JCI FX/Metasys
parts, and four catalog-only rows were added: `CTL-IO-16-BI`, `CTL-PNL-XFMR`,
`CTL-PNL-UPS`, and `CTL-LIC-MAINT`. Sample DDC infrastructure bill for
`EST-2026-039` (`AI Test`) moved from `$66,725.00` before curation to
`$66,882.89` after curation; within that bill, `CTL-NET-SUP` moved from
`$2,850.00` to `$3,007.89` while `CTL-DDC-64` and `CTL-PNL-LG` stayed at
`$21,600.00` and `$1,150.00`. `CTL-PNL-XFMR` remains a placeholder pricing
item pending a better public source.

**Phase 5 — Per-VAV-box controller** (v1 scope decided — see "Phase 5 —
candidate part & draft pricing" above)
Add `CTL-DEV-VAV-CTRL` (real part `M4-CVM03050-0`, ~$1,307) to
`scripts/seed-controls-field-devices.mjs`. Re-pair `vavData.js`'s `vav-ctrl`
component (`controlsId: null` → `"CTL-DEV-VAV-CTRL"`) — a Field Devices
Phase C-style change for the VAV equipment type. Adjust
`calcDdcInfrastructure` so a VAV box with this controller selected excludes
its other point components from the shared AI/AO/BI/BO pool (resolves Task
116 assumption #9 double-count flag).

## Touched files (anticipated)

- `src/modules/hvac-estimator/components/estimate/estimateCalc.js` — Phases 2
  (done) and 5 (point-pool exclusion for VAV-dedicated controllers)
- `src/modules/hvac-estimator/components/estimate/EstimateDetail.jsx` — Phase
  3 (done)
- `scripts/seed-controls-assembly-catalog.mjs` — Phase 4 new/updated rows
  (all reuse existing `CAT_COLOR` categories — no `tokens.js` changes needed)
- `scripts/seed-controls-field-devices.mjs` — Phase 5 (`CTL-DEV-VAV-CTRL` row)
- `src/modules/hvac-estimator/components/vav/vavData.js` — Phase 5 only

No new migration anticipated for Phases 1-5 (existing schema covers it).
Phases 4/5 add/update catalog rows only.

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
