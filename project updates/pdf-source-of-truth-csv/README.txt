WARNING: These CSVs were transcribed from the customer PDF, but they flatten each panel into a simple child-device list.
They do NOT correctly preserve connection types or network layers.

Specifically:
- Some relationships in the PDF are IP / CAT6 uplinks or owner's-network links
- Some relationships are MS/TP field-bus links
- A flat child list is not sufficient for redraw or network-type decisions

Do not use this folder as authoritative for bus type, trunk type, or connection topology.

Source:
- project updates/New Riser Diagram.pdf

What is needed instead:
- a connection-based export with one row per visible edge
- columns such as parent, child, connection label, bus type, and PDF page

These files may still be useful as a rough device inventory only.
