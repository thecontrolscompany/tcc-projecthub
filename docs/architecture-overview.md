# TCC Unified Internal Platform — Architecture Overview

**Date:** 2026-03-30
**Status:** Working platform foundation with active planning for lifecycle expansion

---

## 1. Product Vision

The Controls Company is building one unified internal operating platform that manages the full business lifecycle:

```
Quote Request → Estimate → Project → Billing / Closeout → Reporting
```

This is not a PM portal with extras bolted on. It is the company's system of record for workflow orchestration across estimating, project execution, billing, document control, and analytics.

The platform serves two distinct user populations that should never share the same application experience:

- **Internal staff** — admin, estimators, PMs, billing, accounting, executives
- **External/customers** — constrained quote intake and project status visibility only

---

## 2. Current State: Two Separate Applications

### Application A — Estimating Tool (LIVE)
**Location:** `C:\Users\TimothyCollins\dev\hvac-estimator`
**URL:** `internal.thecontrolscompany.com`
**Deployed via:** GitHub Actions → FTP → HostMonster (Apache static hosting)
**Stack:** React 19 + Vite, JavaScript (no TypeScript), localStorage only, no backend

**What it does well:**
- 445-assembly price book with full cost model (4-bucket: labor, material, overhead, profit)
- Rule-driven HVAC system configuration (VAV, AHU, RTU, FCU, UH, DX, VRF, Plant, Network)
- Interactive schematics with flow/electrical diagrams
- Proposal export (DOCX) and internal estimate export (HTML)
- Microsoft SSO via MSAL (Azure AD)
- Conduit fill calculator (NEC Chapter 9)
- Price snapshot audit trail (prices locked at estimate creation time)
- Well-documented (ARCHITECTURE.md, DOMAIN_MODEL.md, PRODUCT_ROADMAP.md)

**Current limitations:**
- No database — all data in browser localStorage (siloed per device/user)
- No server-side persistence or sharing
- No project lifecycle beyond the estimate itself
- No billing, no PM workflow, no customer visibility
- No SharePoint or document integration

### Application B — ProjectHub Operating Platform (THIS REPO, ACTIVE FOUNDATION)
**Location:** `C:\Users\TimothyCollins\dev\tcc-projecthub`
**Stack:** Next.js 16 + TypeScript + Supabase PostgreSQL
**Auth:** Microsoft SSO (admin/PM) + email/password (customers)

**What it has:**
- Full database schema with RLS (profiles, customers, projects, billing_periods, weekly_updates)
- Billing table with inline editing, TanStack Table, legacy formula replicated
- Roll-forward, POC sheet sync, Outlook draft email generation
- Analytics with Recharts + Power BI embed
- Customer portal routes and customer-safe data flows
- PM workflow foundation including weekly updates
- Admin user management
- Project, PM, customer, time, and admin route surfaces
- API routes for Graph API (OneDrive, Outlook, SharePoint-adjacent workflows), Excel export, PM/customer data, and project operations

**Current limitations:**
- Not yet connected to a live Supabase project (env vars not configured)
- No estimating capability
- No quote request workflow
- Projects are manually created; no lifecycle from estimate
- PM and customer flows need live-data hardening, route cleanup, and shell/navigation unification rather than greenfield invention
- Dark-mode only (no light/dark toggle)
- No branding assets integrated

---

## 3. Target Architecture

### 3.1 Platform Model

The unified platform is **one internal application** at `internal.thecontrolscompany.com`, structured as a Next.js App Router application with:

- Role-based module access (not separate apps per role)
- Shared auth model (Microsoft SSO for all internal users)
- Shared database (Supabase PostgreSQL)
- SharePoint as document backbone
- External customer access via a separate constrained surface (same backend)

### 3.2 Application Layers

```
┌──────────────────────────────────────────────────────────┐
│  internal.thecontrolscompany.com                         │
│  Internal staff — full role-based access                 │
│                                                          │
│  /quotes     /estimating   /projects   /pm               │
│  /billing    /admin        /analytics  /documents        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  portal.thecontrolscompany.com (or /customer/*)          │
│  External customers — constrained intake & status only   │
│                                                          │
│  /customer/quotes  /customer/projects  /customer/billing  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Shared Backend Services                                  │
│  Supabase PostgreSQL + Auth                               │
│  Microsoft Graph API (OneDrive, SharePoint, Outlook)      │
│  QuickBooks Online API (future)                           │
│  QuickBooks Time API (future)                             │
│  Power BI Embedded                                        │
└──────────────────────────────────────────────────────────┘
```

### 3.3 Core Domains

| Domain | Description | Primary Route |
|--------|-------------|---------------|
| Quote Requests | Intake, triage, assignment, status tracking | `/quotes` |
| Estimating | HVAC system configuration, cost modeling, proposal export | `/estimating` |
| Projects | Awarded jobs, baselines, lifecycle management | `/projects` |
| PM Execution | Weekly updates, % complete, field management | `/pm` |
| Billing | Earned revenue, roll-forward, invoicing, QBO sync | `/billing` |
| Documents | SharePoint integration, folder management | `/documents` |
| Admin | Users, roles, master data, settings | `/admin` |
| Analytics | Power BI embed, native Recharts dashboards | `/analytics` |

---

## 4. The Lifecycle Model

The backbone of the entire platform is a single forward-moving lifecycle:

```
Quote Request ──→ Estimate ──→ Project ──→ Billing ──→ Closeout
     QR-2026-001     EST-2026-014    2026-041

Each conversion:
  - inherits prior record's data (no re-entry)
  - locks the prior record as a historical baseline
  - creates a new document folder in SharePoint
  - generates a new system identifier
```

**Estimate as immutable baseline:**
When a project is created from an awarded estimate, the estimate is snapshotted and locked. The project tracks actuals against that baseline. This enables variance analysis and future estimating calibration.

---

## 5. Key Architectural Decisions

### Decision 1: Integration Path for the Estimating Tool
The live estimating tool (hvac-estimator) is a mature JavaScript/Vite SPA with no backend. It should **not** be rewritten immediately. The integration path is phased extraction into the Next.js platform. See [live-site-integration-strategy.md](./live-site-integration-strategy.md).

### Decision 2: Database vs SharePoint
- **Supabase (PostgreSQL):** Operational records — projects, estimates, billing periods, users, quotes
- **SharePoint:** Documents, folder structure, file storage, versioned deliverables
- These are complementary, not competing. Each record in the DB links to its SharePoint folder.

### Decision 3: Customer Isolation
Customer users never enter the internal application. They access a constrained surface that exposes only their quote requests, project status updates, and billing history. Internal margins, labor budgets, and estimating data are never exposed.

### Decision 4: Auth Model
- **Internal users:** Microsoft SSO (Azure AD) — works immediately, no credential management
- **Customer users:** Supabase email/password — created by admin, no M365 account required

### Decision 5: Theme System
The current dark-only UI is not the target. The platform requires a proper light/dark theme system with TCC brand tokens applied to both modes. This is a product requirement, not a cosmetic preference.

---

## 6. Technology Stack (Target)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 16 App Router + TypeScript | This repo |
| Estimating module | React/Vite components (migrated) | From hvac-estimator |
| Database | Supabase PostgreSQL | With RLS |
| Auth | Supabase Auth (Azure AD + email/pw) | Already configured |
| Document storage | Microsoft SharePoint via Graph API | OneDrive already working |
| Styling | Tailwind CSS + CSS custom properties | Theme tokens |
| Charts | Recharts (native) + Power BI Embedded | Both in place |
| Exports | ExcelJS (billing), DOCX generation (proposals) | ExcelJS ready |
| Forms | react-hook-form + zod | Installed |
| Tables | TanStack Table | Installed |
| Email | Microsoft Graph API (Outlook drafts) | Implemented |
| Deployment | Vercel (Next.js) + HostMonster (estimating until migrated) | Parallel |
| CI/CD | GitHub Actions | estimating tool already deployed this way |

---

## 7. What This Repo Becomes

This repo (`tcc-projecthub`) is the **target platform**. It is not a prototype to be discarded.

The estimating tool (`hvac-estimator`) is a **valuable module** whose estimating logic, price book, and HVAC system configuration engine will be migrated into this platform as the Estimating domain module.

The migration is phased and low-risk. The live estimating tool continues operating independently until the Next.js platform can fully replace its functionality.

See [implementation-roadmap.md](./implementation-roadmap.md) for the phased plan.
