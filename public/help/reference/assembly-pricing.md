# Assembly Pricing Model

## What Is an Assembly?

An assembly is a priced unit of work — a specific piece of hardware plus the labor to install it. Each assembly has:

- **Assembly ID** — a numeric ID (e.g., `60081`) inherited from the EBT legacy catalog
- **Name** — descriptive name
- **Unit material cost** — cost of the hardware (dollars)
- **Unit labor** — installation time (hours)

The full catalog has 445 assembly definitions.

## EMT vs. Plenum Pricing

Many assemblies exist in two variants:

- **EMT** — uses conduit and wire (higher material cost, standard install)
- **Plenum** — uses plenum-rated cable (lower material cost in open plenum spaces)

The EBT convention for paired assemblies: for same-named 60xxx IDs, the **lower numeric ID is always Plenum**, the **higher numeric ID is always EMT**.

The install type is set per line item. It controls which assembly variant is used when calculating costs.

## How Costs Are Calculated

For each selected component:

1. Resolve the assembly ID (EMT or Plenum based on install type)
2. Look up `unitMtl` and `unitLbr` from the assembly definition
3. Multiply by quantity
4. Sum across all components

Apply markups, labor rate, overhead, and bond per the estimate settings to get the final price.

## Custom Assemblies

You can add custom cost entries to any line item:

- **Custom material** — enter a dollar amount directly; no assembly ID used
- **Custom labor** — enter hours directly; no assembly ID used
- **Assembly from catalog** — pick any of the 445 assemblies; priced at current book rates

## Price Overrides

Individual assembly prices can be overridden in the Price Book. Overrides affect all future items — existing price snapshots are not changed.

---

*See [Price Snapshots](price-snapshots.md) for how pricing is locked at item-add time.*
