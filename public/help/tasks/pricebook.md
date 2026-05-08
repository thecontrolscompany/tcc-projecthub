# Price Book

The Price Book is available in the internal edition only. It shows all assembly definitions with current unit costs and allows price overrides.

## Opening the Price Book

Click **Price Book** in the top navigation bar.

## Viewing Assemblies

Assemblies are listed with their ID, name, unit material cost, and unit labor hours. Use the search box to filter by name or ID.

## Overriding a Price

1. Find the assembly in the list.
2. Click its row to edit.
3. Enter a new material cost or labor hours.
4. Save. The override applies to all new items — existing price snapshots are not affected.

## Importing Prices (CSV)

1. Click **Import CSV**.
2. Select a CSV file with columns: `id`, `mtl`, `lbr`.
3. Prices are updated for any matching assembly IDs.

## Exporting Prices (CSV)

Click **Export CSV** to download the current price book as a CSV file. Use this to review prices in a spreadsheet or prepare an import file.

---

*See [Assembly Pricing Model](../reference/assembly-pricing.md) for how assemblies are structured.*
