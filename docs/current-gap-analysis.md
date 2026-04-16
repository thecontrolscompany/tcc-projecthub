# TCC Unified Platform - Current Gap Analysis

**Date:** 2026-03-30
**Comparing:** current tcc-projecthub repo vs. target unified platform vision

---

## 1. Summary Table

| Area | Current State | Target State | Gap Size |
|------|--------------|--------------|----------|
| Billing table | Built, tested, build passing | Matches target | None |
| PM weekly updates | Built | Strong foundation, expand into fuller `/pm` detail workflow | Minor |
| Customer portal | Built | Consolidate under `/customer/*`, connect live data, polish UX | Small |
| Auth: Microsoft SSO | Configured in code | Need Azure AD app registration and live validation | Ops only |
| Auth: Email/password | Built | Matches target | None |
| Database schema | Written | Need Supabase project + migration run | Ops only |
| Quote requests / Opportunity Hub | Not built yet | Full domain needed | Large |
| Estimating module | Not in this repo | Full domain needed (migration from hvac-estimator) | Very Large |
| Project lifecycle conversion | Partial | Quote -> Estimate -> Project conversion | Large |
| Job numbering | Not built | Auto-generated YYYY-NNN | Medium |
| Expanded roles | Only admin/pm/customer | estimator, billing, accounting, executive | Medium |
| SharePoint integration | Partial | Full SharePoint folder management | Medium |
| App shell / nav | Multiple route surfaces, no unified sidebar shell | Persistent sidebar, role-filtered nav | Medium |
| Light/dark theme | Dark only | Switchable, brand-token driven | Medium |
| Branding assets | Placeholder branding | TCC logos, Raleway font, brand palette | Small-Medium |
| Analytics | Recharts + Power BI embed built | Expand to quote/estimating analytics | Small |
| Documents domain | Not built as a dedicated module | SharePoint browser + file management | Medium |
| Change orders | Not built as a full domain | Future scope | Future |
| QBO integration | Not built | Future scope | Future |
| QBO Time | Not built | Future scope | Future |
| Price book (server) | Not built in this repo | Supabase price_book_overrides table | Medium |
| HVAC system editor | Not in this repo | Migrate from hvac-estimator | Very Large |
| Mobile responsiveness | Partially validated | PM/customer workflows should be proven on actual phones | Small |

---

## 2. Critical Gaps (Block Production Use)

These gaps must be resolved before users can rely on the platform daily.

### Gap 1: Supabase project not connected
**Impact:** Database-backed routes cannot operate against live data.
**Fix:** Create Supabase project, run migration, fill `.env.local`, seed data.
**Effort:** 2 hours of mostly dashboard setup.

### Gap 2: Azure AD app not registered
**Impact:** Microsoft SSO fails for admin and PM users.
**Fix:** Register app in Azure Portal, configure Supabase OAuth provider, test login flow.
**Effort:** 2-4 hours.

### Gap 3: No real project data loaded
**Impact:** PM, billing, and customer portals show empty or unrealistic states.
**Fix:** Seed users, import first real projects from the legacy Excel tracker, validate routes with live records.
**Effort:** 4-8 hours.

---

## 3. High-Priority Gaps (Needed for Full Value)

### Gap 4: Opportunity Hub / quote intake domain missing
The front-of-funnel workflow (`/quotes`) still needs to be built. This is the most strategically important missing piece because it becomes the front door to the lifecycle.

Important framing: this is additive work on top of an already substantial PM, billing, projects, and customer foundation. ProjectHub is not waiting on this to become a real platform; this is the next major domain expansion.

**What needs building:**
- Quote request DB schema and richer opportunity fields
- `/quotes` dashboard
- `/quotes/new` intake form
- `/quotes/[id]` detail page with status actions
- `/customer/quotes` and `/customer/quotes/new`
- SharePoint folder creation on submission
- Email notification on new submission

**Effort:** Large (2-3 weeks of focused work)

### Gap 5: Estimating domain not in this repo
The hvac-estimator is a mature tool but isolated. Until its estimating logic is in the Next.js platform or writing shared records to Supabase:
- no full estimate -> project conversion flow
- no server-side estimate persistence in this repo
- no shared estimate access across users from ProjectHub

**What needs building:** See [live-site-integration-strategy.md](./live-site-integration-strategy.md) for the phased migration plan.

**Effort:** Very large (6-12 weeks, phased approach recommended)

### Gap 6: Project lifecycle conversion not implemented
Projects are still manually created. There is no award/conversion flow that:
- creates a job number
- locks the estimate as a baseline
- creates a SharePoint project folder
- notifies the PM

**Effort:** Medium (1-2 weeks)

### Gap 7: Expanded role model not implemented
Current roles are `admin | pm | customer`. Missing: `estimator | billing | accounting | executive`.

**Effort:** Medium (about 1 week across schema, middleware, and UI filters)

---

## 4. Medium-Priority Gaps

### Gap 8: App shell lacks persistent sidebar navigation
The product already has meaningful PM, billing, projects, customer, time, and admin surfaces. What is missing is the shared shell that makes those modules feel like one coherent platform.

Needed capabilities:
- role-filtered sidebar
- shared layout across internal routes
- mobile collapse behavior

**Effort:** Medium (about 1 week)

### Gap 9: Dark-only theme
Pages still rely heavily on dark-only styling and need the brand-token light/dark system.

**Effort:** Medium (1-2 weeks)

### Gap 10: Brand assets not integrated
The app still needs real TCC logos, fonts, and branded header treatment.

**Effort:** Small (2-3 days)

### Gap 11: SharePoint folder management not complete
Current integrations cover pieces of OneDrive/Graph workflows, but not the full folder lifecycle needed for opportunities and projects.

**Effort:** Medium (1-2 weeks)

---

## 5. What the Current Repo Gets Right

These are genuine strengths to build on, not throw away:

| Strength | Details |
|---------|---------|
| Billing calculation | Legacy formula exactly replicated, tested via build |
| TanStack billing table | Inline editing, sorting, filtering, color coding at near-production quality |
| Roll-forward | Mirrors legacy Module2, automated |
| PM workflow base | PM dashboard and weekly update patterns already exist and need extension/hardening more than reinvention |
| Customer portal base | Customer-facing portal surface already exists and needs route consolidation, live wiring, and UX cleanup more than greenfield buildout |
| PM email drafts | Graph API Outlook draft creation with no accidental sends |
| POC sheet sync | Graph API/OneDrive cell reads replacing sync scripts |
| Excel export | ExcelJS formatting aligned with legacy structure |
| Supabase RLS | Security-first schema design is already in place |
| Auth architecture | Both SSO and customer-auth paths are already designed |
| Power BI embed | Already wired and ready for workspace/report IDs |
| Type system | TypeScript types cover DB entities and route data shapes |
| Build quality | Clean production build and meaningful route structure already exist |

---

## 6. What the hvac-estimator Gets Right

These strengths from the live tool must be preserved during migration:

| Strength | Details |
|---------|---------|
| 445 assemblies | Comprehensive price book, manually curated, validated by tests |
| Cost model | Battle-tested labor/material/overhead/profit model with many adjustments |
| Price snapshot | Prices locked at estimate creation for auditability |
| Rule-driven config | Complex VAV/AHU/RTU/FCU/UH/DX/VRF rules already working |
| Schematic diagrams | SVG flow and electrical diagrams by system type |
| DOCX proposal export | Working proposal generation pipeline |
| Tests | Multiple Vitest suites already covering critical estimating logic |
| MSAL auth | Already configured and working in the live tool |
| Architecture docs | Strong documentation baseline for migration |

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Estimating migration breaks price book data | High | High | Port assembly data as-is first, migrate deeper later |
| localStorage estimates lost during migration | High | High | Export-to-server migration utility before cutover |
| Azure AD app misconfigured | Medium | High | Test SSO in staging before production |
| Supabase RLS misconfiguration | Medium | High | Test each role with seeded users before launch |
| PM mobile experience is poor | Medium | Medium | Test weekly update form on an actual phone before launch |
| SharePoint Graph API permissions are incomplete | Medium | Medium | Validate scopes against the real tenant/site |
| Power BI embed token refresh issues | Low | Medium | Use service principal / stable embed flow |

---

## 8. Recommended Immediate Next Steps

In order of priority:

1. **Configure Supabase + Azure AD** so the existing platform can run against live auth/data.
2. **Run migration + seed data** so PM, billing, projects, and customer flows can be exercised with real records.
3. **Integrate branding assets** for quick visible polish.
4. **Add persistent sidebar nav** to unify the PM, billing, projects, customer, and admin surfaces already present.
5. **Harden PM and customer flows with live data** by validating role access, `/customer/*` routing, and real project states.
6. **Build Opportunity Hub** as the next major domain.
7. **Expand the role model** and keep estimating migration phased behind the live PM/customer platform work.
