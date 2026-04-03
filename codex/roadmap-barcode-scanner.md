# Roadmap — Packing Slip QR/Barcode Scanner for BOM Receiving

## Core concept

When a shipment arrives on site, the PM opens the portal on their **phone**, taps Scan,
and points the camera at the **packing slip's QR code or barcode**.
The portal matches it against the project BOM and logs the receipt — no manual typing.

This is a phone camera feature. The portal runs in the phone browser;
no app install required. "Webcam" in the library docs = any camera including phone camera.

---

## What gets scanned

**Packing slips** — not individual item barcodes.
A packing slip typically contains:
- PO number
- List of items + quantities in that shipment

The scan captures the packing slip reference. The PM then confirms the items
and quantities against the BOM before committing.

Some packing slips include a QR code that encodes structured data (items + qty).
Others just have a barcode that encodes a PO or slip number.
Both cases need to be handled.

---

## Tech approach

Library: `html5-qrcode` (MIT license)
```
npm install html5-qrcode
```
- Works in mobile browser (iPhone Safari, Android Chrome) — no app install
- Supports QR codes, Code 128, UPC, and most common barcode formats
- PM just opens the portal on their phone — same URL as desktop

---

## UI flow

### Case 1: QR code encodes structured data (items + qty)
1. PM opens project → Materials tab → taps **[ Scan Packing Slip ]**
2. Phone camera opens
3. PM points at QR code on packing slip
4. System parses items + quantities from QR data
5. Preview screen shows parsed items matched against BOM:

```
Shipment received — 3 items matched

✓  Belimo Actuator (M9220-BGC-3)    Qty: 2   → BOM: 2/2 now received
✓  Room Pressure Sensor (RPS)        Qty: 1   → BOM: 1/1 now received
⚠  Well Temp Sensor (TE-6312P-1G)   Qty: 3   → BOM: 3/14 received (11 remaining)

Packing Slip: PS-2026-0403
Date: April 3, 2026
Received by: Shane Bradford

[ Confirm All ]   [ Edit ]   [ Cancel ]
```

6. PM taps Confirm → inserts rows into `material_receipts` for each item

### Case 2: Barcode encodes PO or slip number only
1. Same scan flow
2. System looks up the PO/slip number — if not found, shows manual entry:

```
Packing Slip: PS-2026-0403
No automatic item match available.

Select items received in this shipment:
[ ] Belimo Actuator         Qty: [  ]
[ ] Room Pressure Sensor    Qty: [  ]
[ ] Well Temp Sensor        Qty: [  ]
...

[ Confirm ]   [ Cancel ]
```

### Case 3: No scan available (always support manual fallback)
PM can log a receipt without scanning — date, item selection, qty, packing slip number typed manually.

---

## Data model addition

Add `packing_slip` field to `material_receipts` (already in BOM spec):
```sql
packing_slip    text    -- slip number or reference, from scan or manual entry
```

No `barcode` field needed on `bom_items` — we're scanning the slip, not individual parts.

---

## Offline consideration

Military bases (like Hurlburt Field) may have poor or no signal.
Phase 2: cache scans locally on the phone, sync when back in range.
Phase 1: require signal, but note this limitation for the user.

---

## What NOT to build yet
- Scanning individual item barcodes one by one
- RFID or inventory-style bin tracking
- Requiring QR codes (manual entry is always available)

---

## Priority: Low (Phase 2 of Materials tab, after BOM entry works manually)
## Depends on: Materials/BOM tab (task 049)
## Suggested task number: 050
