# TCC ProjectHub — Session Continuity
**Last updated:** 2026-04-08

---

## Current State

### Completed (tasks 001–030, build clean)
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
- project_assignments junction table — multiple people per project, each with role_on_project (task-028)
- Portal pages read by role_on_project: pm, installer, ops (task-029)
- Ops rows clickable → shared ProjectModal with full edit capability (task-030)
- Shared project editor extracted to `src/components/project-modal.tsx`
- Ops manager table column alignment fixed (table-fixed + colgroup widths)
- Login page mojibake characters fixed
- New `/time` module scaffolded inside ProjectHub:
  - `/time`
  - `/time/clock`
  - `/time/employees`
  - `/time/projects`
- merged time foundation now lives in ProjectHub Supabase via `037_time_merge_foundation.sql`
- one-time merge script `scripts/merge-tcc-time-data.ts` copied live TCC Time data into ProjectHub on `2026-04-08`
- current merged counts in ProjectHub:
  - `28` QuickBooks users
  - `57` QuickBooks jobcodes
  - `453` QuickBooks timesheets
  - `33` legacy time projects
  - `8` exact profile mappings by email
  - `18` legacy-project-to-portal-project mappings
  - `18` QuickBooks-jobcode-to-portal-project mappings
- `/time` now prefers ProjectHub's merged tables locally and only falls back to the legacy bridge when local merged tables are unavailable
- Portal sidebar and middleware now recognize the `/time` module for `admin`, `pm`, `lead`, and `ops_manager`

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
- `007_pm_directory_intended_role.sql` ✅ run manually
- `008_project_assignments.sql` ✅ run manually
- `009_ops_manager_write.sql` ✅ run manually
- `010_quote_requests.sql` ✅ run manually
- `011_customer_project_settings.sql` ✅ run manually

---

## Next Tasks — READY TO RUN

### Time Module Follow-On
**What exists now:**
- portal route structure for `/time`
- ProjectHub-hosted merged QuickBooks/import tables
- profile and project crosswalk tables for the initial database merge
- clock page positioned as the first-priority workflow home

**Next useful work:**
- review and resolve the remaining `20` unmatched QuickBooks users against ProjectHub profiles
- review and resolve the remaining unmatched projects and jobcodes before clocking becomes authoritative
- port real clock in / clock out writes into the portal module
- decide whether `/pm/time` should be retired or folded into `/time`

### Task 031 — Quote Requests Workflow (not yet written)
**What it does:**
- Expand `/quotes` stub into a full workflow: status management (new → reviewing → quoted → won/lost)
- Quote detail page `/quotes/[id]`
- Customer-facing intake form (public or authenticated)
- Admin can update status, attach notes, link to a project once won

---

## Upcoming Tasks (not yet written)

### Task 032 — Estimate → Project lifecycle
- Convert a won quote into a project (pre-fill New Project modal from quote data)
- Link `quotes.project_id` after conversion

### Task 033 — Analytics expansion
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
| 4h — Admin "View As" role preview (sessionStorage, amber banner) | ✅ Complete (task-027) |
| 4i — project_assignments: multi-person team per project | ✅ Complete (tasks 028–030) |
| 5 — Quote Requests workflow | ❌ Not yet started (task-031) |
| 6 — Estimate → Project lifecycle | ❌ Not started (task-032) |
| 7 — Analytics expansion | ❌ Not started (task-033) |
| 8 — QBO integration | ❌ Not started |
