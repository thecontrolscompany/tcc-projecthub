# Conduit Fill Calculator

The conduit fill calculator checks NEC Chapter 9 conduit fill requirements for a home-run cable bundle and applies the result back to the line item editor.

## Launching from an Editor

1. Open a line item editor.
2. Go to the **Points List** tab.
3. Click **Conduit Fill Calculator**.
4. The calculator opens with the cable bundle for this system pre-loaded.

## Using the Calculator

1. Review the cables in the bundle. Add or remove cable types and counts as needed.
2. Select a conduit type (EMT, IMC, Rigid) and trade size.
3. The calculator shows the fill percentage and whether it passes NEC 40% fill.
4. Adjust conduit size until you have a passing result.

## Applying Results to the Editor

When the calculation is complete:

1. Click **Apply N Home Runs** (where N is the calculated conduit count).
2. The calculator writes the home-run conduit quantity back to the editor draft.
3. You are returned to the editor with the updated quantity.

## Standalone Use

The Conduit Fill Calculator is also accessible directly from the **Conduit Fill** tab in the top navigation. In standalone mode, you can calculate fill for any cable bundle, but the apply-back to editor is not available.

## NEC Rules Applied

- **NEC Chapter 9, Table 1**: Maximum conduit fill percentages (40% for 3+ conductors).
- **NEC Chapter 9, Table 4**: Conduit internal area by trade size and type.
- **NEC Chapter 9, Table 5**: Conductor cross-sectional area by wire gauge.

---

*See [Conduit Fill Rules](../reference/conduit-fill-rules.md) for the full NEC reference.*
