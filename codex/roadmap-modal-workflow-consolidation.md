# Modal Workflow Consolidation Roadmap

Reduce duplicate modal and modal-like workflows that accomplish the same user objective with different UIs, state models, and API paths.

## Why this matters

- The same business actions are currently implemented in multiple places with different interaction patterns.
- This increases drift, inconsistent field coverage, duplicated bugs, and extra maintenance when a field or rule changes.
- Consolidating by workflow objective should make future changes faster and safer.

## Highest-priority consolidation targets

### 1. Project billing period editing

Same job, different implementations:

- `src/components/project-modal/project-billing-section.tsx`
- `src/app/admin/page.tsx` (`BillingBackfillTab`)
- `src/app/api/admin/project-billing/route.ts`
- `src/app/api/admin/billing-backfill/route.ts`

Goal:

- Define one canonical project billing-period editor workflow.
- Reuse the same row model, validation rules, save behavior, and field coverage across modal and standalone admin surfaces.

### 2. Project creation workflows

Same result, different entry paths:

- `src/components/project-modal.tsx` via `/api/admin/save-project`
- `src/components/quote-request-convert-modal.tsx` via `/api/admin/convert-quote-to-project`

Goal:

- Keep quote conversion as a specialized entry point if needed, but route it through a shared project-creation form/workflow where practical.
- Avoid maintaining separate field sets for “new project” and “convert to project” when they are creating the same record type.

### 3. File import dialogs

Repeated parse → preview → import pattern:

- `src/components/project-modal/weekly-report-import-dialog.tsx`
- `src/components/project-modal/poc-setup-section.tsx` (`PocSheetImportDialog`)

Goal:

- Standardize shared import dialog structure:
  - file picker
  - parse state
  - preview table
  - import confirmation
  - result summary
  - error handling

## Secondary candidates

### People / account management dialogs

Related CRUD flows with overlapping structure:

- `src/components/admin-contacts.tsx`
- `src/components/admin-users-page.tsx`

Goal:

- Review whether contact editing, account creation, and temporary password assignment should share a common dialog shell or form patterns.

## Expected outcome

- Fewer duplicated modal implementations
- Shared field coverage across equivalent workflows
- Lower chance of “feature added in one modal but missing in another”
- Easier future maintenance for billing, project setup, and imports

## Guardrails

- Consolidate by workflow objective, not just by visual container.
- Preserve role-specific permissions and context even if the UI becomes shared.
- Prefer shared subcomponents and shared workflow logic before forcing one giant modal to do everything.
