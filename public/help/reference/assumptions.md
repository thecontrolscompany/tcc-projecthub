# Known Assumptions and Limitations

## General

- **No backend** — all data is stored in browser local storage. Clearing browser data deletes all estimates.
- **Single user** — there is no multi-user support or conflict resolution. One browser session at a time.
- **No cloud sync** — estimates do not sync across devices or browsers.
- **Internal edition only** — price book, system wizard, and conduit fill are not available in the customer edition.

## Pricing Model

- Assembly prices are based on the EBT (Electrical Budgeting Tool) legacy catalog from CCT. Prices reflect internal cost assumptions and are not externally sourced.
- Material costs do not include sales tax, shipping, or distributor markup unless the assembly definition explicitly includes it.
- Labor hours assume a skilled BAS technician working on a standard commercial project. Adjust the labor adjustment factor in project settings for difficult access, remote locations, or premium sites.
- The price book does not auto-update from any external source. Prices must be manually updated via CSV import or per-assembly override.

## Estimating Scope

- Component selections represent controls scope only — no mechanical equipment, ductwork, piping, or electrical panels.
- Wiring quantities (conduit, wire, home runs) are included as assembly line items but require estimator judgment for accurate quantities.
- The points list is generated from component selections and is a reference tool — it is not a certified sequence of operations or submittal document.

## System Types

- **Plant** — plant items do not have configuration-driven component rules. All selections are manual after choosing the plant type.
- **Network** — all network components are optional and default to unselected. Network scope is highly job-specific.
- **VRF** — VRF assemblies assume BACnet integration. Proprietary protocol integration may require different assembly selections.

## Legacy Source References

Assembly IDs (60xxx series) originated from the CCT EBT system. For historical context on any assembly ID, see the legacy source documents in `docs/legacy-source/`.

For the EBT assembly-to-component mapping analysis, see `docs/legacy-source/SELECTION_TREE_TO_EBT_CORRELATION.md`.

---

*This document is maintained by The Controls Company engineering team. Report discrepancies to the estimating team lead.*
