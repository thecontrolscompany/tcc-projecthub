# Sprint — Go-Live Features (Tasks 063–065)

## Tasks in order

Run these sequentially. Each is independent — no task depends on another's output.

---

### Task 063 — Project Scope Description
**Spec:** `codex/task-063-project-scope-description.md`

Simple text field added to projects. Migration 033. Surfaces in admin modal, PM
Overview tab, and customer portal project header.

**Prompt for Codex:**
Read `codex/task-063-project-scope-description.md` and implement all changes.
Run the migration with `npx supabase db push`. Confirm `npm run build` passes.
Commit: `Add scope description field to projects`. Push to main.

---

### Task 064 — RFI Log
**Spec:** `codex/task-064-rfi-log.md`

New `project_rfis` table. New `/api/pm/rfis` route (GET/POST/PATCH). Replaces the
"Coming Soon" stub in the PM portal RFI tab with a full RFI log — create, expand,
mark pending, close with response.

**Prompt for Codex:**
Read `codex/task-064-rfi-log.md` and implement all changes. Run the migration with
`npx supabase db push`. Confirm `npm run build` passes.
Commit: `Add RFI log to PM portal`. Push to main.

---

### Task 065 — Progress Photos (SharePoint)
**Spec:** `codex/task-065-progress-photos.md`

New `project_photos` table. Two new Graph API helpers in `src/lib/graph/client.ts`.
New API routes: `/api/pm/photos` (list + upload) and `/api/pm/photos/[id]/content`
(proxy). New Photos tab in PM portal. Customer portal shows photo count badge.

**Prompt for Codex:**
Read `codex/task-065-progress-photos.md` and implement all changes. Run the
migration with `npx supabase db push`. Confirm `npm run build` passes.
Commit: `Add site photos tab to PM portal (SharePoint storage)`. Push to main.

---

## Notes

- All three tasks are independent — order doesn't matter but 063→064→065 goes
  simplest to most complex which is good for an unattended run.
- Task 065 requires the PM to be signed in with Microsoft SSO to upload photos
  (the provider_token is needed for Graph API). The error message is clear if not.
- After this sprint, the customer portal photo gallery (full image display) is a
  follow-up task pending SharePoint anonymous sharing configuration.
