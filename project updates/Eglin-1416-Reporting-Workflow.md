# Eglin 1416 Reporting Workflow

## Purpose

This is a project-specific reporting process for the customer-facing Eglin 1416 progress report. It is intentionally manual-first and repeatable. The goal is to update one polished HTML report each reporting cycle, export it to PDF, and keep both the working source and issued version archived for the life of the job.

This is a one-off reporting format, but it will likely be maintained for the next year. Treat this document as the operating checklist.

## Canonical baseline

- Working baseline HTML:
  - `project updates/Eglin-1416-Progress-Report-April-2026-PDF-Edited.html`
- Prior HTML source before manual polish:
  - `project updates/Eglin-1416-Progress-Report-April-2026.html`
- Prior customer-facing PDF source:
  - `project updates/Progress Report — Upgrade DDC Devices, Eglin AFB Bldg. 1416.pdf`

For weekly maintenance, always start from the latest edited HTML version, not from the original PDF conversion output.

## Source inputs used last cycle

These files appear to be the main source packet used to build the April 6, 2026 report:

- `project updates/TCC 2-week update.txt`
  - TCC schedule / customer coordination / shutdown impacts
- `project updates/Update from AES.txt`
  - material status, programmed controllers, JACE delivery, mobilization plan
- `project updates/Update from Gresham Smith.txt`
  - commissioning / kickoff status
- `project updates/Monthly Billing - AF3064.xlsx`
  - likely billing / contract progress source
- `project updates/Billing_Tracker_2026.xlsm`
  - broader financial tracking support
- `project updates/The Controls Company_Invoice List by Date.csv`
  - invoice history reference

## Memory / planning files related to this effort

- `codex/plan-weekly-report-import.md`
  - says the Eglin edited HTML should be treated as the canonical project-report baseline
- `docs/implementation-roadmap.md`
  - captures the Eglin report as the standard for richer project reporting in ProjectHub

There does not appear to be a separate project-specific handoff note for Eglin beyond this report file and those planning references, so this document becomes the continuity note.

## Weekly update process

### 1. Create this week's working copy

Copy the most recent edited report HTML and rename it for the new report cycle.

Recommended naming:

- HTML:
  - `Eglin-1416-Progress-Report-YYYY-MM-DD.html`
- PDF export:
  - `Eglin-1416-Progress-Report-YYYY-MM-DD.pdf`

If you want to preserve the historical April naming, keep the existing files untouched and create a new dated copy for each new report date.

### 2. Gather the weekly source packet

Before editing the report, collect or update:

- TCC two-week look-ahead
- AES status update
- Gresham Smith / commissioning update
- latest billing snapshot
- latest invoice or percent-complete inputs if used
- any new risks, access issues, or owner coordination notes

If one of these is missing, keep the prior statement only if it is still true. Otherwise mark it as pending confirmation and do not silently carry it forward.

### 3. Update the recurring fields in the HTML

The edited report contains repeated date and status fields. Update them as a controlled pass.

Always review:

- report date
- report period
- project status date
- two-week look-ahead schedule
- subcontractor status notes
- financial summary percentages
- progress graphics percentages
- detailed progress narrative
- open items / risk register dates and mitigation text
- exhibit date and BOM note date

### 4. Recalculate timeline and progress callouts

The current report includes a manual contract-duration card. Each cycle, verify and update:

- elapsed time percentage
- current overall progress percentage
- elapsed days
- remaining days
- status-date note

Do not update these by search-and-replace only. The same numbers appear in multiple visual areas and should stay internally consistent.

### 5. Validate section-by-section before issue

Read the final HTML top to bottom and check:

- dates are consistent across header, footer, charts, and exhibit
- the two-week look-ahead matches the latest customer-facing commitment
- AES material language matches actual delivery status
- Gresham commissioning note is still current
- financial percentages match the latest billing/progress data
- risks are still open and still worded correctly
- no stale references remain to prior week's milestones

### 6. Export and archive

For each cycle, keep:

- working HTML source
- issued PDF

Do not overwrite the prior week's archived deliverables. This report is becoming a rolling project record.

## Suggested folder/process convention

If this continues for a year, move from ad hoc files to a simple weekly archive structure:

- `project updates/Eglin-1416/`
- `project updates/Eglin-1416/2026-04-06/`
- `project updates/Eglin-1416/2026-04-13/`

Each dated folder should contain:

- report HTML
- report PDF
- `TCC 2-week update`
- `Update from AES`
- `Update from Gresham Smith`
- billing snapshot used
- optional `notes.md` for manual judgments or assumptions

If you do not want to reorganize old files yet, start this folder pattern with the next issued report.

## Recommended operating roles

- Timothy / TCC:
  - owns the master report narrative, customer commitments, and final issue
- AES:
  - provides hardware, controller, shipment, and mobilization status
- Gresham Smith:
  - provides commissioning / Cx schedule status

The report editor should not invent partner status. If partner input is late, keep their section factual and dated.

## Practical maintenance rule

Treat the report as a managed weekly publication, not a regenerated artifact.

That means:

- clone last week's edited HTML
- update only the changed facts
- verify all repeated dates and percentages
- export PDF
- archive both

This is safer than re-creating the report from scratch each week and should keep the process stable until a more automated ProjectHub reporting flow exists.

## Future improvement path

If this report continues long enough to justify tooling, the best next step is not a generic feature first. It is a small project-specific input model for:

- report date
- period covered
- TCC look-ahead items
- AES update
- Gresham update
- financial summary values
- progress percentages
- risk register rows

That could later feed an Eglin-specific template renderer, but for now the HTML-first maintenance process is the right level of effort.
