# Task 041 Output

## Summary
- Added a project-scoped POC sheet import flow with parse-preview-confirm UX.
- Import replaces `poc_line_items` for only the currently open project.
- Added `Clear All` for project POC items and inline category-name editing after import.

## Files changed
- `src/lib/poc/import.ts`
- `src/app/api/admin/parse-poc-sheet/route.ts`
- `src/app/api/admin/import-poc-sheet/route.ts`
- `src/components/project-modal.tsx`
- `codex/task-041-poc-sheet-import.md`

## Notes
- No SQL migration was needed for this first pass.
- Billing is not auto-updated by import yet; the import focuses on safely seeding the project’s POC breakdown.
- The flow is intentionally project-scoped so Timothy can test one project at a time and clear/retry if needed.
