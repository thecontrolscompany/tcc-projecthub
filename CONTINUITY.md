# TCC ProjectHub — Continuity Document

> Last updated: 2026-05-12 · HEAD: b6776d4

This document is written for the next Claude session. Read it alongside `CLAUDE.md` (project overview) and `ROADMAP.md` (feature backlog).

---

## What Was Built in This Session

### OpportunityHub — Add Contact (account detail page)
`ContactEditModal` now supports **create mode** in addition to edit mode. When no `contact.id` is present it POSTs to `POST /api/crm/contacts` instead of PUT. A **+ Add Contact** button was added to the Contacts tab on the account detail page. The new contact is appended to local state on success without a page reload.

### CRM Contact Import from Email (Python scripts)
Three standalone Python scripts were built and used — they live outside the repo at `C:\Users\TimothyCollins\`:

| Script | Purpose |
|---|---|
| `export_email_contacts.py` | Authenticates via Microsoft device-code flow, scans Outlook inbox + sent items, merges with address book, writes `email_contacts_YYYY-MM-DD.xlsx` |
| `crm_import_preview.py` | Reads cleaned Excel, normalizes names, resolves company names via Clearbit API + `DOMAIN_OVERRIDES`, fuzzy-matches against existing CRM accounts (rapidfuzz, token_sort + token_set — NO partial_ratio), cross-clusters new companies, writes color-coded `crm_import_preview.xlsx` |
| `crm_import_commit.py` | Reads approved preview spreadsheet, creates missing accounts (type=other, status=prospect), creates contacts with confidence=needs_verification, dry-run mode via `--dry-run` flag |

**Result:** 351 contacts + 33 new accounts imported. All contacts are tagged `needs_verification` and `influence_level=unknown`.

**Key lesson:** `rapidfuzz.partial_ratio` produces false positives on short strings (e.g. "JCI" scores 67 against "RQ Construction"). Never use `partial_ratio` for company name matching — use `token_sort_ratio` + `token_set_ratio` only.

### Account Types — Multi-Select + New Types
- Added `electrical_contractor` and `tab_commissioning` to `CrmAccountType`
- `crm_accounts.type` (text) kept for backward compat; `crm_accounts.types` (text[]) added for multi-select
- Account type selector changed from `<select>` to pill toggle buttons in both New and Edit account forms
- `fmtAccountTypes(account)` helper in `src/lib/crm/utils.ts` renders all types joined with " / "
- `CRM_ACCOUNT_TYPE_OPTIONS` exported from utils — used in forms and the accounts list filter
- Accounts list gained a **Type** filter dropdown that matches against `types[]` (falls back to `type` for legacy records)
- **Migration run:** `20260511000002_crm_account_types.sql`

### Shareable Contact Directory Export
- `POST /api/crm/exports` — snapshots all active contacts + accounts into `crm_shared_exports` with a 16-char random token, 7-day expiry
- `GET /share/[token]` — public page (no auth), branded with TCC template (`#017a6f` teal, logo + SDVOSB badge, Arial font)
- Desktop: 4-column table. Mobile (<640px): contact cards with stacked layout
- **Download HTML** button on the public page generates a self-contained HTML file (logos reference live URLs, vanilla JS filter/sort embedded)
- **Share Directory** button on the Contacts list page generates link + shows inline copy button
- `/share` added to public paths in middleware — no login required
- **Migration run:** `20260511000003_crm_shared_exports.sql`

---

## Current Database State

### Migrations Applied (remote)
All numbered migrations (001–052) plus:
- `20260415120000`, `20260415130000`, `20260415140000`
- `20260425000000`, `20260426000000`, `20260426000001`
- `20260503000000`, `20260507000000`
- `20260508000000`, `20260508000001`, `20260508000002`
- `20260511000000` (org_branding), `20260511000002` (crm_account_types), `20260511000003` (crm_shared_exports)

### CRM Data
- **6 pre-existing accounts** before this session (Engineered Cooling Services, Siemens, ST Controls, Trane, Johnson Controls, RQ Construction)
- **33 new accounts** created from email import
- **~368 total contacts** (17 pre-existing + 351 imported)
- All imported contacts: `confidence_level=needs_verification`, `influence_level=unknown`, `role_type=unknown`

---

## Known Issues / Tech Debt

| Area | Issue | Priority |
|---|---|---|
| CRM API routes | `CRM_WRITE_ROLES = ["admin", "ops_manager"]` duplicated across ~5 route files — should be centralized in `src/lib/crm/permissions.ts` | Low |
| Tenant middleware | `resolveOrgFromRequest()` hits the database on every request — no caching. Fine for current traffic. | Low |
| Supabase CLI migrations | Local migration history is slightly out of sync with remote (orphaned `20260415` entry). Use the Supabase SQL editor directly for DDL rather than `supabase db push` until this is cleaned up. | Medium |
| Share page view counter | `void supabase.update()` is fire-and-forget — may drop on fast serverless cold starts. Acceptable for a non-critical counter. | Low |

---

## Credentials & Config

All in `.env.local` (not committed):
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_AZURE_CLIENT_ID` / `NEXT_PUBLIC_AZURE_TENANT_ID` / `AZURE_CLIENT_SECRET`
- `MICROSOFT_GRAPH_CLIENT_ID` / `MICROSOFT_GRAPH_CLIENT_SECRET` / `MICROSOFT_GRAPH_TENANT_ID`

Azure AD app registration: **TCC ProjectHub** (`0777b14d-29c4-4186-8d8e-4a8f43de6589`)
- Permissions granted: Contacts.Read, Mail.ReadWrite, Files.ReadWrite, Sites.ReadWrite.All, User.Read, User.ReadBasic.All, offline_access, email
- "Allow public client flows" enabled (needed for device-code auth in Python scripts)

Supabase project ref: `vzjjkssngkoedikbggbb`
SQL editor: `https://supabase.com/dashboard/project/vzjjkssngkoedikbggbb/editor`

---

## Key File Map (additions this session)

```
src/
├── app/
│   ├── api/crm/exports/route.ts        # POST — generate share link snapshot
│   ├── share/[token]/
│   │   ├── page.tsx                    # Public directory page (no auth)
│   │   └── directory-view.tsx          # Client component: filter/sort/download
│   └── crm/
│       ├── accounts/page.tsx           # Added 'types' to select query
│       ├── accounts/accounts-list.tsx  # Added type filter dropdown
│       ├── accounts/new/               # Multi-select type pills
│       └── accounts/[id]/edit/         # Multi-select type pills
├── components/crm/
│   └── contact-edit-modal.tsx          # Now supports create mode (no id)
├── lib/
│   ├── crm/utils.ts                    # Added fmtAccountTypes, CRM_ACCOUNT_TYPE_OPTIONS
│   └── tenant/
│       ├── context.ts                  # resolveOrgFromRequest, ORG_HEADERS
│       └── server.ts                   # Server-side org helper
supabase/migrations/
├── 20260511000002_crm_account_types.sql
└── 20260511000003_crm_shared_exports.sql
```

---

## Next Logical Steps

1. **Enrich imported contacts** — as you interact with people, update their `role_type`, `confidence_level`, and `influence_level` from `needs_verification` / `unknown` to confirmed values
2. **Tag account types** — most of the 33 new accounts are `type=other`; edit them to set the correct type(s) using the new pill selector
3. **QBO Integration** — highest priority per roadmap; full spec in `codex/roadmap-qbo-integration.md`
4. **Budget vs Actual** — depends on timesheets (done) and BOM (done); spec in roadmap
5. **Clean up Supabase migration history** — orphaned `20260415` entry; run `supabase migration repair` carefully or just accept SQL-editor-first workflow for DDL
