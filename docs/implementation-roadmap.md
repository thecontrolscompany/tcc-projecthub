# TCC Unified Platform - Implementation Roadmap

**Date:** 2026-03-30

---

## Guiding Principles

1. **Ship something real before building something big.** Get the existing billing/PM portal live with real data before adding quote requests or estimating.
2. **Never disrupt the live estimating tool.** `hvac-estimator` continues to run until the Next.js estimating module is fully validated.
3. **Low-risk migrations only.** Prefer additive changes over replacements.
4. **Each phase delivers usable value.** No phase is just "infrastructure" with no user-facing outcome.
5. **Standardize external-facing project reports.** Use the Eglin HTML progress report as the baseline structure, adapt sections per project, and keep TCC branding on every generated report.

---

## Phase 0 - Connect the Platform (IMMEDIATE)
**Target duration:** 1 week
**Delivers:** A real, working app with live data

This is purely operational setup. No new code.

### Tasks
- [ ] Create Supabase project at supabase.com
- [ ] Copy `.env.local.example` to `.env.local`, fill Supabase URL, anon key, service role key
- [ ] Run `supabase/migrations/001_initial_schema.sql` in Supabase SQL editor
- [ ] Register Azure AD app in portal.azure.com
  - Add redirect URI: `http://localhost:3000/auth/callback`
  - Add scopes: `openid email profile offline_access Files.ReadWrite Mail.ReadWrite`
- [ ] Configure Supabase Auth to use Azure AD OAuth provider
- [ ] Fill `NEXT_PUBLIC_AZURE_CLIENT_ID` and `NEXT_PUBLIC_AZURE_TENANT_ID` in `.env.local`
- [ ] Run seed data: create users in Supabase Auth dashboard, uncomment seed.sql
- [ ] Test login as admin (Microsoft SSO) and as customer (email/password)
- [ ] Import first 3-5 real projects from legacy Excel tracker
- [ ] Verify billing table loads, roll-forward works, email drafts created
- [ ] Deploy to Vercel staging URL

**Success criteria:** Timothy can log in and see real project data.

---

## Phase 1 - Brand, Shell, and Theme
**Target duration:** 1-2 weeks
**Delivers:** A professional-looking platform with TCC branding and light/dark support

### Tasks
- [ ] Copy logo assets to `public/` (horizontal logo, confirm current version with Timothy)
- [ ] Copy Raleway font TTFs to `public/fonts/`, convert to woff2
- [ ] Add `@font-face` declarations to `globals.css`
- [ ] Add CSS custom property token system to `globals.css` (from `theme-brand-system.md`)
- [ ] Update `tailwind.config.ts` with semantic color tokens
- [ ] Create `ThemeProvider` component
- [ ] Wrap root layout with `ThemeProvider`
- [ ] Build persistent sidebar nav component (role-filtered links)
- [ ] Update root layout to use sidebar shell plus main content area
- [ ] Add theme toggle (sun/moon) to header
- [ ] Add logo to header (light and dark variants)
- [ ] Migrate billing table page to semantic token classes
- [ ] Migrate PM page to semantic token classes
- [ ] Migrate customer page to semantic token classes
- [ ] Test both light and dark theme on all existing pages

**Success criteria:** The platform looks like a TCC product. Light mode works. Logo appears in header.

---

## Phase 2 - Expanded Roles and Navigation
**Target duration:** 1 week
**Delivers:** Role-based navigation that scales to the full platform

### Tasks
- [ ] Run migration 002: add `estimator | billing | accounting | executive` roles to profiles constraint
- [ ] Update middleware to enforce new role/route matrix (from `route-role-ui-plan.md`)
- [ ] Update sidebar nav to filter links by role
- [ ] Update role home page redirect logic in auth callback
- [ ] Update admin user management page for new roles
- [ ] Update RLS policies for billing/accounting/executive read access
- [ ] Add `profile_roles` join table for multi-role support (future, stub schema now)

**Success criteria:** An estimator who logs in sees `/quotes` and `/estimating` links. A billing user sees `/billing`. A PM sees only `/pm`. None of them see each other's modules.

---

## Phase 3 - Quote Requests Domain
**Target duration:** 2-3 weeks
**Delivers:** The front door to the lifecycle is open

### Tasks
- [ ] Run migration 003: `quote_requests`, `quote_request_attachments`, `quote_request_messages` tables plus numbering function
- [ ] Build `/quotes` dashboard - table with status, due date, customer, assigned estimator
- [ ] Build `/quotes/[id]` detail page - summary, attachments, status actions, internal notes
- [ ] Build `/quotes/new` form - admin/estimator creates a quote request manually
- [ ] Build "Assign Estimator" action
- [ ] Build "Create Estimate" conversion action (stub: creates estimate record, sets QR status)
- [ ] Build "Mark Won / Lost / Archive" actions
- [ ] Build `/customer/quotes` - customer views their submitted requests
- [ ] Build `/customer/quotes/new` - customer intake form with file uploads (local storage first, SharePoint in 3b)
- [ ] Implement SharePoint folder creation on quote submission (using Graph API from `sharepoint-strategy.md`)
- [ ] Implement file upload to SharePoint `/01 Customer Uploads/`
- [ ] Store `sharepoint_folder` and `sharepoint_item_id` on quote request record
- [ ] Implement Outlook draft notification to admin on new submission
- [ ] Build analytics tab: quotes received, average turnaround, win rate

**Success criteria:** A customer can submit a quote request with file attachments. Timothy sees it in the queue, assigns it, and can track its status.

---

## Phase 4 - Estimate to Project Lifecycle
**Target duration:** 2-3 weeks
**Delivers:** The middle of the lifecycle works. Projects are formally created from estimates.

### Tasks
- [ ] Run migration 004: `estimates`, `estimate_items`, `estimate_cost_settings` tables plus numbering and job numbering
- [ ] Build `/estimating` list page - estimate cards
- [ ] Build `/estimating/[id]` detail page - summary view (no editor yet; editor stays in `hvac-estimator`)
- [ ] Add Supabase client to `hvac-estimator` (Phase 3 of integration strategy) so estimates write to Supabase instead of localStorage
- [ ] Build "Award Project" action in `/estimating/[id]` or `/quotes/[id]`
  - Creates job number (`YYYY-NNN`)
  - Locks estimate
  - Creates project record with baseline snapshot
  - Creates billing period for current month
  - Creates SharePoint project folder tree from template
  - Copies proposal to `/01 Estimate Baseline/`
  - Creates Outlook draft PM notification
- [ ] Build `/projects/[id]` detail page with tabs: Overview, Billing, Documents, Updates
- [ ] Update `/pm` to use job numbers in display (`2026-041 - Project Name`)
- [ ] Add `display_name` to projects

**Success criteria:** An awarded estimate becomes a project with a job number. The PM is notified. A SharePoint folder exists. Billing periods can be managed.

---

## Phase 4b - Standardized Project Reports
**Target duration:** 1-2 weeks
**Delivers:** A repeatable, client-ready project report format that can be generated from live project data

### Tasks
- [ ] Treat `project updates/Eglin-1416-Progress-Report-April-2026-PDF-Edited.html` as the canonical baseline for report structure and visual hierarchy
- [ ] Create a report-definition model so sections are optional by project instead of hard-coded for every report
- [ ] Support as many applicable sections as possible from the Eglin standard, including executive summary, look-ahead schedule, field progress, materials/equipment, risks, contract progress, action items, and coordination notes
- [ ] Auto-populate report content from weekly updates, POC data, contract values, project metadata, customer and GC contacts, billing data, change orders, and imported partner updates where available
- [ ] Preserve manual narrative overrides so PMs can add context where source systems do not fully describe the job
- [ ] Add explicit branding requirements for all generated reports: TCC logo, TCC color system, company footer, and any required badge or identity elements
- [ ] Update the current report implementation so it follows the Eglin standard while restoring stronger TCC branding that is missing from the current version

**Success criteria:** A PM can generate a branded TCC project report that follows the Eglin standard, automatically fills from live project data, and gracefully omits sections that do not apply to a given project.

---

## Phase 5 - Estimating Module (`hvac-estimator` Integration)
**Target duration:** 6-10 weeks
**Delivers:** One unified app. `hvac-estimator` can be retired.

This is the largest phase. Approach it incrementally.

### Phase 5a - Port Data Layer (2 weeks)
- [ ] Port `assemblyData.js` to `src/lib/estimating/assemblyData.ts`
- [ ] Port `projectSettings.js` to `src/lib/estimating/costModel.ts`
- [ ] Port system data files (`vavData`, `ahuData`, `rtuData`, ...) to `src/lib/estimating/systems/`
- [ ] Port tests to `src/lib/estimating/__tests__/`
- [ ] Port `conduitFill.js` to `src/lib/estimating/conduitFill.ts`
- [ ] Verify all tests pass

### Phase 5b - Port UI Components (3-4 weeks)
- [ ] Port `UnitEditorPage.jsx` to `src/components/estimating/SystemEditor.tsx`
- [ ] Port `VAVSchematic.jsx`, `AHUSchematic.jsx` to TypeScript equivalents
- [ ] Port `SidebarLayout.jsx` to the Next.js layout pattern
- [ ] Port `AssemblyPickerModal.jsx` to `src/components/estimating/AssemblyPicker.tsx`
- [ ] Copy SVG diagrams to `public/diagrams/`
- [ ] Build `/estimating/[id]/edit` page using ported components
- [ ] Build `/pricebook` page (price book editor)
- [ ] Build `/tools/conduit-fill` page
- [ ] Port proposal DOCX generation to `/api/export-proposal`

### Phase 5c - Validation and Cutover (1-2 weeks)
- [ ] Run all tests (including ported estimating tests)
- [ ] Side-by-side test: create same estimate in both old and new tool, verify totals match
- [ ] Timothy validates new estimating UI
- [ ] Update DNS: `internal.thecontrolscompany.com` to Vercel (`tcc-projecthub`)
- [ ] Archive `hvac-estimator` repo (keep, do not delete)

---

## Phase 6 - Analytics and Reporting
**Target duration:** 2-3 weeks
**Delivers:** Meaningful business insight across the full lifecycle

### Tasks
- [ ] Expand analytics to include quote pipeline funnel
- [ ] Add estimate accuracy reports (estimate vs actual on completed projects)
- [ ] Add PM performance views (projects on time, percent-complete trends)
- [ ] Configure Power BI workspace: connect to Supabase PostgreSQL via connector
- [ ] Publish first `.pbix` report
- [ ] Add Power BI embed token generation API route (service principal auth)
- [ ] Add `POWERBI_CLIENT_SECRET` to production env vars on Vercel

---

## Phase 7 - Integrations (QuickBooks, QBO Time)
**Target duration:** 4-6 weeks
**Delivers:** Financial data flows in without manual entry

### Tasks
- [ ] QBO OAuth integration stub (currently no-op)
- [ ] Pull contract/invoice data from QBO to sync into `invoices` table
- [ ] Pull QBO Time labor actuals to sync into `projects.actual_labor_hrs`
- [ ] Build variance dashboard: baseline estimate vs actual (labor hours, material cost)
- [ ] Feed actuals back into estimating calibration view

---

## Summary Timeline (Estimated)

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 0 - Connect the Platform | 1 week | Week 1 |
| 1 - Brand, Shell, Theme | 1-2 weeks | Week 3 |
| 2 - Expanded Roles and Nav | 1 week | Week 4 |
| 3 - Quote Requests | 2-3 weeks | Week 7 |
| 4 - Estimate to Project Lifecycle | 2-3 weeks | Week 10 |
| 4b - Standardized Project Reports | 1-2 weeks | Week 12 |
| 5 - Estimating Module Migration | 6-10 weeks | Week 22 |
| 6 - Analytics | 2-3 weeks | Week 25 |
| 7 - QBO Integrations | 4-6 weeks | Week 31 |

**Platform is operationally useful from Phase 0. Full unification completes at Phase 5.**

---

## Next Three Steps (This Week)

1. **Create Supabase project** - the single most important unblock. 30 minutes of dashboard work.
2. **Register Azure AD app** - enables Microsoft SSO for Timothy and all PMs.
3. **Run migration, seed, and first login** - turns this from a codebase into a working product.

Everything else follows from those three steps.
