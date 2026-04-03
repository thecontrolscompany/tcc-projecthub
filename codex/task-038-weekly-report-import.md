# Task 038 — Weekly Report Import

Import daily construction report Excel files (`.xlsm` / `.xlsx`) into `weekly_updates` on a per-project basis.
The user uploads a file through the edit project modal, previews what will be imported, and confirms.
New entries only — never overwrite existing rows.

---

## DB migration (run first)

Create `supabase/migrations/020_weekly_updates_import_source.sql`:

```sql
-- Track where each weekly update came from so imports can be purged independently
ALTER TABLE weekly_updates
  ADD COLUMN IF NOT EXISTS imported_from text; -- original filename, null for manually entered
```

**Do not run this automatically.** The migration file is created for the user to run in the Supabase dashboard.

---

## Excel file structure (confirmed)

Each `.xlsm` file has one sheet per weekly update. The sheet tab name is a date string (e.g. `3-27-26`, `11-21-2025`) but is NOT reliable for parsing — use the cell value instead.

Within each sheet:
- Row where col A contains `"Project Manager:"` → col C = PM name, col D = PM phone
- Row where col A contains `"Report Date:"` → col C = report date (Excel datetime or string)
- Rows where col C is a day name (`Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`) → col A = men (number), col B = hours (number), col D = activities text
- Row where col A contains `"Material Delivered"` → col C = text
- Row where col A contains `"Equipment Set"` → col C = text
- Row where col A contains `"Safety Incidents"` → col C = text
- Row where col A contains `"Inspections & Tests"` → col C = text

---

## 1 — Parse API route

Create `src/app/api/admin/parse-weekly-report/route.ts`:

- `POST` — accepts `multipart/form-data` with fields: `file` (the Excel binary), `projectId` (string)
- Auth: same session + role check pattern as other admin routes
- Parse the file using `exceljs`:
  ```ts
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  ```
- For each worksheet, extract one `ParsedWeeklyUpdate` object:
  ```ts
  type ParsedWeeklyUpdate = {
    sheetName: string;
    weekOf: string | null;       // ISO date "YYYY-MM-DD" or null if unparseable
    pmName: string | null;
    crewLog: Array<{ day: string; men: number; hours: number; activities: string }>;
    materialDelivered: string | null;
    equipmentSet: string | null;
    safetyIncidents: string | null;
    inspectionsTests: string | null;
    totalMen: number;
    totalHours: number;
    alreadyExists: boolean;      // true if (projectId, weekOf) already in DB
    parseError: string | null;   // non-null if the sheet couldn't be parsed
  };
  ```
- After parsing, query `weekly_updates` for the project to find which `week_of` dates already exist
- Set `alreadyExists = true` for any row whose `weekOf` matches an existing record
- Return `{ rows: ParsedWeeklyUpdate[], filename: string }`

**Date parsing logic** (important — tab names and cell values are inconsistent):
1. First try: read the cell value from the "Report Date:" row (col C). If it's a JS `Date` object, use it directly.
2. Second try: if col C is a string, try `new Date(value)` — works for most formats.
3. Last resort: parse the sheet tab name. Handle formats: `M-D-YY`, `M-D-YYYY`, `MM-DD-YY`, `MM-DD-YYYY`. For 2-digit years, assume `20xx`.
4. If all fail, set `weekOf = null` and `parseError = "Could not parse report date"`.

**Cell scanning helper** — scan all rows to find a row by keyword in col A, then read col C:
```ts
function findCellByLabel(ws: ExcelJS.Worksheet, label: string): string | null {
  for (const row of ws.getRows(1, ws.rowCount) ?? []) {
    const cellA = String(row.getCell(1).value ?? "").trim();
    if (cellA.toLowerCase().includes(label.toLowerCase())) {
      const val = row.getCell(3).value;
      return val != null ? String(val).trim() || null : null;
    }
  }
  return null;
}
```

**Day rows**: scan for rows where col C value (trimmed) matches one of the day names. Cast men/hours to numbers; treat non-numeric or null as 0. Only include the row in `crewLog` if men > 0 or hours > 0 or activities is non-empty.

---

## 2 — Import API route

Create `src/app/api/admin/import-weekly-report/route.ts`:

- `POST` — JSON body: `{ projectId: string, rows: ParsedWeeklyUpdate[], filename: string }`
- Auth: same session + role check
- For each row where `weekOf` is non-null and `alreadyExists === false`:
  - Insert into `weekly_updates`:
    ```ts
    {
      project_id: projectId,
      pm_id: null,               // PM matching is out of scope for now
      week_of: row.weekOf,
      crew_log: row.crewLog,
      material_delivered: row.materialDelivered,
      equipment_set: row.equipmentSet,
      safety_incidents: row.safetyIncidents,
      inspections_tests: row.inspectionsTests,
      notes: null,
      imported_from: filename,
      submitted_at: new Date().toISOString(),
    }
    ```
  - Use `ON CONFLICT (project_id, week_of) DO NOTHING` to be safe — if the unique index doesn't exist, add a try/catch per row and skip duplicates
- Return `{ imported: number, skipped: number, errors: string[] }`

---

## 3 — Import dialog in the edit project modal

### In `src/components/project-modal.tsx`

Add a new self-contained `WeeklyReportImportDialog` component at the bottom of the file.

**Props:**
```ts
type WeeklyReportImportDialogProps = {
  projectId: string;
  onClose: () => void;
};
```

**State:**
- `file: File | null`
- `parsing: boolean`
- `importing: boolean`
- `parsedRows: ParsedWeeklyUpdate[] | null`
- `filename: string`
- `result: { imported: number; skipped: number } | null`
- `error: string | null`

**UI — three stages:**

**Stage 1: File selection** (parsedRows is null, result is null)
```
Select a Weekly Report file (.xlsx or .xlsm) to import.

[Choose File]   [filename or "No file chosen"]

[Parse File]  ← disabled until file is selected, shows spinner while parsing
```

**Stage 2: Preview** (parsedRows is non-null, result is null)
Show a table:
```
Sheet Name   |  Week Of     |  Days Active  |  Hours  |  Status
3-27-26      |  2026-03-27  |  4            |  40     |  New ✓
10-3-25      |  2025-10-03  |  3            |  30     |  Already imported
(unparseable)|  —           |  —            |  —      |  ⚠ Parse error: ...
```
- "New" rows: highlighted, pre-selected for import
- "Already imported" rows: dimmed, not selectable
- "Parse error" rows: shown with warning, not selectable
- Count: "X new reports will be imported"

Buttons: `[Cancel]` `[Import X Reports]`

**Stage 3: Result** (result is non-null)
```
Import complete.
✓ X reports imported
— Y already existed (skipped)

[Close]
```

**Dialog chrome**: full-screen backdrop overlay, centered card `max-w-2xl w-full`, same styling as `ProjectModal` (dark theme, rounded-2xl, border).

### Trigger button in `ProjectModal`

At the very bottom of the modal footer (below the Save / Cancel buttons), for existing projects only (`editingProject !== null`), add:

```tsx
{editingProject && (
  <button
    type="button"
    onClick={() => setShowImportDialog(true)}
    className="text-sm text-text-secondary underline hover:text-text-primary"
  >
    Import Weekly Reports from Excel…
  </button>
)}
```

Add `showImportDialog` state (`boolean`, default `false`) and conditionally render `<WeeklyReportImportDialog>` when true.

---

## 4 — Purge SQL script

Create `scripts/purge-weekly-updates.sql`:

```sql
-- Purge all IMPORTED weekly updates for a specific project.
-- Replace the UUID below with the project's ID (find it in the URL when editing the project).
-- Manually entered updates (imported_from IS NULL) are NOT deleted.

DELETE FROM weekly_updates
WHERE project_id = 'REPLACE-WITH-PROJECT-UUID'
  AND imported_from IS NOT NULL;

-- To verify before deleting, run this SELECT first:
-- SELECT id, week_of, imported_from FROM weekly_updates
-- WHERE project_id = 'REPLACE-WITH-PROJECT-UUID'
--   AND imported_from IS NOT NULL
-- ORDER BY week_of;

-- To purge ALL weekly updates for a project (including manually entered), uncomment:
-- DELETE FROM weekly_updates WHERE project_id = 'REPLACE-WITH-PROJECT-UUID';
```

---

## 5 — Build + commit

- Run `npm run build` — must pass clean.
- Commit: `"Add per-project weekly report Excel import dialog"` and push to `origin/main`.
- Create `codex/task-038-output.md` with: what was built, any issues, build status.
