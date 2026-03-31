# TCC ProjectHub

Web application for The Controls Company, LLC to replace their Excel-based billing tracker.

## Company
**The Controls Company, LLC** — HVAC/controls contractor
**Owner/Admin:** Timothy Collins

## What we're building
A multi-role project management and billing portal:
- **Admin (Timothy)** — all projects, billing calculations, email generation to PMs, roll-forward month, analytics
- **PM (Project Managers)** — their assigned projects only, weekly report submission, % complete updates
- **Customer** — read-only view of project updates and billing history

## Stack
- **Next.js 16** (App Router, TypeScript) — frontend + API routes
- **Supabase** — PostgreSQL database + authentication (Microsoft SSO for admin/PM, email/password for customers) + row-level security
- **Tailwind CSS** — styling (dark theme, slate-950 base)
- **Vercel** — hosting (HostMonster handles domain DNS only)
- **Microsoft Graph API** — OneDrive POC sheet sync + Outlook draft email generation
- **Power BI Pro** — embedded analytics (workspace + report IDs in env vars)
- **QuickBooks Online API** — financial sync (future stub hooks only)

## Current status
- [x] Next.js project scaffolded and running
- [x] All dependencies installed (Supabase, TanStack Table, Recharts, ExcelJS, date-fns, react-hook-form, zod)
- [x] Database schema written (`supabase/migrations/001_initial_schema.sql`) — needs to be run in Supabase dashboard
- [x] Auth flow built: Microsoft SSO (admin/PM) + email/password (customers), role-based redirect
- [x] Route protection middleware (`src/middleware.ts`)
- [x] Admin billing portal — full TanStack Table with inline editing, roll-forward, POC sync, email gen, Excel export
- [x] Admin analytics — Recharts charts (projected vs actual, backlog trend, revenue by customer) + Power BI embed
- [x] Admin user management — create customer accounts, change roles
- [x] PM portal — assigned project list, weekly update form, progress tracking
- [x] Customer portal — project list, weekly update timeline, billing history
- [x] API routes: /api/sync-poc, /api/generate-emails, /api/export-excel, /api/admin/create-user
- [x] Graph API helpers: OneDrive cell read, Outlook draft creation, OneDrive upload
- [x] Billing calculation library: core formula, roll-forward, email draft generation
- [x] Production build passing (`npm run build`)
- [ ] **NEXT: Configure Supabase project + run migration + seed data**
- [ ] **NEXT: Create Azure AD app registration + configure OAuth in Supabase**
- [ ] **NEXT: Fill in .env.local from .env.local.example**

## Setup checklist (to go live)

1. **Supabase project**: Create at supabase.com, get URL + anon key + service role key
2. **Run migration**: Paste `supabase/migrations/001_initial_schema.sql` into Supabase SQL editor
3. **Azure AD app registration**: Register app in portal.azure.com, note client ID + tenant ID
4. **Supabase Auth → OAuth**: Add Azure provider in Supabase Auth settings using Azure app credentials
5. **Seed data**: Uncomment and run `supabase/seed.sql` after creating users
6. **Power BI**: Publish .pbix to workspace, get workspace ID + report ID
7. **`.env.local`**: Copy `.env.local.example` → `.env.local`, fill all values
8. **Deploy**: `vercel --prod`

## Key context

### Legacy system
The old Excel-based billing tracker lives at:
`c:\Users\TimothyCollins\dev\monthly-billing\legacy\`
VBA modules: Module1 (dashboard refresh), Module2 (roll-forward), Module5/6 (email generation)
Python scripts: sync_poc.py (reads C5 from OneDrive POC sheets), import_modules.py

### Billing logic (from legacy Excel)
Monthly billing sheet columns: Customer, Project Name, PM Email, Estimated Income,
Backlog, Prior % Complete, % Complete (editable), Previously Billed, Previously Billed %,
To Bill This Period (=MAX(EstIncome * %Complete - PrevBilled, 0)), Actual Billed Amount (editable)

Implementation: `src/lib/billing/calculations.ts`

### POC files
Each project has a POC Sheet.xlsx in its OneDrive folder:
`C:\Users\TimothyCollins\OneDrive - The Controls Company, LLC\Projects\{Project Name}\{Project Name} POC Sheet.xlsx`
Cell C5 = overall % complete (weighted sum of task completion inputs)
Synced via Graph API in `src/lib/graph/client.ts` → `readOneDriveCell()`

### Projects root
`C:\Users\TimothyCollins\OneDrive - The Controls Company, LLC\Projects\`
~20-50 active projects, 5-15 PMs at a time.

### Auth strategy
- Admin + PMs: Microsoft SSO (Azure AD OAuth via Supabase) — provider token used for Graph API calls
- Customers: Supabase email/password — created by admin at /admin/users

### QBO
The Controls Company has a QuickBooks Online subscription.
API access TBD. Leave stub hooks — no active QBO integration in MVP.
Future: pull contract amounts (Estimated Income) and actual invoice data from QBO.

## File map
```
src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx          # force-dynamic
│   │   ├── page.tsx            # Billing table + tabs (billing, projects, PM dir, users)
│   │   ├── analytics/page.tsx  # Recharts + Power BI embed
│   │   └── users/page.tsx      # Create/manage user accounts
│   ├── pm/
│   │   ├── layout.tsx          # force-dynamic
│   │   └── page.tsx            # Project list + weekly update form
│   ├── customer/
│   │   ├── layout.tsx          # force-dynamic
│   │   └── page.tsx            # Read-only project updates + billing history
│   ├── login/
│   │   ├── layout.tsx          # force-dynamic
│   │   └── page.tsx            # Microsoft SSO + email/password
│   ├── auth/
│   │   ├── callback/route.ts   # OAuth callback → role-based redirect
│   │   └── confirm/route.ts    # Password reset confirmation
│   └── api/
│       ├── sync-poc/route.ts       # Graph API POC sheet sync
│       ├── generate-emails/route.ts # Outlook draft creation
│       ├── export-excel/route.ts    # ExcelJS export + OneDrive upload
│       └── admin/create-user/route.ts # Service-role user creation
├── components/
│   ├── billing-table.tsx       # TanStack Table with inline editing
│   └── dashboard-card.tsx      # Shared card component
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser client
│   │   ├── server.ts           # Server client (cookies)
│   │   └── middleware.ts       # Session refresh + route protection
│   ├── graph/
│   │   └── client.ts           # Graph API: readOneDriveCell, createOutlookDraft, uploadToOneDrive
│   └── billing/
│       └── calculations.ts     # calcToBill, rollForwardRows, generatePmEmailDrafts
├── middleware.ts               # Next.js middleware entry
└── types/
    └── database.ts             # TypeScript types for all DB tables
supabase/
├── migrations/001_initial_schema.sql
└── seed.sql
```

## Development commands
```bash
npm run dev      # start dev server at localhost:3000
npm run build    # production build (currently passes clean)
npm run lint     # lint
```
