# TCC Unified Platform — Route, Role, and UI Plan

**Date:** 2026-03-30

---

## 1. Role Model

The current `admin | pm | customer` model is too small. The target role model maps to actual business functions.

### Internal Roles

| Role | Description | Key Access |
|------|-------------|-----------|
| `admin` | Timothy Collins — full system access | Everything |
| `estimator` | Creates and manages estimates | `/estimating`, `/quotes` (assign), `/projects` (read) |
| `pm` | Executes assigned projects | `/pm`, `/projects` (own), `/billing` (read own) |
| `billing` | Manages billing periods, invoices | `/billing`, `/projects` (read), `/analytics` (billing views) |
| `accounting` | Financial oversight | `/billing` (read), `/analytics`, QBO sync view |
| `executive` | Company leadership | All read-only dashboards, `/analytics` full |

### External Roles

| Role | Description | Key Access |
|------|-------------|-----------|
| `customer` | Approved customer contact | `/customer/*` only — quote submit, project status, billing history |

### Role Assignment Rules

- Internal roles assigned by admin only
- A user can hold multiple internal roles (e.g., `estimator + pm`)
- Customer role is exclusive — cannot be combined with internal roles
- Roles stored in `profiles.role` (primary) with future `profile_roles` join table for multi-role
- RLS policies enforce at the database level regardless of UI state

---

## 2. Route Map — Internal Application

All routes under `/` are internal. Middleware redirects unauthenticated users to `/login`. Role-based middleware enforces access by route prefix.

### Top-Level Navigation

```
/                     → redirect to role home (admin → /quotes, pm → /pm, etc.)

/login                → Microsoft SSO + email/password
/auth/callback        → OAuth callback (already built)
/auth/confirm         → Password reset confirmation (already built)
```

### Quotes Domain `/quotes`
```
/quotes               → Quote request dashboard (table: all requests, sortable)
/quotes/new           → New quote request (admin/estimator create for customer)
/quotes/[id]          → Quote request detail
/quotes/[id]/edit     → Edit quote request
```
**Accessible by:** `admin`, `estimator`

### Estimating Domain `/estimating`
```
/estimating           → Estimate list (cards or table)
/estimating/new       → New estimate (manual start)
/estimating/[id]      → Estimate detail — HVAC system builder, cost summary
/estimating/[id]/edit → Edit estimate settings / add systems
/pricebook            → Price book editor (admin + estimator)
```
**Accessible by:** `admin`, `estimator`
**Note:** This domain absorbs the core functionality of hvac-estimator.

### Projects Domain `/projects`
```
/projects             → Project list (all active jobs)
/projects/[id]        → Project detail — overview, billing summary, documents link, team
/projects/[id]/billing → Billing periods for this project (redirect to /billing filtered)
/projects/[id]/documents → Link to SharePoint folder
```
**Accessible by:** `admin`, `estimator` (read), `pm` (own projects), `billing`, `accounting`, `executive`

### PM Execution Domain `/pm`
```
/pm                   → PM dashboard — assigned projects, status at a glance
/pm/[projectId]       → Project detail for PM — weekly update form, update history
```
**Accessible by:** `admin`, `pm`

### Billing Domain `/billing`
```
/billing              → Billing command center — TanStack table (existing admin page, extracted)
/billing/[month]      → Billing period detail for selected month
```
**Accessible by:** `admin`, `billing`, `accounting`

### Admin Domain `/admin`
```
/admin                → Admin overview / quick stats
/admin/users          → User management — create/edit accounts (already built)
/admin/customers      → Customer master data
/admin/pm-directory   → PM first names for email generation (already built)
/admin/settings       → App settings (theme defaults, etc.)
```
**Accessible by:** `admin` only

### Analytics Domain `/analytics`
```
/analytics            → Dashboard — Recharts + Power BI embed (already built as /admin/analytics)
/analytics/quotes     → Quote pipeline funnel, win rate, turnaround time
/analytics/estimating → Estimate accuracy, margin trends
/analytics/billing    → Projected vs actual, backlog trend (already built)
/analytics/projects   → Project health, PM utilization
```
**Accessible by:** `admin`, `executive`, `accounting` (billing only)

### Documents `/documents`
```
/documents            → SharePoint browser (iframe or Graph API file tree)
/documents/[path...]  → Navigate folder, preview, download
```
**Accessible by:** `admin`, `estimator`, `pm` (own projects), `billing`

---

## 3. Route Map — Customer Surface

Customer users never see internal routes. After login they land at `/customer`.

```
/customer             → Customer home — my quote requests + my projects
/customer/quotes      → My quote requests list
/customer/quotes/new  → Submit a new quote request
/customer/quotes/[id] → My quote request status + communication
/customer/projects    → My project status
/customer/projects/[id] → Project updates + billing history (already built, extract and move)
```

**Customer rules:**
- Customers see only records linked to their `customers.id`
- Internal margins, labor, estimates are never exposed
- Estimate data is completely hidden
- Billing history shows period, % complete, and billed amount only (already implemented)

---

## 4. Navigation Architecture

### Internal App Shell

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: [TCC Logo]  [Theme Toggle]  [User Avatar]  [Sign Out] │
├──────────────────────────────────────────────────────────────┤
│ SIDEBAR (role-filtered):                                      │
│   Quotes                                                      │
│   Estimating                                                  │
│   Projects                                                    │
│   PM                                                          │
│   Billing                                                     │
│   Documents                                                   │
│   Analytics                                                   │
│   ─────                                                       │
│   Admin         (admin only)                                  │
│   Price Book    (admin + estimator)                           │
├──────────────────────────────────────────────────────────────┤
│ MAIN CONTENT AREA                                             │
│ (route-driven, role-gated)                                    │
└──────────────────────────────────────────────────────────────┘
```

The current app shell (one header, no persistent sidebar) needs to be upgraded to a two-panel layout. The hvac-estimator already has `SidebarLayout.jsx` — this pattern can be adapted.

### Customer App Shell

Intentionally minimal. No sidebar. Simple header with logo + sign out. Breadcrumb navigation only.

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: [TCC Logo]  [Customer Portal]  [Sign Out]            │
├──────────────────────────────────────────────────────────────┤
│ MAIN CONTENT AREA                                             │
│ (constrained to customer-safe routes only)                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Role → Route Permission Matrix

| Route prefix | admin | estimator | pm | billing | accounting | executive | customer |
|-------------|-------|-----------|----|---------|-----------|-----------| ---------|
| `/quotes` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/estimating` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/pricebook` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/projects` | ✅ | ✅ read | ✅ own | ✅ read | ✅ read | ✅ read | ❌ |
| `/pm` | ✅ | ❌ | ✅ own | ❌ | ❌ | ❌ | ❌ |
| `/billing` | ✅ | ❌ | ❌ | ✅ | ✅ read | ❌ | ❌ |
| `/admin` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/analytics` | ✅ | ❌ | ❌ | ✅ billing | ✅ | ✅ | ❌ |
| `/documents` | ✅ | ✅ | ✅ own | ✅ | ❌ | ❌ | ❌ |
| `/customer/*` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ own |

---

## 6. Role Home Pages (post-login redirect)

| Role | Home route | Landing view |
|------|-----------|--------------|
| `admin` | `/quotes` | Quote request dashboard |
| `estimator` | `/quotes` | Assigned quote requests |
| `pm` | `/pm` | My project list |
| `billing` | `/billing` | Current billing period |
| `accounting` | `/analytics` | Financial overview |
| `executive` | `/analytics` | Company dashboard |
| `customer` | `/customer` | My quotes + projects |

---

## 7. Page-Level UX Patterns

### Data Tables (admin/billing views)
- TanStack Table with sorting, filtering, global search
- Inline editable cells for key fields (% complete, actual billed)
- Row color coding (matching legacy Excel conventions)
- Sticky header + footer totals row

### Detail Pages (projects, quotes, estimates)
- Two-column layout: main content + sidebar (status, actions, metadata)
- Tab navigation for sub-sections (Overview / Billing / Documents / Updates)
- Action buttons in sticky sidebar, not scattered through content

### List Pages (projects list, quotes list)
- Card grid or compact table — user-selectable density
- Status chips with consistent color coding across the app
- Quick filters (by status, by PM, by customer, by date range)

### Forms (quote request intake, weekly updates, project creation)
- react-hook-form + zod validation (already installed)
- Step indicator for multi-step flows (quote intake has many fields)
- Auto-save drafts for long forms

### Mobile Responsiveness
- Sidebar collapses to hamburger on mobile
- Tables scroll horizontally with sticky first column
- Weekly update form must work well on phone (PMs in the field)
