# Panel Trunk Matrix

Source: user-identified trunk list from the current redraw review.

| Panel | Trunk 1 | Trunk 2 | Trunk 3 |
|-------|---------|---------|---------|
| CP-1 | MS/TP 1 |  |  |
| CP-2 | MS/TP 1 | IP-1 |  |
| CP-3 | MS/TP 1 | IP-1 |  |
| CP-4 | MS/TP 1 |  |  |
| CP-5 | MS/TP 1 |  |  |
| CP-6 | MS/TP 1 |  |  |
| CP-7 | MS/TP 1 |  |  |
| CP-8 | MS/TP 1 |  |  |
| CP-9 | MS/TP 1 | IP-1 | IP-2 |
| CP-10 | MS/TP 1 | IP-1 | IP-2 |
| CP-11 | MS/TP 1 |  |  |
| CP-12 | MS/TP 1 |  |  |
| CP-13 | MS/TP 1 |  |  |
| CP-14 |  | IP-1 | IP-2 |

## Why this matters

- `MS/TP` and `IP` must stay separate in any redraw or export.
- A flat child-device list is not enough for Visio import if the panel has mixed network layers.
- Any next export should use this panel trunk matrix as a required input.
