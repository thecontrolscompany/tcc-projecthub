# Plan — Weekly Report Import from Excel

## What we're importing

Each project folder in OneDrive contains a `{Project Name} Weekly Report.xlsm` file.
Each sheet tab is one weekly report, named loosely by date (e.g. `3-27-26`, `11-21-2025`).

**Sheet structure (confirmed from Crestview K-8):**

| Cell(s) | Content |
|---------|---------|
| C3 | Project name |
| C4 | PM name, D4 = PM phone |
| C5 | Report date (Excel datetime) |
| Rows 7–12 | Mon–Sat: col A = # of men, col B = hours, col D = activities narrative |
| "Material Delivered" row | col C = materials text |
| "Equipment Set" row | col C = equipment text |
| "Safety Incidents" row | col C = safety text |
| "Inspections & Tests" row | col C = inspection text |

**Not in the weekly report:** `pct_complete` — that lives in the POC Sheet (cell C5), already synced separately.

---

## Phase 1 — Schema expansion (DB migration required)

The current `weekly_updates` table only has `notes`, `blockers`, and `pct_complete`. The Excel files contain richer structured data worth keeping. Proposed additions:

```sql
alter table weekly_updates
  add column if not exists total_men      integer,
  add column if not exists total_hours    numeric(8,2),
  add column if not exists daily_log      jsonb,   -- [{day, men, hours, activities}]
  add column if not exists material_notes text,
  add column if not exists equipment_notes text,
  add column if not exists safety_notes   text,
  add column if not exists inspection_notes text,
  add column if not exists imported_from  text;    -- source filename for traceability
```

`daily_log` example:
```json
[
  {"day": "Monday", "men": 5, "hours": 10, "activities": "Pulled main trunk line..."},
  {"day": "Tuesday", "men": 3, "hours": 10, "activities": "Ran conduit..."}
]
```

The existing `notes` column becomes a free-text summary field (can be left null on import).
The existing `blockers` column maps to `safety_notes` or a manual field — keep both.

---

## Phase 2 — Import script

A standalone Node.js/TypeScript script (not an API route) run once locally:

**`scripts/import-weekly-reports.ts`**

### Logic

1. **Discover files**: Walk all subfolders of `OneDrive/Projects/` and find `* Weekly Report.xlsm` files using `glob` or `fs.readdirSync`.

2. **Parse each file** with `exceljs` (already installed):
   - Iterate sheets, skip any sheet whose name looks like a template or header
   - Parse report date from C5; fall back to parsing the sheet tab name (handle formats: `M-D-YY`, `M-D-YYYY`, `MM-DD-YY`)
   - Extract PM name from C4
   - Extract daily rows (look for rows where col C is Mon/Tue/Wed/Thu/Fri/Sat)
   - Extract notes section rows by scanning for label keywords in col A

3. **Match project**: Compare `projects.name` from DB against the Excel's project name (C3).
   - Exact match first; then strip job number prefix and try again; then warn and skip.

4. **Match PM**: Compare `pm_directory.first_name + last_name` against the Excel's PM name (C4).
   - Fuzzy match (split on space, check both orders); fall back to null `pm_id` with a warning.

5. **Upsert**: Use `ON CONFLICT (project_id, week_of) DO NOTHING` (or `DO UPDATE` to overwrite).
   - Safe to run multiple times.

6. **Report**: Print a summary table:
   - Files processed / sheets imported / skipped / errors
   - Unmatched project names (must be fixed manually or by renaming)
   - Unmatched PM names (logged but import continues with `pm_id = null`)

### Date parsing

Tab names are inconsistent (`3-27-26`, `11-21-2025`, `2-06-26  (2)`). Use this priority:
1. The datetime value in cell C5 (most reliable)
2. Fall back to parsing the tab name; normalize 2-digit years as 20xx

---

## Phase 3 — Admin import UI (optional, post-script)

After the one-time bulk import, an ongoing import page at `/admin/import` would let you:
- Upload a `Weekly Report.xlsm` file (single project at a time)
- Preview parsed rows before committing
- Show which sheets are new vs already imported
- One-click confirm to insert

This is lower priority — the script handles the bulk historical load; new weekly updates will be entered directly in the portal going forward.

---

## Scope of work

| Step | What | Effort |
|------|------|--------|
| Migration | Add columns to `weekly_updates` | Small |
| Script | Parse + match + upsert | Medium |
| Testing | Validate against all ~20 project folders | Manual |
| UI (optional) | Upload page for ongoing imports | Medium |

---

## Open questions before starting

1. **Are all active projects named consistently?** The Excel has `Crestview K-8` and the DB name includes the job number prefix (`2025-001 - Crestview K-8`). The script will need to strip the prefix when matching — confirm this is the right approach.

2. **What to do with unmatched projects?** Some folders may have report files for projects that aren't in the DB yet, or vice versa. Should the script create a stub project, or skip and log?

3. **Overwrite vs skip on re-run?** If a `(project_id, week_of)` row already exists, should a re-run overwrite it or leave it alone? Recommend: skip (DO NOTHING) unless you explicitly pass a `--overwrite` flag.

4. **How many projects have Weekly Report files?** The sample project folder (Crestview K-8) has one. Are there others? Run a quick OneDrive search for `* Weekly Report.xlsm` to see the full list.

5. **Should `pct_complete` be imported?** The weekly report doesn't contain it, but the POC sheet does. The sync already reads C5 from the POC sheet. We could run both imports together and cross-link by `week_of` date. Or keep them separate.
