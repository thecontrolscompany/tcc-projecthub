# Price Snapshots

## What Is a Price Snapshot?

When a line item is added to an estimate, the current unit prices for all selected assemblies are captured and stored with the item. This is the **price snapshot**.

The snapshot contains:
- The assembly ID for each selected component
- The unit material cost at capture time
- The unit labor hours at capture time
- The timestamp when the snapshot was taken

## Why Snapshots Matter

Price book changes do not retroactively affect existing estimates. Once an item is priced, its costs are locked to the snapshot. This ensures:

- **Audit stability** — the estimate you submitted matches the estimate you retrieve later
- **No surprise recalculations** — updating the price book for a new job doesn't change a bid you already sent

## Updating to Current Prices

If you want to refresh an item to current price book rates:

1. Open the line item editor.
2. Use the **Update Prices** action.

This replaces the snapshot with today's prices. The previous snapshot is not preserved — use this only when you intend to reprice the item.

## Snapshot Date Display

The estimate detail view shows `Priced: [date]` for each item, indicating when the snapshot was taken.

## Implications for Estimates Over Time

On long projects where labor rates or material costs change:

- Items added early reflect older prices
- Items added later reflect newer prices
- Use the internal export to see per-item snapshot dates
- Reprice items selectively if needed before final submission

---

*See [Assembly Pricing Model](assembly-pricing.md) for how assembly costs are structured.*
