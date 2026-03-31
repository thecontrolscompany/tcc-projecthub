# TCC ProjectHub — Session Continuity
**Last updated:** 2026-03-31

---

## Current State

### Completed (tasks 001–015, build clean)
- Token/theme system, sidebar shell, AppShell, ThemeProvider
- UI overhaul: collapsible sidebar (localStorage), aligned header, SVG nav icons, avatar, pill tabs, cleaned nav structure (task-023)
- Microsoft SSO (admin/PM) + email/password (customer) auth
- Route protection middleware
- Admin billing table (TanStack Table, inline editing all fields, roll-forward, POC sync, email gen, Excel export — task-020)
- Admin analytics (Recharts + Power BI embed)
- Admin user management — shows full name/email/role, Edit modal for name and role (task-017)
- Admin SharePoint migration tool + cleanup tab
- PM portal (assigned projects, weekly update form)
- Customer portal (read-only updates + billing history)
- Quote requests page (`/quotes`)
- Estimating stub page (`/estimating` → links to estimates.thecontrolscompany.com)
- Brand assets: `public/logo.png` replaced with TCC_v5.png bar-chart logo
- Billing table fallback query (no longer depends on `billing_rows` view alone)
- Project data seeded: 24 active projects with estimated_income and customer_id
- billing_periods.estimated_income_snapshot synced from projects.estimated_income
- Projects page: filters z-prefix placeholders, sorts by name
- Admin Projects tab: New/Edit Project modals, auto YYYY-NNN job number, Billed/Paid logic, SharePoint provisioning (task-014)
- Admin Projects tab: filter/search/sort, Customer POC dropdown, All Conduit label, form validation warnings
- Admin Contacts tab: renamed from PM Directory
- PM auto-link on Microsoft sign-in (auth callback) (task-014)
- PM Directory: Import from Microsoft button, Graph API GET /users with paging, upserts first/last name, links profile_id (task-015)
- PM Directory: Add/Edit/Delete CRUD, linked vs external badge (task-019)
- PM import consent error now returns direct Azure admin-consent URL with inline "Grant Admin Consent" link (task-016)

### Infrastructure (live)
| Item | Value |
|------|-------|
| Supabase URL | https://vzjjkssngkoedikbggbb.supabase.co |
| Azure Tenant ID | 7eec7a09-a47b-4bf1-a877-80fd5323c774 |
| Azure Client ID (TCC ProjectHub) | 0777b14d-29c4-4186-8d8e-4a8f43de6589 |
| Azure Client ID (hvac-estimator) | f9f9bab6-2540-46dd-984c-b784fd64a480 |
| SharePoint site | https://controlsco.sharepoint.com/sites/TCCProjects |
| Admin login | Tim@controlsco.net |
| Portal URL | https://internal.thecontrolscompany.com |
| Estimating URL | https://estimates.thecontrolscompany.com |

### Migrations run in Supabase
- `001_initial_schema.sql` ✅
- `002_add_sharepoint_columns.sql` ✅
- `003_migration_status.sql` ✅
- `004_project_fields.sql` ✅ run manually
- `005_pm_directory_last_name.sql` ✅ run manually
- `006_new_roles.sql` ✅ run manually
- `007_pm_directory_intended_role.sql` ⏳ — run manually before using pre-sign-in role assignment

---

## Next Task — READY TO RUN

### Task 017 — Quote Requests Workflow
File: `codex/task-016-quote-requests.md` (not yet written)

**What it does:**
- Expand `/quotes` stub into a full workflow: status management (new → reviewing → quoted → won/lost)
- Quote detail page `/quotes/[id]`
- Customer-facing intake form (public or authenticated)
- Admin can update status, attach notes, link to a project once won

**Before running task 016:**
- Timothy must run `supabase/migrations/005_pm_directory_last_name.sql` in Supabase SQL editor
- Grant `User.ReadBasic.All` admin consent in Azure if not done (required for PM import)

---

## Upcoming Tasks (not yet written)

### Task 017 — Estimate → Project lifecycle
- Convert a won quote into a project (pre-fill New Project modal from quote data)
- Link `quotes.project_id` after conversion

### Task 018 — Analytics expansion
- More Recharts charts: billing trend, PM workload, project status breakdown
- Date range filters

---

## Key File Map (current)

```
src/
├── app/
│   ├── admin/
│   │   ├── page.tsx            ✅ Billing/Projects/PM Dir/Users tabs + Import from Microsoft
│   │   ├── analytics/page.tsx  ✅ Recharts + Power BI
│   │   ├── users/page.tsx      ✅ User management
│   │   └── migrate-sharepoint/ ✅ Migration tool
│   ├── projects/
│   │   ├── page.tsx            ✅ Supabase fetch, filter z-prefix, sort by name
│   │   └── projects-list.tsx   ✅ Active/Completed split, badges
│   ├── pm/page.tsx             ✅ PM workflow
│   ├── customer/page.tsx       ✅ Customer portal
│   ├── estimating/page.tsx     ✅ Link to estimates.thecontrolscompany.com
│   ├── quotes/page.tsx         ✅ Stub (task-016 will expand)
│   ├── billing/page.tsx        ✅ Billing view
│   └── api/
│       ├── sync-poc/           ✅
│       ├── generate-emails/    ✅
│       ├── export-excel/       ✅
│       ├── admin/create-user/  ✅
│       ├── admin/migrate-sharepoint/ ✅
│       ├── admin/sharepoint-cleanup/ ✅
│       ├── admin/provision-project-folder/ ✅ (task-014)
│       └── admin/import-pm-directory/ ✅ (task-015, consent UX task-016)
│       └── admin/upload-project-document/ ✅ (task-026)
├── components/
│   ├── billing-table.tsx       ✅ TanStack Table with fallback query
│   ├── admin-projects-tab.tsx  ✅ New/Edit Project modals (task-014)
│   ├── sidebar-nav.tsx         ✅
│   ├── app-shell.tsx           ✅
│   └── theme-*.tsx             ✅
├── lib/
│   ├── supabase/               ✅ client, server, middleware
│   ├── graph/client.ts         ✅ OneDrive + SharePoint helpers + paging (task-015)
│   └── billing/calculations.ts ✅
├── middleware.ts               ✅
└── types/database.ts           ✅ Project + PmDirectory types updated (tasks 014–015)
supabase/
├── migrations/001–006          ✅ Run
├── migrations/007              ⏳ run manually (intended_role column)
├── migrations/005              ✅ Run
├── seed-projects.sql           ✅ Run (customers + PM directory)
└── seed-projects-fix.sql       ✅ Run (income + billing snapshot sync)
public/
└── logo.png                    ✅ TCC_v5.png bar chart logo
```

---

## Phase Tracker

| Phase | Status |
|-------|--------|
| 0 — Platform connect | ✅ Complete |
| 1 — Brand, shell, theme | ✅ Complete |
| 2 — Auth + roles | ✅ Complete |
| 3 — Billing table + data | ✅ Complete |
| 4 — Project management UI | ✅ Complete (task-014) |
| 4b — PM Directory import | ✅ Complete (tasks 015–016) |
| 4c — New roles (lead, installer, ops_manager) | ✅ Complete (task-022) |
| 4d — UI overhaul (sidebar, nav, shell) | ✅ Complete (task-023) |
| 4e — Contacts tab CRUD + pre-sign-in roles | ✅ Complete (task-024) |
| 4f — Audit fixes (billing save, role-routes, layout auth, Zod) | ✅ Complete (task-025) |
| 4g — SharePoint document uploads (contract, scope, estimate) | ✅ Complete (task-026) |
| 5 — Quote Requests workflow | ❌ Not yet started |
| 6 — Estimate → Project lifecycle | ❌ Not started |
| 7 — Analytics expansion | ❌ Not started |
| 8 — QBO integration | ❌ Not started |
