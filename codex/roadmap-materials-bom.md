# Roadmap — Materials / BOM Tab

## Core concept

**GFE (Government/Customer Furnished Equipment) tracking.**
These are parts the *customer ships to TCC* for TCC to install — not parts TCC purchases.
The BOM defines what's expected; the receiving log tracks what has actually arrived on site.

Reference example: `SOF BOM 4-3-26.xlsx` (project 2025-026, SOF Human Performance Training Center)
- Column structure: Designation | Total Qty | Code Number | Description | Qty Received | Remain/Surplus
- Items are grouped by section: Field Devices, Panel Devices, Valves/VFDs/Flow Stations
- Remain/Surplus is a calculated field (Qty Received - Total Qty)

---

## Where it lives

New tab inside each project: **Overview | WIP | Materials | Documents**

---

## Data model

### `bom_items` table
```sql
id              uuid PK
project_id      uuid FK projects
section         text        -- "Field Devices", "Panel Devices", "Valves", etc.
designation     text        -- e.g. "AHU-1", "CVM", "ZN-T,-SP,-CO2"
code_number     text        -- manufacturer part number
description     text
qty_required    integer
notes           text
created_at      timestamptz
updated_at      timestamptz
```

### `material_receipts` table (receiving log — one row per delivery event)
```sql
id              uuid PK
bom_item_id     uuid FK bom_items
qty_received    integer
date_received   date
received_by     uuid FK profiles
packing_slip    text        -- packing slip number or reference (from scan or manual entry)
notes           text
created_at      timestamptz
```

### Computed fields (derived, never stored)
- `qty_received_total` = SUM of receipts for that bom_item
- `remain_surplus` = qty_received_total - qty_required (negative = short, positive = surplus)
- `status`:
  - 0 received → Not Received 🚨
  - 0 < received < required → Partial
  - received >= required → Received ✓
  - surplus → Surplus ⚠

---

## UI

### Summary cards (top of Materials tab)
- Total line items
- % Fully Received
- # Items Still Needed 🚨
- # Partial / Surplus

### Main BOM table
Grouped by section (collapsible), matching Excel layout:

| Designation | Code Number | Description | Total Qty | Qty Rec'd | Remain/Surplus | Status |
|---|---|---|---|---|---|---|

Row color coding:
- Red = Not Received
- Yellow = Partial
- Green = Received
- Amber = Surplus

### Filters
- Show Missing Only toggle
- By Section
- By Status

### Receiving log (expandable per row)
Date | Qty | Packing Slip | Received By | Notes

---

## How BOM gets populated

**Phase 1 — Import from Excel**
Upload the customer-provided BOM Excel file. Parser reads:
- Row groupings (section headers)
- Designation, Code Number, Description, Total Qty, Qty Received

This matches the SOF BOM format and likely applies to other projects on similar contracts.

**Phase 2 — Manual entry**
Admin can add/edit BOM line items directly in the portal.

**Phase 3 — Future**
If customer provides structured data (e.g. via API or standard format), auto-import.

---

## Workflow

1. **Admin/PM** imports customer-provided BOM Excel file into project
2. **PM** receives shipment on site → logs receipt (manual or packing slip scan)
3. **Portal** shows live Remain/Surplus per line item
4. **PM/Admin** can see at a glance what's still expected and what arrived with surplus
5. **WIP integration** (future): missing items auto-flag associated tasks as Blocked

---

## Priority: Medium-High
## Depends on: Nothing (standalone tab)
## Suggested task number: 049
