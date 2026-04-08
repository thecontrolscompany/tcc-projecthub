# Plan - Weekly Report Import from Excel

## Target report standard

The reporting target is no longer just a simple weekly-update print page. Use `project updates/Eglin-1416-Progress-Report-April-2026-PDF-Edited.html` as the canonical baseline for project reports.

Requirements:
- Keep the overall structure, section richness, and presentation level of the Eglin report as the standard to design against
- Make sections modular so projects can omit elements they do not need instead of forcing a one-size-fits-all report
- Auto-refresh report content from live sources where possible: weekly reports, POC snapshots, contract data, billing and progress data, change orders, project metadata, and imported partner or POC updates
- Preserve TCC branding on every generated report even if the current Eglin HTML version does not fully reflect the desired branded state
- Leave room for PM-written narrative blocks and manually curated callouts where source data is incomplete

This means the weekly report import should feed a broader project-report system, not just a narrow one-page weekly summary.

---

## What we're importing

Each project folder in OneDrive contains a `{Project Name} Weekly Report.xlsm` file.
Each sheet tab is one weekly report, named loosely by date (for example `3-27-26`, `11-21-2025`).

**Sheet structure (confirmed from Crestview K-8):**

| Cell(s) | Content |
|---------|---------|
| C3 | Project name |
| C4 | PM name, D4 = PM phone |
| C5 | Report date (Excel datetime) |
| Rows 7-12 | Mon-Sat: col A = number of men, col B = hours, col D = activities narrative |
| "Material Delivered" row | col C = materials text |
| "Equipment Set" row | col C = equipment text |
| "Safety Incidents" row | col C = safety text |
| "Inspections & Tests" row | col C = inspection text |

**Not in the weekly report:** `pct_complete` - that lives in the POC Sheet (cell C5), already synced separately.

---

## Phase 1 - Schema expansion (DB migration required)

The current `weekly_updates` table only has `notes`, `blockers`, and `pct_complete`. The Excel files contain richer structured data worth keeping. Proposed additions:

```sql
alter table weekly_updates
  add column if not exists total_men integer,
  add column if not exists total_hours numeric(8,2),
  add column if not exists daily_log jsonb,
  add column if not exists material_notes text,
  add column if not exists equipment_notes text,
  add column if not exists safety_notes text,
  add column if not exists inspection_notes text,
  add column if not exists imported_from text;
```

`daily_log` example:

```json
[
  { "day": "Monday", "men": 5, "hours": 10, "activities": "Pulled main trunk line..." },
  { "day": "Tuesday", "men": 3, "hours": 10, "activities": "Ran conduit..." }
]
```

The existing `notes` column becomes a free-text summary field (can be left null on import).
The existing `blockers` column maps to `safety_notes` or a manual field - keep both.
Imported weekly data should also be structured so it can roll up into the richer Eglin-style project report layout later.

---

## Phase 2 - Import script

A standalone Node.js/TypeScript script (not an API route) run once locally:

**`scripts/import-weekly-reports.ts`**

### Logic

1. **Discover files:** Walk all subfolders of `OneDrive/Projects/` and find `* Weekly Report.xlsm` files using `glob` or `fs.readdirSync`.
2. **Parse each file** with `exceljs`:
   - Iterate sheets, skip any sheet whose name looks like a template or header
   - Parse report date from C5; fall back to parsing the sheet tab name (handle formats like `M-D-YY`, `M-D-YYYY`, `MM-DD-YY`)
   - Extract PM name from C4
   - Extract daily rows
   - Extract notes-section rows by scanning for label keywords
3. **Match project:** Compare `projects.name` from DB against the Excel project name in C3.
   - Exact match first, then strip job-number prefix and try again, then warn and skip
4. **Match PM:** Compare `pm_directory.first_name + last_name` against the Excel PM name in C4.
   - Fuzzy match, fall back to null `pm_id` with a warning
5. **Upsert:** Use `ON CONFLICT (project_id, week_of) DO NOTHING` or `DO UPDATE`.
   - Safe to run multiple times
6. **Report:** Print a summary table:
   - files processed, sheets imported, skipped, errors
   - unmatched project names
   - unmatched PM names

### Date parsing

Tab names are inconsistent (`3-27-26`, `11-21-2025`, `2-06-26 (2)`). Use this priority:
1. The datetime value in cell C5
2. Fall back to parsing the tab name; normalize 2-digit years as 20xx

---

## Phase 3 - Admin import UI (optional, post-script)

After the one-time bulk import, an ongoing import page at `/admin/import` would let you:
- Upload a `Weekly Report.xlsm` file (single project at a time)
- Preview parsed rows before committing
- Show which sheets are new versus already imported
- One-click confirm to insert

This is lower priority. The script handles the bulk historical load; new weekly updates will be entered directly in the portal going forward.

---

## Report-generation implications

To support the Eglin-style report standard well, the report layer should merge imported weekly report data with other project sources:

- `weekly_updates` for crew activity, field notes, safety, inspections, delays, and remarks
- POC-derived percent complete and category snapshots
- project and contract records for owners, contractors, addresses, contract value, and schedule context
- billing and change-order records for progress and financial context
- optional manually maintained sections for risks, look-ahead work, action items, and external coordination notes

Not every project will have every section. The generator should include as many sections as the available data supports and hide the rest cleanly.

---

## Scope of work

| Step | What | Effort |
|------|------|--------|
| Migration | Add columns to `weekly_updates` | Small |
| Script | Parse, match, and upsert | Medium |
| Testing | Validate against all project folders | Manual |
| UI (optional) | Upload page for ongoing imports | Medium |

---

## Open questions before starting

1. **Are all active projects named consistently?** The Excel has `Crestview K-8` and the DB name may include the job-number prefix (`2025-001 - Crestview K-8`). The script will need to strip the prefix when matching.
2. **What to do with unmatched projects?** Some folders may have report files for projects that are not in the DB yet, or vice versa. Should the script create a stub project, or skip and log?
3. **Overwrite vs skip on re-run?** If a `(project_id, week_of)` row already exists, should a re-run overwrite it or leave it alone? Recommended default: skip unless an explicit `--overwrite` flag is passed.
4. **How many projects have Weekly Report files?** Run a OneDrive search for `* Weekly Report.xlsm` to see the full list.
5. **Should `pct_complete` be imported?** The weekly report does not contain it, but the POC sheet does. The sync already reads C5 from the POC sheet. We can run both imports together and cross-link by `week_of`, or keep them separate.
