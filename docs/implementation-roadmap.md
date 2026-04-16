# TCC Unified Platform - Implementation Roadmap

**Date:** 2026-03-30

---

## Guiding Principles

1. **Strengthen the working foundation before expanding the lifecycle.** ProjectHub already has meaningful PM, billing, projects, customer, and admin surfaces; get them live with real data and a unified shell before adding large new domains.
2. **Never disrupt the live estimating tool.** `hvac-estimator` continues to run until the Next.js estimating module is fully validated.
3. **Low-risk migrations only.** Prefer additive changes over replacements.
4. **Each phase delivers usable value.** No phase is just "infrastructure" with no user-facing outcome.
5. **Standardize external-facing project reports.** Use the Eglin HTML progress report as the baseline structure, adapt sections per project, and keep TCC branding on every generated report.
6. **Support real offline field conditions.** Assume crews may work in buildings or job sites with poor/no internet; everyday document work should continue in synced SharePoint folders, and PM/admin reconciliation can happen later when back online.

---

## Phase 0 - Operationalize the Existing Platform (IMMEDIATE)
**Target duration:** 1 week
**Delivers:** The existing PM, billing, projects, customer, and admin foundation running with live data

This is primarily operational setup so the current platform can be used against real data.

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
- [ ] Document the offline operating model for the team
  - everyday users continue working in synced SharePoint folders when offline
  - PMs collect updates weekly and reconcile them when back online
  - define which records are source-of-truth in SharePoint vs ProjectHub during offline periods

**Success criteria:** Timothy can log in, see real project data, and exercise the current PM/billing/customer foundation against live records.

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
**Delivers:** The front door to the lifecycle is open, and `Opportunity Hub` becomes the internal bid pipeline

### Tasks
- [ ] Run migration 003: `quote_requests`, `quote_request_attachments`, `quote_request_messages` tables plus numbering function
- [ ] Build `/quotes` dashboard as the `Opportunity Hub` pipeline table with status, due date, customer, assigned estimator, bid date, bid price, last activity, and next action
- [ ] Add `Pursuit -> Opportunity` hierarchy to Opportunity Hub so one real-world project can contain multiple customer/vendor-specific bids
- [ ] Build pursuit matching/creation flow on quote intake so staff can attach a new opportunity to an existing project pursuit when multiple vendors are bidding the same job
- [ ] Build customer-level bid history views so sales/estimating can see all quote requests, active bids, won/lost results, and hit rate by customer
- [ ] Build `/quotes/[id]` detail page - summary, attachments, status actions, internal notes, bid pricing, due/submission dates, and won/lost outcome tracking
- [ ] Build `/quotes/new` form - admin/estimator creates a quote request manually
- [ ] Treat customer-facing `/customer/quotes` as `Opportunity Hub` for consistency with `ProjectHub`, with a prominent `Submit Quote Request` action
- [ ] Build "Assign Estimator" action
- [ ] Build "Convert to Opportunity" action so an intake request becomes the managed internal opportunity record without re-entry
- [ ] Require quote-to-opportunity conversion to either create a new pursuit or attach to an existing pursuit
- [ ] Build "Create Estimate" action for the `hvac-estimator` path
- [ ] Build "Use Legacy Excel Estimate" action for opportunities that still follow the workbook workflow
- [ ] Build "Mark Won / Lost / Archive" actions with loss reason / outcome notes for later reporting
- [ ] Support proposal package upload on the opportunity record
  - proposal `.docx` as primary extraction source
  - proposal `.pdf` as archived customer-facing version
  - estimate `.xlsm` as cost/markup extraction source
- [ ] Extract normalized opportunity fields from uploaded proposal/estimate documents and store them in Supabase without overwriting the source files
- [ ] Build `/customer/quotes` - customer views their submitted requests
- [ ] Build `/customer/quotes/new` - customer intake form with drag-and-drop file uploads, due dates, and quote-request metadata (local storage first, SharePoint in 3b)
- [ ] Add Dropbox-style customer file request experience so customers can drop plans/specs/addenda/photos and later add more files without entering the internal app
- [ ] Add customer-facing quote progress tracking so customers can see request received, under review, estimating, submitted, won/lost, and requests for missing information
- [ ] Implement SharePoint folder creation on quote submission (using Graph API from `sharepoint-strategy.md`)
- [ ] Implement file upload to SharePoint `/01 Customer Uploads/`
- [ ] Create root SharePoint template area for Opportunity Hub working files
  - `/_Templates/Opportunity Master Templates/`
  - store current master `Electrical Budgeting Tool vXX.xlsm`
  - store current master `HVAC Control Installation Proposal-Template.docx`
- [ ] On internal opportunity creation, copy the current master estimate workbook and proposal template into `/03 Estimate Working/`
  - keep the estimate workbook's current versioned filename such as `Electrical Budgeting Tool v15.xlsm`
  - rename the copied proposal file from `...-Template.docx` to `...-{Project Name}.docx`
- [ ] Store `sharepoint_folder` and `sharepoint_item_id` on quote request record
- [ ] Implement Outlook draft notification to admin on new submission
- [ ] Build analytics tab: quotes received, average turnaround, win rate, bids by customer, and won/lost history

**Success criteria:** A customer can submit a quote request with drag-and-drop file attachments and track its progress. Timothy sees an `Opportunity Hub` queue, assigns it, enters bid dates/prices, uploads proposal/estimate files, and tracks won/lost performance by customer.

---

## Phase 4 - Estimate to Project Lifecycle
**Target duration:** 2-3 weeks
**Delivers:** The middle of the lifecycle works. Projects are formally created from estimates.

### Tasks
- [ ] Run migration 004: `estimates`, `estimate_items`, `estimate_cost_settings` tables plus numbering and job numbering
- [ ] Build `/estimating` list page - estimate cards
- [ ] Build `/estimating/[id]` detail page - summary view (no editor yet; editor stays in `hvac-estimator`)
- [ ] Add estimate shell fields needed by `Opportunity Hub` tracking: bid price, bid date, proposal date, customer, customer bid history link, and outcome state
- [ ] Add launch/link flow from `Opportunity Hub` into `hvac-estimator` so an opportunity can create or reopen its linked estimate
- [ ] Keep the legacy Excel estimate path available during transition so the opportunity record can link either to `hvac-estimator` or to uploaded `.xlsm` source files
- [ ] Store imported estimate summary values from uploaded `.xlsm` files
  - labor hours
  - labor cost
  - material cost
  - direct / indirect cost
  - overhead
  - profit
  - vendor fee
  - total cost
  - marked-up value
- [ ] Store imported proposal pricing rows from uploaded proposal documents
  - base bid
  - bond
  - any additional pricing line items
- [ ] Add Supabase client to `hvac-estimator` (Phase 3 of integration strategy) so estimates write to Supabase instead of localStorage
- [ ] Add "New Project from Estimate" shortcut so the New Project flow can pull customer, job/site info, pricing, and source estimate ID directly from an estimate page
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

**Success criteria:** An awarded estimate becomes a project with a job number, and the New Project flow can be started directly from the estimate context instead of rekeying the same data. The PM is notified. A SharePoint folder exists. Billing periods can be managed.

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

## Phase 4bb - Offline Workflow and Sync Process
**Target duration:** 1-2 weeks
**Delivers:** A practical offline operating process for field and PM teams, with a clear weekly sync workflow instead of assuming always-on connectivity

### Tasks
- [ ] Define the default offline workflow around synced SharePoint libraries rather than live app entry from the field
- [ ] Document which project artifacts are expected to be edited offline
  - weekly notes
  - field photos
  - redlines / marked-up PDFs
  - proposal / estimate support documents
  - customer or subcontractor attachments
- [ ] Define PM weekly update cadence for reconciling offline work back into ProjectHub when off site
- [ ] Create a "minimum viable sync" checklist for PMs
  - what to review from SharePoint each week
  - what to copy into ProjectHub
  - how to handle conflicts or duplicate files
  - how to note items that remain SharePoint-only
- [ ] Identify which workflows truly need an app feature versus a documented process
- [ ] Add conflict-handling guidance for cases where SharePoint files and ProjectHub fields disagree
- [ ] Define naming and folder rules that make offline capture easier and later sync more reliable
- [ ] Decide whether any later lightweight import/reconciliation helper is needed for PM weekly sync, or whether process alone is sufficient

**Success criteria:** TCC can keep operating in low/no-internet environments without blocking the field team, and PMs have a repeatable weekly process for syncing meaningful updates back into ProjectHub.

---

## Phase 4c - AI-Assisted PM & Change Order Workflows
**Target duration:** 2-3 weeks
**Delivers:** AI assistance that improves PM throughput on weekly reporting and protects margin on change orders

### Tasks
- [ ] Confirm Microsoft 365 licensing posture for Microsoft 365 Copilot, SharePoint agents, Copilot Studio, and Power Automate / AI Builder
- [ ] Define a human-in-the-loop policy: AI can draft and recommend, but never auto-submit weekly reports or auto-price change orders
- [ ] Build an AI-assisted weekly report drafting flow for PMs
  - Suggest polished report language from crew logs, notes, blockers, deliveries, inspections, and prior project context
  - Produce both an internal draft and a customer-facing summary where appropriate
  - Flag missing sections, inconsistent dates, weak wording, and incomplete narratives before submission
- [ ] Build a project knowledge agent grounded in project documents and prior weekly reports so PMs and leadership can ask questions across report history
- [ ] Build an AI-assisted change order coverage review
  - Expand PM rough scope notes into a structured checklist of direct and indirect cost drivers
  - Require review of labor, material, lost time, travel, storage/handling, supervision, programming/engineering, access constraints, labor escalation, material escalation, schedule impact, testing/commissioning, overhead, profit, assumptions, and exclusions
  - Separate customer-facing narrative from internal commercial notes
- [ ] Build an AI-assisted change order drafting flow that turns reviewed inputs into formal change order language
- [ ] Store AI outputs as editable draft suggestions tied to the weekly update / change order record for auditability
- [ ] Log prompt/output metadata and source references so leadership can trace how a draft was produced
- [ ] Add role-based access so PMs, ops managers, and admins can use AI features without exposing sensitive internal pricing logic to customer users

**Success criteria:** PMs can generate cleaner weekly report drafts in less time, and change orders consistently capture indirect costs and commercial risks that would otherwise be missed by a time-and-material-only mindset.

---

## Phase 4d - Employee Safety Certification Tracking
**Target duration:** 1-2 weeks
**Delivers:** A workforce compliance view that shows certification status at a glance and keeps source documents organized in SharePoint

### Tasks
- [ ] Define certification tracking schema for employee safety records
  - Store employee, certification name/type, certification received date, expiration-required flag, expiration date, status, notes, SharePoint path/item ID
- [ ] Build an employee certification matrix quickview
  - Rows: employees
  - Columns: tracked certifications
  - Cell states: current, expiring soon, expired, missing, non-expiring
- [ ] Add employee detail workflow for managing certification records and uploading supporting files
- [ ] Support certifications that do not expire without forcing an expiration date
- [ ] Add dashboard filtering for expiring soon, expired, missing, and by certification type
- [ ] Add reminders / reporting hooks for upcoming expirations
- [ ] Create SharePoint folder structure for employee certification documents
  - Example: `/Employees/{Employee Name or ID}/Safety Certifications/`
- [ ] Upload and link certification files to the employee certification record so app data and SharePoint stay connected
- [ ] Define permissions so only appropriate internal roles can view or manage employee certification files

**Success criteria:** Leadership can open a matrix view and immediately see which employees are current, expiring, expired, or missing required safety certifications, and every certification document is stored in a SharePoint folder organized by employee.

---

## Phase 4e - Internal Knowledge Base
**Target duration:** 2-3 weeks
**Delivers:** A searchable internal reference hub for SOPs, wiring diagrams, acronyms, and institutional knowledge

### Tasks
- [ ] Define schema for knowledge base articles
  - Store title, category, body (markdown), tags, author, created/updated timestamps, SharePoint document link where applicable
- [ ] Define categories: SOP, Wiring Diagram, Reference, Training, Acronym
- [ ] Build `/knowledge` list page — searchable, filterable by category and tag
- [ ] Build `/knowledge/[id]` detail page — renders markdown, displays linked diagrams or documents
- [ ] Build acronym finder — fast lookup of TCC-specific and industry abbreviations with definitions and context
  - Support fuzzy search so partial matches surface results
  - Allow acronyms to link to a related SOP or reference article
- [ ] Build SOP section — step-by-step procedures for recurring internal tasks (startup, commissioning, closeout, billing cycle, etc.)
- [ ] Build wiring diagram library — upload and tag diagrams, link to equipment types or project templates
- [ ] Build knowledge transfer module — structured Q&A or topic-based articles for onboarding new staff
  - Cover estimating workflow, SharePoint folder conventions, billing cycle, project lifecycle, customer communication norms
- [ ] Add "Suggest an Edit" or internal comment thread so staff can flag outdated content
- [ ] Role-gate authoring (admin/estimator can create/edit; field/billing can read)
- [ ] Link knowledge articles from related context — e.g. a change order form can surface the "Change Order SOP" inline

**Success criteria:** Any team member can open `/knowledge`, search for an acronym, SOP, or wiring reference, and find current TCC-specific guidance without asking someone else.

---

## Phase 4f - Microsoft 365 Deep Integration
**Target duration:** 3-4 weeks
**Delivers:** ProjectHub acts as the command center for the TCC Microsoft 365 tenant — actions in the app trigger real Outlook, Teams, SharePoint, and Visio workflows rather than requiring staff to switch between apps

### SharePoint
- [ ] SharePoint is already the file backbone — deepen the integration beyond storage
- [ ] Surface SharePoint document previews inline on pursuit/project detail pages (no download required)
- [ ] Add "Open in SharePoint" and "Open in Word/Excel" deep links from document records
- [ ] Sync SharePoint folder structure changes back to ProjectHub (webhook or scheduled reconcile) so folder renames and moves do not orphan records
- [ ] Support SharePoint Shared Libraries for multi-person folder access without individual OneDrive dependencies
- [ ] Add SharePoint version history view on document records so staff can see prior revisions without leaving ProjectHub

### Outlook
- [ ] Replace Outlook draft stubs with full send capability (Graph `sendMail`) for admin-confirmed actions
- [ ] Build quote request acknowledgment email (auto-sent to customer on submission)
- [ ] Build bid submission confirmation email (sent to GC/owner when proposal is marked submitted)
- [ ] Build PM notification emails for project award, billing period open, and report due
- [ ] Add Outlook calendar event creation for bid due dates, submission deadlines, and project milestones
- [ ] Surface recent relevant emails on pursuit/project detail pages using Graph mail search (by project name or customer domain)
- [ ] Add "Log email to pursuit" action so staff can attach an Outlook thread to a pursuit record without forwarding

### Teams
- [ ] Post a Teams channel message when a quote request is submitted (configurable channel per team)
- [ ] Post a Teams notification when a bid is marked won or lost
- [ ] Post a Teams notification when a project report is published or a billing period is closed
- [ ] Add "Start Teams meeting" deep link from project/pursuit detail pages (pre-filled with project context)
- [ ] Explore Teams tab embedding so ProjectHub pursuit or project views can be pinned inside a Teams channel
- [ ] Add Teams Adaptive Card notifications for time-sensitive actions (bid deadline approaching, cert expiring)

### Visio
- [ ] Add Visio diagram support to the knowledge base wiring diagram library
  - Store `.vsdx` files in SharePoint under `/Knowledge/Wiring Diagrams/`
  - Render Visio previews inline using Microsoft 365 embed or export-to-SVG pipeline
- [ ] Build a diagram tagging system so Visio files can be linked to equipment types, system categories, or project templates
- [ ] Add "Open in Visio" deep link from diagram records for staff who need to edit
- [ ] Support Visio diagram attachments on project and pursuit records (e.g. as-built control diagrams at project close)
- [ ] Explore Visio Online embed via SharePoint viewer for read-only display without a Visio license

### Power Automate / Graph webhooks
- [ ] Evaluate Power Automate flows vs direct Graph API calls for each notification trigger
- [ ] Add Graph change notification subscriptions for SharePoint folder events (file added/renamed/deleted) to keep ProjectHub in sync without polling
- [ ] Document which flows require a Power Automate license vs what can be done with Graph API alone

**Success criteria:** Staff can take a meaningful action in ProjectHub (submit a bid, award a project, publish a report) and the right people are notified in Teams or Outlook automatically, calendar events exist for key dates, SharePoint files are accessible inline, and Visio diagrams are browsable in the knowledge base — all without leaving the app or manually copying information between tools.

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
- [ ] Tie the finished estimating module back into `Opportunity Hub` so quote requests, opportunities, estimates, and project creation share one lifecycle record instead of duplicate entry
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

### Time Reporting (needs significant investment)
Current state: ops_manager has a basic export to Excel. This is not enough.
- [ ] Labor hours by project, employee, and date range — in-app (no Excel required)
- [ ] Weekly/monthly labor cost summary per project (hours × burden rate)
- [ ] Overtime and after-hours breakdown per employee
- [ ] Time approval audit trail — who approved what and when
- [ ] Utilization report — billable vs non-billable hours by employee
- [ ] Project labor burn vs budget (actual vs estimated hours)
- [ ] Exportable PDF time reports for owner/GC billing submittals
- [ ] Scheduled email delivery of weekly labor summaries to ops manager

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
| 4c - AI-Assisted PM & Change Order Workflows | 2-3 weeks | Week 15 |
| 4d - Employee Safety Certification Tracking | 1-2 weeks | Week 17 |
| 4e - Internal Knowledge Base | 2-3 weeks | Week 20 |
| 4f - Microsoft 365 Deep Integration | 3-4 weeks | Week 24 |
| 5 - Estimating Module Migration | 6-10 weeks | Week 34 |
| 6 - Analytics | 2-3 weeks | Week 37 |
| 7 - QBO Integrations | 4-6 weeks | Week 43 |

**Platform is operationally useful from Phase 0. Full unification completes at Phase 5.**

---

## Next Three Steps (This Week)

1. **Create Supabase project** - the single most important unblock. 30 minutes of dashboard work.
2. **Register Azure AD app** - enables Microsoft SSO for Timothy and all PMs.
3. **Run migration, seed, and first login** - turns this from a codebase into a working product.

Everything else follows from those three steps.
