# Task 041 - Project-Scoped POC Sheet Import

## Goal
Add a safe first-pass import flow for legacy POC Excel workbooks so Timothy can test one project at a time without affecting the rest of the database.

## Requirements

### 1. Project-scoped import only
- Add an `Import POC Sheet...` control in the POC section of the shared project modal.
- Import applies only to the currently open project.
- Do not touch any other project.

### 2. Parse / preview / confirm flow
- Follow the same general pattern as weekly report import:
  - upload file
  - parse workbook server-side
  - show preview table
  - confirm import
- Accept `.xlsx` / `.xlsm`.

### 3. Workbook parsing
- Target the legacy POC workbook structure currently used by TCC projects.
- Extract, per category:
  - category label
  - weight
  - `% complete`
  - weighted contribution
- Return summary values:
  - worksheet name
  - filename
  - total weight
  - overall weighted `% complete`
  - number of existing POC rows for the project

### 4. Import behavior
- Replacing existing rows is the default and only first-pass mode.
- On import:
  - delete existing `poc_line_items` for that project
  - insert parsed rows with sequential `sort_order`
- No migration required for this first version.
- Do not automatically update billing on import.

### 5. Recovery / cleanup
- Make it easy to undo a bad import for one project:
  - add a `Clear All` button in the POC section for that project only
- Keep manual editing available after import:
  - add/edit/delete/reorder should still work
  - category labels should be editable inline

### 6. Security
- Use authenticated admin/ops-manager server routes for parse/import.
- Do not rely on client-side service-role access.

## Files
- `src/app/api/admin/parse-poc-sheet/route.ts`
- `src/app/api/admin/import-poc-sheet/route.ts`
- `src/lib/poc/import.ts`
- `src/components/project-modal.tsx`

## Acceptance
- Admin can open one project, import its POC workbook, preview parsed categories, and replace that project’s POC line items.
- Admin can clear the imported rows if the result looks wrong.
- Build passes cleanly.
