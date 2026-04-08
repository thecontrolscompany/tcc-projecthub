This folder is reserved for a corrected PDF-first connection export.

The needed format is not "control panel -> all descendants".
The needed format is "visible connection -> exact label/type from PDF".

Recommended columns:
- pdf_page
- panel
- parent_device
- child_device
- connection_label
- bus_type
- evidence
- notes

Rules:
- PDF is the source of truth
- no inferred breakouts
- no collapsing IP/CAT6 and MS/TP into one bucket
- omit uncertain edges instead of guessing
