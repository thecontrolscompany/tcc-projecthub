# Task 080 - Opportunity Hub Next 10 Tasks

## Goal

Advance Opportunity Hub beyond the initial foundation by adding staged legacy import flow, review queue infrastructure, and active-project matching support.

## Task Queue

1. Create a concrete execution sprint doc for the next 10 Opportunity Hub tasks.
2. Add typed legacy import batch/row/match/review entities to `src/types/database.ts`.
3. Extract CSV/TSV parsing, header inference, and preview normalization into shared `src/lib/opportunity-import.ts`.
4. Add project-match scoring helpers in `src/lib/opportunity-match.ts`.
5. Add a reusable Opportunity Hub subnav for pipeline, import, and review pages.
6. Build admin API routes for staging import batches and reading import history.
7. Upgrade `/quotes/import` so it stages parsed legacy rows into the new import tables and shows recent batches.
8. Build `/quotes/import/review` as a review queue for staged rows.
9. Add API-backed active-project match suggestions for staged import rows.
10. Add review decision actions so staged rows can be marked linked, standalone, or rejected.

## Execution Notes

- Keep all changes additive and safe against missing migrations.
- If migration tables are not available yet, show a clear “run migrations 045/046” style message instead of breaking the UI.
- Commit and push focused checkpoints along the way.
