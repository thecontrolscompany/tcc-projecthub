# Roadmap — Offline Access and Background Sync

## Core concept

Field staff (installers, PMs) frequently work on sites — particularly secured military
installations like KAFB, Eglin, and Hurlburt Field — where network access is restricted,
intermittent, or completely unavailable. The app should degrade gracefully: load from a
local cache when offline, queue writes locally, and sync automatically when connectivity
returns.

---

## Who this affects

| Role | On-site need |
|------|-------------|
| **Installer** | View assigned projects and latest status; no write access needed currently |
| **PM** | Draft weekly updates, log materials/receipts, view BOM; needs write-back |
| **Ops Manager** | Read-only review of project status while on-site |

---

## Phase 1 — Read-only offline shell (PWA / Service Worker)

Convert the app to a **Progressive Web App** so the last-loaded pages survive a network
drop. No additional write-back logic — just stale reads are available.

**What gets cached:**
- Project list and detail pages (PM and installer views)
- BOM / materials list for assigned projects
- Latest weekly update per project
- Team contacts and job numbers

**Tech:**
- `next-pwa` or manual Workbox integration with Next.js App Router
- Cache-first strategy for static assets; stale-while-revalidate for project data
- Install-to-home-screen manifest so field staff can launch like a native app

**Out of scope for Phase 1:**
- Any write operations
- Admin or customer portal pages (low field value)
- Real-time sync or push notifications

---

## Phase 2 — Offline write queue (key field workflows)

Queue writes locally when offline; flush automatically on reconnect.

**Workflows in scope:**
1. **Weekly update drafting** — save draft locally; upload when signal returns
2. **Material receipt logging** — queue `material_receipts` inserts
3. **Time entry** — queue time log entries from the installer/PM portal

**Tech approach:**
- IndexedDB queue (via `idb` or `localforage`) for pending mutations
- Background Sync API (`navigator.serviceWorker.sync`) — fires when connectivity resumes
- Conflict resolution: last-write-wins for drafts; append-only for receipts and time entries
- Sync status indicator in the app shell: "3 items pending sync" / "Synced just now"

**Data model additions needed:**
- `offline_queue` client-only (IndexedDB) — no server schema change for Phase 2
- `synced_at` timestamps on `weekly_updates`, `material_receipts`, `time_entries` — already present or trivial to add

---

## Phase 3 — Selective pre-fetch and push

When the user is back on a good connection, pre-fetch data they'll likely need on the next
site visit.

**What gets pre-fetched:**
- All projects assigned to the logged-in PM or installer
- Current BOM for each active project
- Last 4 weekly updates per project (for context when drafting)
- Contact list and job numbers for all active projects

**Push notifications (optional, Phase 3+):**
- Web Push for "your sync completed" or "admin replied to your weekly update"
- Requires a VAPID key pair and subscription storage in Supabase

---

## UI/UX notes

- **Offline banner** — a slim bar when the app detects it is offline: `You're offline — changes will sync when reconnected`
- **Pending badge** — count of queued writes shown in the nav or header
- **"Available offline" toggle** — admin can mark specific projects as priority for pre-fetch
- **Graceful 404 fallback** — if a page wasn't cached, show a friendly "Not available offline" screen instead of a browser error

---

## What NOT to build

- Full two-way Supabase Realtime sync (overkill; Realtime requires a persistent socket)
- Admin billing table offline (admin always works from a connected desktop)
- Customer portal offline (low value)
- Offline photo capture (photos are large; Phase 3+ only if demanded)

---

## Dependencies

- **Time Tracking** — offline time entry queue integrates with the timesheets workflow

---

## Priority: Medium
## Suggested phasing: Phase 1 alongside or just after Scheduling/Crew Calendar; Phase 2 after Budget vs Actual and QBO land
## Suggested task prefix: 060–062
