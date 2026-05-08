# Conduit Fill Rules

The conduit fill calculator applies NEC Chapter 9 fill rules to determine the minimum conduit size for a given cable bundle.

## NEC Chapter 9 Fill Limits

| Number of Conductors | Max Fill |
|---|---|
| 1 conductor | 53% |
| 2 conductors | 31% |
| 3 or more conductors | 40% |

For BAS/controls home runs with multiple cables, the 40% rule applies.

## Calculation Method

1. Sum the cross-sectional areas of all conductors in the bundle (from NEC Table 5).
2. Find the minimum conduit internal area that satisfies the 40% fill limit: `total_area / 0.40`.
3. Select the conduit trade size with internal area ≥ required area (from NEC Table 4).

## Supported Conduit Types

- **EMT** (Electrical Metallic Tubing) — most common for BAS home runs
- **IMC** (Intermediate Metal Conduit)
- **Rigid** (Rigid Metal Conduit)

Trade sizes from 1/2" through 4".

## Supported Cable Types

The calculator includes common BAS/controls cable types:

- 18 AWG, 16 AWG, 14 AWG solid and stranded
- Shielded twisted pair (18/2, 18/3, 18/4, 16/2, etc.)
- Cat5e / Cat6 ethernet
- Fiber (used for fill reference only)

## Multiple Conduits

If a single conduit does not satisfy fill at the largest standard trade size, the calculator recommends splitting the bundle into multiple conduits.

## Applying Results to the Editor

When launched from a line item editor, the calculator can write the home-run conduit quantity back to the editor. See [Conduit Fill Calculator](../tasks/conduit-fill.md) for instructions.

---

*NEC Chapter 9 references: Table 1 (fill %), Table 4 (conduit area), Table 5 (conductor area).*
