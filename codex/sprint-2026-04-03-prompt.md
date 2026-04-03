# TCC ProjectHub — Sprint 2026-04-03
# Master Codex Prompt — Execute All Tasks in Order

---

## Standing instructions (apply to every task)

After completing EACH task:
1. Run `npm run build` — fix all errors before moving to the next task
2. `git add` all changed/new files
3. `git commit` with the message specified in the task
4. `git push origin main`
5. Create the output file `codex/task-0XX-output.md` summarizing what was done

Do not batch commits. One commit per task. The live site deploys from main via Vercel.

---

## Pre-flight check

Before starting, verify these tables exist in Supabase by checking the codebase for
any prior migration files that create them:

- `customer_feedback` — needed for task 050
- `wip_items` — needed for task 052
- `bom_items` + `material_receipts` — needed for task 053
- `portal_feedback` — needed for task 050

If any are missing, each task spec instructs you to write a migration SQL file to
`supabase/migrations/` and note it needs manual execution. Write those migration files
early so Timothy can run them while you work on other tasks.

---

## Task execution order

### Task 048 — Customer Portal UX Improvements
Read `codex/task-048-customer-portal-ux.md` and execute fully.
No migrations required.

---

### Task 049 — Analytics Expansion
Read `codex/task-049-analytics-expansion.md` and execute fully.
No migrations required.

---

### Task 050 — Feedback Page
Read `codex/task-050-feedback-page.md` and execute fully.
Writes migration files for `customer_feedback` and `portal_feedback` tables.
Note in output: these migrations need to be run manually in Supabase.

---

### Task 051 — Quote → Project Lifecycle
Read `codex/task-051-quote-to-project.md` and execute fully.
Uses existing `quote_requests` and `projects` tables — no new migration.
Verify `projects.source_estimate_id` column exists; if not, add it.

---

### Task 052 — WIP Tracker
Read `codex/task-052-wip-tracker.md` and execute fully.
Writes migration file for `wip_items` table.
Note in output: migration needs to be run manually in Supabase.

---

### Task 053 — Materials / BOM Tab
Read `codex/task-053-materials-bom.md` and execute fully.
Writes migration files for `bom_items` and `material_receipts` tables.
Note in output: migrations need to be run manually in Supabase.

---

## Key files for context

Read these before starting:
- `CLAUDE.md` — project overview and stack
- `codex/CONTINUITY.md` — current state and infrastructure
- `src/types/database.ts` — all TypeScript types
- `src/components/project-modal.tsx` — where WIP and BOM tabs will be added (2425 lines)
- `src/app/admin/page.tsx` — admin portal (924 lines)
- `src/app/customer/page.tsx` — customer portal (1235 lines)
- `src/app/admin/analytics/page.tsx` — current analytics page (340 lines)
- `src/components/sidebar-nav.tsx` — for adding nav links

## Infrastructure

| Item | Value |
|------|-------|
| Supabase URL | https://vzjjkssngkoedikbggbb.supabase.co |
| Portal | https://internal.thecontrolscompany.com |
| Admin login | Tim@controlsco.net |
| Repo | thecontrolscompany/tcc-projecthub |
| Branch | main |
