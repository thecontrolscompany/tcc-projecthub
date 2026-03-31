# Claude Session Handoff — TCC ProjectHub
**Last updated:** 2026-03-31

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

## What's Built and Working

- Microsoft SSO + email/password auth, role-based routing
- Admin billing table: TanStack Table, inline editing, roll-forward, POC sync, email gen, Excel export
- Admin analytics: Recharts + Power BI embed
- Admin SharePoint migration tool (migrated ~120 active projects from OneDrive to SharePoint)
- PM portal, Customer portal, Quote requests stub, Estimating link page
- Brand token system (Tailwind semantic classes), sidebar nav, dark/light theme
- Database: all migrations 001–005 run; 24 projects seeded
- Admin Projects tab: New/Edit Project modals, auto YYYY-NNN job number, Billed/Paid logic, SharePoint provisioning
- Admin Projects tab: Active/Completed/All filter, text search, sortable columns
- PM auto-link on Microsoft sign-in (auth callback)
- PM Directory: Import from Microsoft button, Graph API GET /users with paging, upserts first/last name, links profile_id
- Build is clean (tasks 001–015 complete)

---

## Current Task

**Task 016 — Quote Requests Workflow** (task spec not yet written)

What it adds:
- Expand `/quotes` stub: status pipeline (new → reviewing → quoted → won/lost)
- Quote detail page `/quotes/[id]`
- Customer-facing intake form
- Admin status updates + notes

---

## Key Context and Decisions

### Database
- `projects.name` format: `"YYYY-NNN - Project Name"` (job number prefixed during SharePoint migration)
- `projects.pm_id` references `profiles(id)` — for authenticated PMs
- `pm_directory` stores all PM emails (including external: Trane, JCI, Siemens PMs)
- `projects.pm_directory_id` references `pm_directory(id)` for assignment (added task-014)
- `billing_periods.estimated_income_snapshot` is locked at roll-forward time
- `billing_periods.to_bill` is a generated column: `MAX(estimated_income_snapshot * pct_complete - prev_billed, 0)`

### Auth
- Admin + PMs: Microsoft SSO via Supabase Azure provider
- Customers: Supabase email/password, created by admin at `/admin/users`
- Provider token (from session) is used for Graph API calls (SharePoint, Outlook)

### SharePoint
- Project folders live at: `Active Projects/{job_number} - {project name}/`
- Subfolders: `01 Contract`, `02 Estimate`, `03 Submittals`, `04 Drawings`, `05 Change Orders`, `06 Closeout`, `07 Billing`, `99 Archive - Legacy Files`
- Graph API helpers in `src/lib/graph/client.ts`

### hvac-estimator (separate repo)
- Repo: `C:\Users\TimothyCollins\dev\hvac-estimator`
- Deployed to: https://estimates.thecontrolscompany.com via GitHub Pages
- Auth re-enabled: VITE_AZURE_CLIENT_ID in GitHub Actions secrets
- Redirect URI type in Azure: SPA (not Web) — PKCE flow

### Billing table data
- `seed-projects-fix.sql` already run — most projects have income data
- Projects with $0 estimated_income are historical completed projects not in the billing sheet (expected)
- `billing_rows` view exists in migration 001, fallback direct query also added in task-013

---

## Files to Read First (new session)

1. `CLAUDE.md` — project instructions and file map
2. `codex/CONTINUITY.md` — Codex-focused state tracker
3. `src/types/database.ts` — TypeScript types
4. `src/app/admin/page.tsx` — admin portal (largest file)

---

## Upcoming After Task 016

- **Task 017**: Estimate → Project lifecycle (convert won quote to project)
- **Task 018**: Analytics expansion (more charts, date range filters)
- **SharePoint cleanup**: Run cleanup tool at `/admin/migrate-sharepoint` to remove duplicate folders
- **Supabase Site URL**: Confirm it's set to `https://internal.thecontrolscompany.com` in Supabase Auth settings
- **Azure admin consent**: Grant `User.ReadBasic.All` for PM import if not yet done
