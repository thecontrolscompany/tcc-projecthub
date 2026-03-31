# TCC ProjectHub — Session Continuity
**Last updated:** 2026-03-30 night

---

## Where We Are

### Completed tonight
- Tasks 001–009 implemented and building clean
- Supabase project live: `vzjjkssngkoedikbggbb.supabase.co`
- Azure AD app registered: TCC ProjectHub (`0777b14d-29c4-4186-8d8e-4a8f43de6589`)
- SharePoint site created: `https://controlsco.sharepoint.com/sites/TCCProjects`
- Database migrations run: 001 (initial schema), 002 (sharepoint columns), 003 (migration_status)
- Admin login working: Tim@controlsco.net via Microsoft SSO
- SharePoint migration tool built and running at `/admin/migrate-sharepoint`
- Brand token system live (Tailwind semantic classes)
- Sidebar shell with role-filtered nav working
- ThemeProvider and ThemeToggle in place

### In progress right now
- SharePoint migration running in browser — copying ~581 OneDrive projects to SharePoint
- Migration is batching 25 at a time, will continue until browser tab is closed or complete
- If it stops partway, re-run in the morning — skips already-done items safely

### Known issues to fix tomorrow
- `logo.png` returns 404 — sidebar shows text fallback (task-010)
- Raleway fonts return 404 — using system-ui fallback (task-010)
- Middleware deprecation warning (task-010)
- No billing periods exist yet — admin billing table shows empty state (task-010 seed script)
- SharePoint has some duplicate folders from earlier failed runs — use Cleanup tab once copying stops

---

## Next Tasks (in order)

### Task 010 — Brand Assets + Data (READY TO RUN)
File: `codex/task-010-brand-assets-and-data.md`
Prompt: "Read codex/task-010-brand-assets-and-data.md and implement everything in it exactly as written."
After Codex: run `supabase/seed-billing.sql` in Supabase SQL editor

### Task 011 — Quote Requests Domain (Phase 3)
Not written yet. Covers:
- `/quotes` dashboard page
- `/quotes/new` intake form
- `/quotes/[id]` detail page
- Quote request DB schema (migration 004)
- Status management actions

### Task 012 — Customer Portal Improvements
Not written yet. Covers:
- `/customer/quotes/new` intake form
- Customer can submit quote requests with file attachments

---

## Credentials (non-secret)

| Item | Value |
|------|-------|
| Supabase URL | https://vzjjkssngkoedikbggbb.supabase.co |
| Azure Tenant ID | 7eec7a09-a47b-4bf1-a877-80fd5323c774 |
| Azure Client ID (TCC ProjectHub) | 0777b14d-29c4-4186-8d8e-4a8f43de6589 |
| Azure Client ID (hvac-estimator) | f9f9bab6-2540-46dd-984c-b784fd64a480 |
| SharePoint site | https://controlsco.sharepoint.com/sites/TCCProjects |
| Admin user | Tim@controlsco.net |

Secrets (client secret, service role key) are in `.env.local` only — not stored here.

---

## File Map (key files)

```
src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx          ✅ AppShell wrapped, Supabase profile fetch
│   │   ├── page.tsx            ✅ Billing table + tabs, token migrated
│   │   ├── analytics/page.tsx  ✅ Recharts + Power BI embed
│   │   ├── users/page.tsx      ✅ User management
│   │   └── migrate-sharepoint/ ✅ Migration tool + cleanup tab
│   ├── pm/layout.tsx           ✅ AppShell wrapped
│   ├── pm/page.tsx             ✅ PM workflow, legacy badge
│   ├── customer/page.tsx       ✅ Customer portal
│   ├── login/page.tsx          ✅ Microsoft SSO + email/pw
│   ├── preview/page.tsx        ✅ Token system visual test (no auth)
│   └── api/
│       ├── sync-poc/           ✅ Graph API POC sync
│       ├── generate-emails/    ✅ Outlook draft creation
│       ├── export-excel/       ✅ ExcelJS export
│       ├── admin/create-user/  ✅ Service role user creation
│       ├── admin/migrate-sharepoint/ ✅ Migration API (batched)
│       └── admin/sharepoint-cleanup/ ✅ Duplicate cleanup API
├── components/
│   ├── billing-table.tsx       ✅ TanStack Table, token migrated
│   ├── sidebar-nav.tsx         ✅ Role-filtered, logo with fallback
│   ├── app-shell.tsx           ✅ Fixed sidebar + header + ThemeToggle
│   ├── theme-provider.tsx      ✅ Light/dark/system
│   └── theme-toggle.tsx        ✅ Sun/moon inline SVG
├── lib/
│   ├── supabase/client.ts      ✅
│   ├── supabase/server.ts      ✅
│   ├── supabase/middleware.ts  ✅
│   ├── graph/client.ts         ✅ OneDrive + SharePoint Graph helpers
│   └── billing/calculations.ts ✅ Core formula + roll-forward + email gen
├── middleware.ts               ⚠️ Deprecated — rename to proxy.ts (task-010)
└── types/database.ts           ✅ All DB types including migration_status
supabase/
├── migrations/
│   ├── 001_initial_schema.sql  ✅ Run
│   ├── 002_add_sharepoint_columns.sql ✅ Run
│   └── 003_migration_status.sql ✅ Run
├── seed.sql                    (sample data — not run yet)
└── seed-billing.sql            (task-010 will create this)
public/
├── logo.png                    ❌ Missing (task-010)
└── fonts/                      ❌ Missing (task-010)
codex/
├── task-001 through task-009   ✅ Complete
├── task-010-brand-assets-and-data.md ✅ Ready to run
└── CONTINUITY.md               ← this file
```

---

## Phase Tracker

| Phase | Status |
|-------|--------|
| 0 — Connect platform | ✅ Complete |
| 1 — Brand, shell, theme | ✅ Complete (fonts/logo pending task-010) |
| 2 — Expanded roles + nav | ⚠️ Partial (sidebar done, roles not expanded beyond admin/pm/customer) |
| 3 — Quote Requests | ❌ Not started (task-011) |
| 4 — Estimate → Project lifecycle | ❌ Not started |
| 5 — Estimating module migration | ❌ Not started |
| 6 — Analytics expansion | ❌ Not started |
| 7 — QBO integrations | ❌ Not started |
| SharePoint migration | 🔄 In progress (running tonight) |
