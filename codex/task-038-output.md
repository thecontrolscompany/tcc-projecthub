# Task 038 Output

## What Was Built

- Added migration file `supabase/migrations/020_weekly_updates_import_source.sql`
  - Adds `weekly_updates.imported_from`
  - Not run automatically

- Added parse route `src/app/api/admin/parse-weekly-report/route.ts`
  - Accepts Excel uploads via multipart form data
  - Parses each worksheet into a preview row using `exceljs`
  - Detects existing `week_of` rows for the project and marks them as already imported

- Added import route `src/app/api/admin/import-weekly-report/route.ts`
  - Inserts only new rows
  - Skips duplicates and parse failures
  - Stores `imported_from = filename`

- Added weekly report import dialog to `src/components/project-modal.tsx`
  - Stage 1: file selection
  - Stage 2: preview table with import counts/status
  - Stage 3: import result summary
  - Triggered from the bottom of the edit project modal for existing projects

- Added purge helper script `scripts/purge-weekly-updates.sql`
  - Deletes only imported weekly updates for a chosen project unless manually expanded

- Updated `src/types/database.ts`
  - `WeeklyUpdate.pm_id` can now be `null`
  - Added optional `imported_from`

## Issues

- `exceljs` type definitions rejected the runtime buffer shape coming from `File.arrayBuffer()`. This was resolved with a narrow cast at the parser load boundary while keeping the runtime logic unchanged.

## Build Status

- `npm run build` passes clean
