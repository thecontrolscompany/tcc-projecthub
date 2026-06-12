# TCC ProjectHub - Roadmap

> **Rule:** When a feature is built and deployed, move it to Completed immediately - before closing the task. Never leave a completed feature in Planned.

---

## Completed

- [x] **Auth** - Microsoft SSO (admin/PM) + email/password (customers); role-based redirect; route protection middleware
- [x] **Theme system** - branded light/dark tokens, Raleway fonts, and theme toggle
- [x] **Shared app shell** - sidebar navigation, top header, role-filtered nav, and mobile drawer
- [x] **Admin billing table** - TanStack Table with inline editing, roll-forward month, POC sync, Outlook draft email gen, and Excel export
- [x] **Admin billing history** - per-project backfill and editable billing periods
- [x] **Admin analytics** - Recharts charts and Power BI embed
- [x] **Admin projects management** - create/edit projects, job numbers, compliance fields, and SharePoint provisioning
- [x] **Admin contacts and users** - PM directory/contact management, customer accounts, phone formatting, and role changes
- [x] **Admin ops view** - grouped operations view with shared project editor
- [x] **PM directory import** - Microsoft user import, consent UX, and PM auto-link on sign-in
- [x] **Role-based internal portals** - admin, PM, lead, installer, ops manager, and customer navigation/routing
- [x] **Projects page** - active/completed project list with customer and PM context
- [x] **Installer portal** - assigned project dashboard with SharePoint links and latest progress
- [x] **PM portal** - assigned project list, overview, contacts, weekly updates, POC, change orders, RFIs, photos, and BOM
- [x] **PM weekly updates** - draft/submit/edit flow, edit history, print view, import, and QB Time labor-hour pulls
- [x] **PM portal mobile UX** - mobile-friendly layout, compact read views, and drawer navigation
- [x] **Customer portal** - branded read-only dashboard with updates, billing, team contacts, materials, feedback, and public status links
- [x] **Customer portal access controls** - per-project portal access and digest settings tied to project contacts
- [x] **Public status pages** - shareable project snapshot pages by job number
- [x] **Graph API integration** - OneDrive POC sync, Outlook draft creation, and Excel upload
- [x] **SharePoint migration tools** - project migration, cleanup, folder tracking, and archive handling
- [x] **SharePoint document uploads** - contract, scope, and estimate uploads into project folders
- [x] **Quote requests** - `/quotes` workflow with public submit and admin update routes
- [x] **Quote-to-project conversion** - won quotes can generate projects and seed current billing
- [x] **Weekly report printing** - print-friendly weekly update pages and shared report links
- [x] **Change orders** - project-scoped change order tracking and customer visibility
- [x] **Project contacts** - customer-facing project team display with phone/email and richer project header info
- [x] **WIP Tracker** - per-project task management with status, priority, and blocker tracking
- [x] **Feedback workflow** - internal feedback page, customer feedback, and admin review inbox
- [x] **Email notifications** - event-driven emails via Resend
- [x] **Materials / BOM** - line item tracking, receipt log, direct receipt editing, reconciliation, and printable report
- [x] **Pursuits / lead tracking** - opportunity lifecycle, analytics, and SharePoint-linked pursuit records
- [x] **RFI log** - auto-numbered RFIs, response tracking, and role-based access
- [x] **Admin View As** - role preview banner for admin testing
- [x] **Timesheets / Time tracking** - time entries, approvals, reconciliation, QB sync, weekly summaries, and project/employee hour breakdowns
- [x] **Printable reports** - weekly update, BOM, change order, and status pages with print-ready layouts

---

## Planned

### Near-Term
- [ ] **Controls/Turnkey Estimating Redesign** (Priority: High) — every estimate computes Install Labor/Material + Controls Material/Engineering Labor buckets from one item selection; `estimateScopeMode` becomes an Install Only vs Turnkey export toggle; adds a 40/40/20 sanity check and curated part substitution. **Phase 1 done** — `install_assembly_catalog`/`controls_assembly_catalog` Supabase tables (org-scoped, module-gated) replace the static `assemblyData.js`/localStorage price book; install catalog seeded (400 rows for `tcc`); Price Book rebuilt as live Install/Controls tabs. Remaining: Phase 2 (controls catalog content + install/controls pairing), Phase 3 (four-bucket cost model + scope mode simplification), Phase 4 (sanity check + substitution UI). Spec: `codex/roadmap-controls-turnkey-estimating.md`
- [ ] **Budget vs Actual** (Priority: High) — labor and material cost vs estimate by project; feeds job costing. Depends on timesheets and BOM. Spec: `codex/roadmap-budget-vs-actual.md`
- [ ] **QBO Integration** (Priority: High) — 4-phase OAuth sync: read customers/estimates/invoices → write invoices → bills/payroll → full 2-way. Spec: `codex/roadmap-qbo-integration.md`
- [ ] **Estimator ↔ ProjectHub Integration** (Priority: High) — Phase 1: cloud auth migration; Phase 2: link estimates to projects; Phase 3: push POC weights from estimate. Spec: `.claude/plans/goofy-sniffing-karp.md`
- [ ] **Scheduling / Crew Calendar** (Priority: Medium) — visual week-view calendar for crew assignments by project; admin and PM views. Spec: `codex/roadmap-scheduling-crew-calendar.md`
- [ ] **Barcode Scanner** (Priority: Low) — phone camera QR/barcode scanner for BOM receiving on mobile; offline caching for military sites. Spec: `codex/roadmap-barcode-scanner.md`

### AI and Automation
- [ ] **AI-assisted weekly report drafting** — suggest polished report language from crew logs, notes, blockers, and prior context; flag missing sections before submission; produce customer-facing summary alongside internal draft
- [ ] **AI change order coverage review** — expand PM rough scope notes into a full checklist of direct/indirect cost drivers (labor, material, lost time, travel, escalation, schedule impact, overhead, profit); draft formal change order language
- [ ] **Project knowledge agent** — PM and leadership can ask questions across report history and project documents; grounded in SharePoint files and weekly updates
- [ ] **AI variance analysis** — automated variance explanations, trend summaries, and forecast commentary drafts in the analytics module

### People and Compliance
- [ ] **Employee safety certification tracking** — matrix view (employee × certification) with current/expiring/expired/missing states; SharePoint-backed document storage; expiration reminders. Spec: `docs/implementation-roadmap.md` Phase 4d
- [ ] **Internal knowledge base** — searchable SOPs, wiring diagram library, acronym finder, and onboarding articles; role-gated authoring; linked from relevant app contexts. Spec: `docs/implementation-roadmap.md` Phase 4e

### Microsoft 365 Deep Integration
- [ ] **Teams notifications** — post to configured channel on quote submitted, bid won/lost, report published, billing period closed; Adaptive Card alerts for time-sensitive events
- [ ] **Full Outlook send** — replace draft stubs with confirmed send for award notifications, PM billing alerts, bid submission confirmations, and quote acknowledgments
- [ ] **Outlook calendar events** — create events for bid due dates, submission deadlines, and project milestones from within the app
- [ ] **SharePoint inline previews** — surface document previews and version history on pursuit/project detail pages; sync folder changes back via Graph webhooks
- [ ] **Visio diagram library** — store and preview `.vsdx` wiring diagrams in the knowledge base; tag by equipment type; "Open in Visio" deep link for editors
- [ ] **Inbound photo intake** — field staff text or email photos to a project-specific address; photos land in the correct SharePoint folder and appear in the PM portal

### Finance and Analytics
- [ ] **Advanced analytics / FP&A layer** — variance analysis (actual vs budget, billed vs earned, labor burn vs baseline); scenario modeling (best/expected/worst revenue outlook); rolling forecasts; planning audit history; budget owner input workflow. Benchmarked against Cube.
- [ ] **Supplier spend metrics** — material purchases and subcontractor invoices per project; spend by vendor and category; spend vs material budget; flag projects with unusually high supplier spend
- [ ] **Executive reporting** — board-ready dashboard views; scheduled report delivery; spreadsheet-connected finance workflows for billing/accounting users
- [ ] **Power BI full buildout** — publish `.pbix` connecting to Supabase; service principal embed token; workspace and report IDs wired to env vars

### Platform Evolution
- [ ] **Modal workflow consolidation** (Priority: Medium) — reduce duplicate modal and modal-like UIs that accomplish the same job with different flows; unify shared project creation, billing-period editing, and import-dialog patterns to cut drift and maintenance risk. Spec: `codex/roadmap-modal-workflow-consolidation.md`
- [ ] **Offline access and background sync** (Priority: Medium) — PWA shell with service worker caching for field staff on restricted military sites; offline write queue for weekly updates, material receipts, and time entries with auto-sync on reconnect. Spec: `codex/roadmap-offline-sync.md`
- [ ] **Estimating module migration** (Priority: High, Long-term) — port hvac-estimator data layer and UI into ProjectHub as a first-class module; unified auth, shared project lifecycle, estimate-to-project conversion; retire standalone hvac-estimator. Spec: `docs/implementation-roadmap.md` Phase 5
- [ ] **Public-facing quote intake** — customer-facing quote request form with drag-and-drop file uploads, progress tracking, and Dropbox-style file request experience; SharePoint folder provisioned on submission
- [ ] **Award Project flow** — convert won estimate to project with one action: auto job number, locked estimate baseline, SharePoint folder tree from template, PM notification draft
- [ ] **Expanded role model** — estimator, billing, accounting, executive roles with route-level access; multi-role support via junction table
