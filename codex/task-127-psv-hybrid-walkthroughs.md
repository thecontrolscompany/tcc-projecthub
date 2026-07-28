# Task 127 — Hybrid self-hosted 360 walkthroughs with live position dot (Photo Sphere Viewer)

## Goal
Add an opt-in **second walkthrough mode** alongside the existing Insta360 cards: a **self-hosted
equirectangular MP4** played in **Photo Sphere Viewer (PSV)** with a **live floor-plan minimap dot**
that tracks playback, driven by click-along waypoints. This is a *hybrid* — existing Insta360 rows
are untouched; individual walkthroughs can opt into `player_type = 'psv'`. The customer uploads
nothing: clicking the card auto-loads the video + plan + position track.

## Background / what already exists
- Table `project_walkthroughs` (see `supabase/migrations/20260721000000_project_walkthroughs.sql`)
  stores Insta360 share links. Customer cards open the Insta360 player in a new tab.
- The deployed viewer is already in the repo: **`public/psv-walkthrough-viewer.html`**. It auto-loads
  from URL params — `?data=<jsonUrl>&embed=1` (embed hides the authoring toolbar). The `data` JSON
  may carry `video_url`, `plan_url`, `area`, and `points`. Video-vs-image is auto-detected by
  extension. It renders PSV (three.js + PSV core + equirectangular-video-adapter + video-plugin from
  cdn.jsdelivr.net) plus a draggable/zoomable minimap with a pulsing dot synced to `videoPlugin.getTime()`.
- Authoring tools (not part of this task, live in OneDrive `Mobile Arena/Walkthrough Tracking/`):
  `clickalong.html` produces the waypoints JSON (`{ area, image_name, points:[{t,x,y}], ... }`);
  the 360 MP4 is exported from Insta360 Studio (**H.264**, equirectangular).
- Design + PoC notes: `codex/roadmap-walkthrough-location-overlay.md`.

## Hosting (manual prerequisites — do before wiring real data, NOT code)
Video is large (~1.5 GB/clip) and needs range requests + CORS for WebGL.
1. **Cloudflare R2** bucket (no egress fees). Upload the exported MP4 and the plan image per clip.
2. R2 **CORS policy** must allow `GET` from the app origin (and `Range`), e.g. allowed origins =
   the production domain (+ localhost for dev), allowed methods `GET,HEAD`, expose `Content-Length,
   Content-Range,Accept-Ranges`. Cross-origin video → WebGL texture **requires** these headers.
3. Note the resulting public (or signed) URLs — they become `video_url` / `plan_url` on the row.
4. Apply this task's migration to the remote DB (migrations do **not** auto-apply — use
   `npx supabase db query --linked` or the Supabase SQL editor).

## Data model — new migration `supabase/migrations/<timestamp>_walkthrough_psv_player.sql`
```sql
ALTER TABLE project_walkthroughs
  ADD COLUMN player_type text NOT NULL DEFAULT 'insta360'
    CHECK (player_type IN ('insta360','psv')),
  ADD COLUMN video_url text,
  ADD COLUMN plan_url  text,
  ADD COLUMN waypoints jsonb;

-- Insta360 rows need share_url; psv rows don't. Relax NOT NULL and enforce per-mode in the app.
ALTER TABLE project_walkthroughs ALTER COLUMN share_url DROP NOT NULL;
```
RLS is unchanged — existing admin/ops/customer policies already cover the new columns.

## Types — `src/types/database.ts`
Extend `ProjectWalkthrough`:
```ts
player_type: "insta360" | "psv";
video_url: string | null;
plan_url: string | null;
waypoints: WalkthroughWaypoint[] | null;   // add: export type WalkthroughWaypoint = { t: number; x: number; y: number };
```

## Admin API — `src/app/api/admin/project-walkthroughs/route.ts`
- **POST**: accept optional `playerType`, `videoUrl`, `planUrl`, `waypoints`, `title`, `area`.
  - `playerType === 'psv'`: require `videoUrl` and a non-empty `waypoints` array; `planUrl` strongly
    recommended. **Skip** the Insta360 `isInsta360ShareUrl` check and `scrapeShareMeta`. Insert with
    `player_type:'psv'`, `video_url`, `plan_url`, `waypoints`, `title` (fallback to `area` or "360 Walkthrough"),
    `recorded_date` (provided or today), `share_url: null`.
  - Default / `'insta360'`: unchanged behavior (validate share URL, scrape meta).
- **GET**: already `select("*")` — returns new columns; fine.
- **DELETE**: unchanged.

## Admin UI — `src/components/project-modal/walkthroughs-section.tsx`
- Add a small mode toggle: **"Insta360 link"** (default, current UI) vs **"Self-hosted 360 + position"**.
- PSV mode inputs: **Video URL** (R2 mp4), **Plan image URL** (R2), **Waypoints** (file picker that
  reads a click-along `.json` and extracts `points` + `area` + `image_name`; show "N points loaded"),
  optional **Title** and **Recorded date**. POST with `playerType:'psv'`.
- In the "walkthroughs on file" list, show a badge (e.g. "360 + position") for `player_type==='psv'`
  rows and keep the existing cover/title/date row.

## Customer data route — `src/app/api/customer/data/route.ts`
- Add `player_type, video_url` to the `project_walkthroughs` select (keep `share_url` for insta360).
  Do **not** send `waypoints` here (large) — those come from the data endpoint below.

## New data endpoint — `src/app/api/walkthroughs/[id]/data/route.ts` (GET)
- Use the cookie-based server client (`@/lib/supabase/server`) so **RLS** enforces access (customers
  only read walkthroughs for their accessible projects; admin/ops read all).
- Load the row by `id`. If missing or `player_type !== 'psv'` → 404.
- Respond with the exact shape the viewer expects:
  ```json
  { "area": <title>, "video_url": <video_url>, "plan_url": <plan_url>, "points": <waypoints ?? []>, "time_offset_sec": 0 }
  ```
- `Cache-Control: private, max-age=300`.

## Customer component — `src/app/customer/page.tsx`
- Extend `CustomerWalkthrough` with `player_type: "insta360" | "psv"` and `video_url: string | null`.
- In `WalkthroughCard`: for `player_type === 'psv'`, the card `href` is
  `` `/psv-walkthrough-viewer.html?data=${encodeURIComponent(`/api/walkthroughs/${w.id}/data`)}&embed=1` ``
  (open in a new tab, `target="_blank" rel="noopener"`), with a distinct badge like
  **"360° + live position"**. When `cover_image_url` is null (typical for psv), use the branded 360°
  fallback tile (already implemented). Insta360 rows keep `share_url` behavior unchanged.

## CSP / CORS verification (do not skip)
- Check for a Content-Security-Policy header (search `next.config`, middleware, `headers()`).
  If one exists, it must allow the viewer to reach the CDN and R2:
  `script-src`/`style-src` + `https://cdn.jsdelivr.net`; `img-src` + R2 host; `media-src` + R2 host;
  `connect-src` + R2 host + self (the data endpoint). If **no** CSP header is set, nothing to change.
- The 360 video is drawn into a **WebGL** texture cross-origin → R2 CORS (above) is mandatory, and the
  video element must be requested with `crossorigin="anonymous"`. Verify PSV's
  `EquirectangularVideoAdapter` sets crossOrigin (it does by default via three's video texture path);
  if a same-origin/tainted-canvas or WebGL security error appears, pass the adapter/viewer the
  appropriate `withCredentials:false` / crossorigin option. Document the finding.

## Out of scope
- Building the click-along / export authoring tools (they live in OneDrive and are done).
- Automating R2 upload (manual for now).
- Migrating existing Insta360 clips (they stay as-is).

## Verification (no Playwright)
- `npm run build` and `npm run lint` pass.
- With one real converted clip hosted on R2 and a `psv` row created via the admin UI: the customer
  Walkthroughs tab shows the "360° + live position" card; opening it auto-loads the PSV player with
  the video and the moving dot, no manual upload. (Claude will drive this check via claude-in-chrome
  after Codex finishes; leave a note of what to verify.)

## Roadmap
Move **Walkthrough location overlay** from Planned → Completed (Phase 2 delivered as the hybrid PSV
path) once deployed. Spec detail stays in `codex/roadmap-walkthrough-location-overlay.md`.
