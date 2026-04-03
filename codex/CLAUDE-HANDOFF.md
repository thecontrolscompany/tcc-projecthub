# Claude Session Handoff — TCC ProjectHub
**Last updated:** 2026-04-01

Paste this file into a new Claude session to restore full context.

---

## Standing Instructions for Codex

**After every task, Codex must:**
1. Run `npm run build` and fix all errors
2. `git add` all changed/new files
3. `git commit` with a descriptive message
4. `git push` to origin main
5. Create a `codex/task-0XX-output.md` summarizing what was done

Do not leave changes uncommitted. The live site deploys from main via Vercel.

---

## Project Summary

**TCC ProjectHub** — web portal for The Controls Company, LLC (HVAC/controls contractor).
Replaces an Excel-based monthly billing tracker with a multi-role portal.

- **Admin (Timothy Collins)** — billing table, project management, email generation, analytics
- **PM** — weekly updates, % complete, assigned project list
- **Customer** — read-only project updates and billing history

**Stack:** Next.js 16 (App Router, TypeScript), Supabase (PostgreSQL + Auth), Tailwind CSS (dark theme), Vercel, Microsoft Graph API (SharePoint + Outlook), Power BI Pro

**Repo:** `c:\Users\TimothyCollins\dev\tcc-projecthub`

---

## Live Infrastructure

| Item | Value |
|------|-------|
| Portal | https://internal.thecontrolscompany.com |
| Estimating tool | https://estimates.thecontrolscompany.com |
| Supabase | https://vzjjkssngkoedikbggbb.supabase.co |
| SharePoint | https://controlsco.sharepoint.com/sites/TCCProjects |
| Azure Tenant ID | 7eec7a09-a47b-4bf1-a877-80fd5323c774 |
| Azure Client ID (portal) | 0777b14d-29c4-4186-8d8e-4a8f43de6589 |
| Azure Client ID (estimator) | f9f9bab6-2540-46dd-984c-b784fd64a480 |
| Admin login | Tim@controlsco.net (Microsoft SSO) |

---

## What's Built and Working (tasks 001–030, build clean)

- Microsoft SSO + email/password auth, role-based routing
- UI overhaul: collapsible sidebar (localStorage), aligned header, SVG nav icons, avatar, pill tabs (task-023)
- Admin billing table: TanStack Table, inline editing all fields, roll-forward, POC sync, email gen, Excel export (task-020)
- Admin analytics: Recharts + Power BI embed
- Admin user management: full name/email/role display, Edit modal for name and role (task-017)
- Admin SharePoint migration tool + cleanup tab
- Admin Projects tab: New/Edit Project modals, auto YYYY-NNN job number, Billed/Paid logic, SharePoint provisioning (task-014)
- Admin Projects tab: filter/search/sort, Customer POC dropdown, All Conduit label, form validation (task-014+)
- Admin Contacts tab (renamed from PM Directory): Add/Edit/Delete CRUD, linked vs external badge (task-019)
- PM Directory: Import from Microsoft (Graph API GET /users with paging, upserts name, links profile_id) (task-015)
- PM import consent error returns direct Azure admin-consent URL with inline "Grant Admin Consent" link (task-016)
- PM auto-link on Microsoft sign-in (auth callback) (task-014)
- PM portal, Customer portal, Quote requests stub, Estimating link page
- Brand token system (Tailwind semantic classes), sidebar nav, dark/light theme
- `project_assignments` junction table — multiple people per project, each with `role_on_project` (task-028)
- Portal pages read by role_on_project: pm, installer, ops (task-029)
- Ops rows clickable → shared ProjectModal with full edit capability (task-030)
- Shared project editor extracted to `src/components/project-modal.tsx`
- Ops manager table column alignment fixed
- Login page mojibake characters fixed
- SharePoint document uploads: contract, scope, estimate (task-026)
- Admin "View As" role preview (sessionStorage, amber banner) (task-027)

### Migrations run in Supabase (all 11)
- `001_initial_schema.sql` ✅
- `002_add_sharepoint_columns.sql` ✅
- `003_migration_status.sql` ✅
- `004_project_fields.sql` ✅
- `005_pm_directory_last_name.sql` ✅
- `006_new_roles.sql` ✅
- `007_pm_directory_intended_role.sql` ✅
- `008_project_assignments.sql` ✅
- `009_ops_manager_write.sql` ✅
- `010_quote_requests.sql` ✅
- `011_customer_project_settings.sql` ✅

---

## Current / Next Task

**Task 031 — Quote Requests Workflow** (spec not yet written)

What it adds:
- Expand `/quotes` stub: status pipeline (new → reviewing → quoted → won/lost)
- Quote detail page `/quotes/[id]`
- Customer-facing intake form (public or authenticated)
- Admin status updates + notes
- Link won quote to a project

**Task 032 — Estimate → Project lifecycle**
- Convert a won quote into a project (pre-fill New Project modal from quote data)
- Link `quotes.project_id` after conversion

---

## Key Context and Decisions

### Database
- `projects.name` format: `"YYYY-NNN - Project Name"` (job number prefixed during SharePoint migration)
- `pm_directory` stores all PM emails (including external: Trane, JCI, Siemens PMs)
- `projects.pm_directory_id` references `pm_directory(id)` for assignment
- `project_assignments` junction table: multiple people per project with `role_on_project`
- `billing_periods.estimated_income_snapshot` locked at roll-forward time
- `billing_periods.to_bill` is a generated column: `MAX(estimated_income_snapshot * pct_complete - prev_billed, 0)`

### Auth
- Admin + PMs: Microsoft SSO via Supabase Azure provider
- Customers: Supabase email/password, created by admin at `/admin/users`
- Provider token (from session) used for Graph API calls (SharePoint, Outlook)

### SharePoint
- Project folders: `Active Projects/{job_number} - {project name}/`
- Subfolders: `01 Contract`, `02 Estimate`, `03 Submittals`, `04 Drawings`, `05 Change Orders`, `06 Closeout`, `07 Billing`, `99 Archive - Legacy Files`
- Graph API helpers in `src/lib/graph/client.ts`

### Billing table data
- `seed-projects-fix.sql` already run — projects have income data
- Projects with $0 are historical completed projects not in the billing sheet (expected)
- `billing_rows` view exists in migration 001; fallback direct query also in place (task-013)

---

## Files to Read First (new session)

1. `CLAUDE.md` — project instructions and file map
2. `codex/CONTINUITY.md` — Codex-focused state tracker (most up to date)
3. `src/types/database.ts` — TypeScript types
4. `src/app/admin/page.tsx` — admin portal (largest file)
5. `src/components/project-modal.tsx` — shared project editor (added task-030)

---

## Pending / Watch Items

- **SharePoint cleanup**: Run cleanup tool at `/admin/migrate-sharepoint` to remove duplicate folders from failed migration runs
- **Supabase Site URL**: Confirm set to `https://internal.thecontrolscompany.com` in Supabase Auth settings
- **Azure admin consent**: Grant `User.ReadBasic.All` for PM import if not yet done
- **Task 031 spec**: Needs to be written before giving to Codex
