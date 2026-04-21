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

- [ ] **Budget vs Actual** (Priority: High) - labor and material cost vs estimate by project; feeds job costing. Depends on timesheets and BOM. Spec: `codex/roadmap-budget-vs-actual.md`
- [ ] **QBO Integration** (Priority: High) - 4-phase OAuth sync: read customers/estimates/invoices -> write invoices -> bills/payroll -> full 2-way. Spec: `codex/roadmap-qbo-integration.md`
- [ ] **Estimator <-> ProjectHub Integration** (Priority: High) - Phase 1: cloud auth migration; Phase 2: link estimates to projects; Phase 3: push POC weights from estimate. Spec: `.claude/plans/goofy-sniffing-karp.md`
- [ ] **Scheduling / Crew Calendar** (Priority: Medium) - visual week-view calendar for crew assignments by project; admin and PM views. Spec: `codex/roadmap-scheduling-crew-calendar.md`
- [ ] **Barcode Scanner** (Priority: Low) - phone camera QR/barcode scanner for BOM receiving on mobile; offline caching for military sites. Depends on BOM. Spec: `codex/roadmap-barcode-scanner.md`
