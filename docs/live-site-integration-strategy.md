# TCC — Live Site Integration Strategy

**Date:** 2026-03-30
**Subject:** How hvac-estimator (`internal.thecontrolscompany.com`) should relate to tcc-projecthub (this repo)

---

## 1. The Core Question

Should we:

**(A) Merge** — move hvac-estimator's code into this Next.js repo and run one unified build
**(B) Monorepo** — keep both as packages in a shared workspace
**(C) Staged parallel** — keep both live independently, gradually migrate estimating logic into this repo, deprecate hvac-estimator when ready

---

## 2. Recommendation: Option C — Staged Parallel Operation

**Rationale:**

The hvac-estimator is production software with real users (estimators). It has:
- 445-assembly price book that took significant time to build and validate
- Complex HVAC rule engine tested across 13 test files
- A working MSAL auth flow
- Live deployments via GitHub Actions
- Users who depend on it today

The tcc-projecthub is not yet connected to a database and has no real users. It cannot replace the estimating tool until the Estimating domain module is complete — and that migration is weeks of work at minimum.

**Immediate and wrong approaches to avoid:**
- Do not attempt to merge the repos immediately. The tech stacks are different (Vite SPA vs Next.js App Router) and the integration complexity is high.
- Do not redirect `internal.thecontrolscompany.com` away from hvac-estimator until the Next.js estimating module is validated.
- Do not start converting hvac-estimator's JS to TS while it is still the production tool — that creates unnecessary risk.

---

## 3. Phased Integration Plan

### Phase 0 — Current State (Now)
```
internal.thecontrolscompany.com  →  hvac-estimator (Vite SPA, localStorage, HostMonster)
tcc-projecthub (localhost:3000)  →  Next.js app, Supabase, not yet live
```

**Both exist independently. No integration yet.**

---

### Phase 1 — Connect the Backend (this repo priority)
**Duration:** 2-4 weeks
**Prerequisite for everything else.**

1. Configure Supabase project, run migration, seed data
2. Configure Azure AD app registration
3. Test full auth flow (Microsoft SSO for admin/PM, email/pw for customers)
4. Import existing projects from legacy Excel tracker
5. Deploy tcc-projecthub to Vercel at a staging URL (e.g., `hub.thecontrolscompany.com`)
6. Internal testing with Timothy as admin

**hvac-estimator:** Unchanged. Continues live at `internal.thecontrolscompany.com`.

---

### Phase 2 — Quote Request Domain (this repo)
**Duration:** 2-3 weeks

Build the `/quotes` domain in tcc-projecthub:
- Quote intake form
- Internal triage dashboard
- Status management
- SharePoint folder creation
- Customer quote submission via `/customer/quotes`

At end of Phase 2, the PM/billing/customer/quotes side of the platform is operational. Estimating remains on hvac-estimator.

**hvac-estimator:** Unchanged.

---

### Phase 3 — Shared Estimate Persistence (bridge phase)
**Duration:** 2-3 weeks

Add server-side estimate persistence to hvac-estimator **without moving it**:

1. Add a thin Supabase client to hvac-estimator (`@supabase/supabase-js`)
2. Replace localStorage writes with Supabase writes for the estimates table
3. Read estimates from Supabase on load
4. The estimate schema in Supabase (`estimates`, `estimate_items`, `estimate_cost_settings`) is already defined in domain-schema-plan.md — use it
5. Estimators now see each other's estimates; data survives browser clearing
6. Keep MSAL auth in hvac-estimator — same Azure AD tenant, same user tokens

**Why this is the right bridge:**
- Zero disruption to the estimating UX (same Vite SPA, same interface)
- Data moves from localStorage → Supabase (persistence fix is high-value on its own)
- Unblocks Phase 4 (the Next.js app can now read estimate records)
- No code merge required yet

**hvac-estimator:** Gets Supabase client added. Still deployed at `internal.thecontrolscompany.com`.

---

### Phase 4 — Estimate → Quote → Project Linking (this repo)
**Duration:** 2-3 weeks

Now that estimates are in Supabase:
1. Build `/estimating/[id]` read-only detail page in tcc-projecthub (shows estimate summary for admin/billing)
2. Build "Convert to Quote Request" and "Award Project" actions in tcc-projecthub
3. Admin can award a project from the tcc-projecthub interface, triggering job number generation, SharePoint folder creation, PM notification
4. The estimating UI remains in hvac-estimator; the lifecycle management (awarding, converting) is in tcc-projecthub

---

### Phase 5 — Estimating Module Migration (long-term)
**Duration:** 6-10 weeks

Migrate the estimating interface itself into tcc-projecthub:

1. Port the price book (`assemblyData.js`) to a static data module in this repo
2. Port the cost settings model (`projectSettings.js`) to `src/lib/estimating/costModel.ts`
3. Port the HVAC rule engine (`vavData.js`, `ahuData.js`, etc.) to `src/lib/estimating/systems/`
4. Build new React components for system editors (can adapt UnitEditorPage.jsx pattern)
5. Port the SVG diagrams to `public/diagrams/` (they are already SVGs, no change needed)
6. Port the DOCX proposal export to use the server-side API route
7. Port the conduit fill calculator to `/tools/conduit-fill`
8. Build pricebook editor page in tcc-projecthub
9. Test against the 13-test suite (port tests to Vitest in the new repo)

**When Phase 5 is complete:**
- tcc-projecthub can do everything hvac-estimator does, plus all the PM/billing/quotes/projects work
- hvac-estimator can be retired
- `internal.thecontrolscompany.com` points to tcc-projecthub on Vercel (DNS change)
- HostMonster is no longer needed for this application

---

## 4. Deployment and URL Strategy

### During Parallel Operation (Phases 0-4)
```
internal.thecontrolscompany.com    →  hvac-estimator (HostMonster, unchanged)
hub.thecontrolscompany.com         →  tcc-projecthub (Vercel)
portal.thecontrolscompany.com      →  customer portal (tcc-projecthub, subdomain or route)
```

### After Full Migration (Phase 5 complete)
```
internal.thecontrolscompany.com    →  tcc-projecthub (Vercel) — HostMonster DNS updated
portal.thecontrolscompany.com      →  customer routes on tcc-projecthub
hvac-estimator                     →  archived (kept in git, not deployed)
```

DNS is managed by HostMonster. Vercel generates a stable deployment URL. The cutover is a single DNS A/CNAME record change with no downtime (Vercel provisions SSL automatically).

---

## 5. Technical Compatibility Notes

| Concern | hvac-estimator | tcc-projecthub | Compatibility |
|---------|---------------|----------------|--------------|
| Auth | MSAL (`@azure/msal-browser`) | Supabase OAuth (Azure AD) | Same Azure AD tenant, same users. During bridge phase, both apps share the same user identity. |
| Auth tokens | MSAL ID token | Supabase session + provider token | Supabase issues its own JWT wrapping the Azure AD identity. The user is the same person. |
| Data format | localStorage JSON | Supabase PostgreSQL | Phase 3 bridge writes to Supabase. localStorage becomes a cache or is removed. |
| Build system | Vite | Next.js | No conflict. Separate repos, separate builds, separate deployments during parallel phase. |
| TypeScript | None (pure JS) | Full TypeScript | During migration, new TS types defined in tcc-projecthub match hvac-estimator data shapes. |
| Price book | `assemblyData.js` (3932 lines) | Supabase `price_book_overrides` | assemblyData.js is the master; overrides are user customizations. Port as-is first. |
| Tests | Vitest (13 files) | Jest/Vitest | Port test files alongside the logic they test. |

---

## 6. What NOT To Do

- **Do not create a monorepo.** The build tooling difference (Vite vs Next.js) creates more complexity than value at this stage. Keep them as separate repos.
- **Do not rewrite the estimating engine from scratch.** It is working, tested, and complex. Port it incrementally.
- **Do not convert hvac-estimator to TypeScript before migration.** That adds risk without shortening the timeline.
- **Do not shut down the live site prematurely.** Estimators need it. Keep it live until Phase 5 is validated.
- **Do not try to iframe the estimating tool inside tcc-projecthub.** That creates UX and auth nightmares. Either migrate it or keep it separate.

---

## 7. Decision Criteria for Moving to Phase 5

Begin Phase 5 (full estimating migration) when:
- [ ] Phases 1-4 are complete and stable
- [ ] tcc-projecthub is live on `hub.thecontrolscompany.com` with real users
- [ ] Quote requests, project lifecycle, and billing are in daily use
- [ ] Supabase estimate records are the source of truth (Phase 3 complete)
- [ ] At least one full estimating cycle (quote → estimate → project award) has completed in the new system
- [ ] Timothy is comfortable with the new platform as primary tool
