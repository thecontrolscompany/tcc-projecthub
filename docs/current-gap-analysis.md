# TCC Unified Platform — Current Gap Analysis

**Date:** 2026-03-30
**Comparing:** current tcc-projecthub repo vs. target unified platform vision

---

## 1. Summary Table

| Area | Current State | Target State | Gap Size |
|------|--------------|--------------|----------|
| Billing table | ✅ Built, tested, build passing | ✅ Matches target | None |
| PM weekly updates | ✅ Built | ✅ Matches target | Minor (expand to `/pm/[id]`) |
| Customer portal | ✅ Built | Needs route move to `/customer/*` | Small |
| Auth: Microsoft SSO | ✅ Configured | Need Azure AD app registration | Ops only |
| Auth: Email/password | ✅ Built | ✅ Matches target | None |
| Database schema | ✅ Written | Need Supabase project + migration run | Ops only |
| Quote requests | ❌ Not built | Full domain needed | **Large** |
| Estimating module | ❌ Not in this repo | Full domain needed (migration from hvac-estimator) | **Very Large** |
| Project lifecycle | ⚠️ Partial (projects table, no conversion flow) | Quote→Estimate→Project conversion | **Large** |
| Job numbering | ❌ Not built | Auto-generated YYYY-NNN | Medium |
| Expanded roles | ❌ Only admin/pm/customer | estimator, billing, accounting, executive | Medium |
| SharePoint integration | ⚠️ OneDrive only (POC sync, export) | Full SharePoint folder management | Medium |
| App shell / nav | ⚠️ Per-page headers, no sidebar | Persistent sidebar, role-filtered nav | Medium |
| Light/dark theme | ❌ Dark only | Switchable, brand-token driven | Medium |
| Branding assets | ❌ Generic placeholder | TCC logos, Raleway font, brand palette | Small-Medium |
| Analytics | ✅ Recharts + Power BI embed built | Expand to quote/estimating analytics | Small |
| Documents domain | ❌ Not built | SharePoint browser + file management | Medium |
| Change orders | ❌ Not built | Future scope, stub only | Future |
| QBO integration | ❌ Not built | Future, stubs only | Future |
| QBO Time | ❌ Not built | Future | Future |
| Price book (server) | ❌ Not built (hvac-estimator uses localStorage) | Supabase price_book_overrides table | Medium |
| HVAC system editor | ❌ Not in this repo | Migrate from hvac-estimator | **Very Large** |
| Mobile responsiveness | ⚠️ Not validated | PM update form must work on mobile | Small |

---

## 2. Critical Gaps (Block Production Use)

These gaps must be resolved before any user can rely on the platform.

### Gap 1: Supabase project not connected
**Impact:** Nothing works without this. All database queries fail.
**Fix:** Create Supabase project → run migration → fill `.env.local` → seed data.
**Effort:** 2 hours (mostly Supabase dashboard work)

### Gap 2: Azure AD app not registered
**Impact:** Microsoft SSO fails. Admin and PM cannot log in.
**Fix:** Register app in Azure Portal → configure Supabase OAuth provider → test login flow.
**Effort:** 2-4 hours

### Gap 3: No projects exist in the database
**Impact:** All portals show empty states.
**Fix:** Run seed data after auth is configured. Import existing projects from legacy Excel tracker.
**Effort:** 4-8 hours (manual data entry from Excel + seed script)

---

## 3. High-Priority Gaps (Needed for Full Value)

### Gap 4: Quote Request domain missing
The entire front-of-funnel workflow (`/quotes`) does not exist. This is the most strategically important missing piece — it is the "front door" to the lifecycle.

**What needs building:**
- Quote request DB schema (migration 002)
- `/quotes` dashboard page
- `/quotes/new` intake form
- `/quotes/[id]` detail page with status actions
- `/customer/quotes` intake form for customers
- SharePoint folder creation on submission
- Email notification on new submission

**Effort:** Large (2-3 weeks of focused work)

### Gap 5: Estimating domain not in this repo
The hvac-estimator is a mature tool but isolated. Until its estimating logic is in the Next.js platform:
- No estimate → project conversion
- No server-side estimate persistence (lost if user clears browser)
- No shared estimate access across users

**What needs building:** See [live-site-integration-strategy.md](./live-site-integration-strategy.md) for phased migration plan.

**Effort:** Very large (6-12 weeks, phased approach recommended)

### Gap 6: Project lifecycle conversion not implemented
Currently projects are manually created. There is no "Award Project" button that:
- Creates a job number
- Locks the estimate as baseline
- Creates a SharePoint project folder
- Notifies the PM

**Effort:** Medium (1-2 weeks)

### Gap 7: Expanded role model not implemented
Current roles: `admin | pm | customer`. Missing: `estimator | billing | accounting | executive`.
The middleware and RLS policies need to be updated to enforce these roles.

**Effort:** Medium (1 week — schema change + middleware update + UI nav filter)

---

## 4. Medium-Priority Gaps

### Gap 8: App shell lacks persistent sidebar navigation
Each page currently has its own bespoke header. The target architecture uses a shared sidebar that:
- Is role-filtered (estimators see estimating links, PMs see PM links)
- Persists across all internal routes
- Collapses on mobile

**Effort:** Medium (1 week — layout refactor, create shared layout component)

### Gap 9: Dark-only theme
All pages use `bg-slate-950` hardcoded. There are no CSS custom properties or theme tokens.

**Effort:** Medium (1-2 weeks — see [theme-brand-system.md](./theme-brand-system.md))

### Gap 10: Brand assets not integrated
The TCC logos (`New Logo.png`, `Logo_Horizontal.png`) and Raleway fonts are not used anywhere in the app. The login page uses text-only branding.

**Effort:** Small (2-3 days — copy assets to `public/`, update layout + login page)

### Gap 11: SharePoint folder management
Current OneDrive integration only reads POC sheet cells and uploads billing exports. The target architecture creates and manages structured SharePoint folder hierarchies for every quote/estimate/project.

**Effort:** Medium (1-2 weeks — expand Graph API client)

---

## 5. What the Current Repo Gets Right

These are genuine strengths to build on, not throw away:

| Strength | Details |
|---------|---------|
| Billing calculation | Legacy formula exactly replicated, tested via build |
| TanStack billing table | Inline editing, sorting, filtering, color coding — production quality |
| Roll-forward | Mirrors legacy Module2, automated |
| PM email drafts | Graph API Outlook draft creation — no accidental sends |
| POC sheet sync | Graph API OneDrive cell read — replaces sync_poc.py |
| Excel export | ExcelJS with proper formatting, column structure matches legacy |
| Supabase RLS | All tables have RLS policies — security-first design |
| Auth architecture | Both SSO paths designed correctly |
| Power BI embed | Already wired, just needs workspace/report IDs |
| Type system | TypeScript types for all DB entities |
| Build quality | Clean production build, all routes dynamic where needed |

---

## 6. What the hvac-estimator Gets Right

These strengths from the live tool must be preserved during migration:

| Strength | Details |
|---------|---------|
| 445 assemblies | Comprehensive price book, manually curated, validated by tests |
| Cost model | 4-bucket (labor/material/overhead/profit), 25+ adjustment fields — battle-tested |
| Price snapshot | Prices locked at estimate creation — audit trail integrity |
| Rule-driven config | VAV/AHU/RTU/FCU/UH/DX/VRF config rules — complex, working, tested |
| Schematic diagrams | SVG flow + electrical diagrams per system type |
| DOCX proposal export | Template-based Word document generation |
| Tests | 13 test files covering assembly calc, cost model, FCU config, conduit fill |
| MSAL auth | Already configured and working |
| Architecture docs | ARCHITECTURE.md, DOMAIN_MODEL.md, PRODUCT_ROADMAP.md — detailed |

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Estimating migration breaks price book data | High | High | Port assemblyData.js as-is first, migrate to DB later |
| localStorage estimates lost during migration | High | High | Export-to-server migration utility before cutover |
| Azure AD app misconfigured | Medium | High | Test SSO in staging before production |
| Supabase RLS misconfiguration | Medium | High | Test each role with seeded users before launch |
| PM mobile experience is poor | Medium | Medium | Test weekly update form on actual phone before launch |
| SharePoint Graph API permissions | Medium | Medium | Request `Sites.ReadWrite.All` scope, test with real site |
| Power BI embed token refresh | Low | Medium | Use service principal for token generation |

---

## 8. Recommended Immediate Next Steps

In order of priority:

1. **Configure Supabase + Azure AD** (ops work — unblocks everything else)
2. **Run migration + seed data** (enables real testing)
3. **Integrate branding assets** (quick win — logos + font)
4. **Add persistent sidebar nav** (improves UX across all existing pages)
5. **Build quote request domain** (`/quotes` dashboard + intake form)
6. **Expand role model** (schema + middleware + UI filters)
7. **Begin estimating module migration** (phased, parallel to live site)
