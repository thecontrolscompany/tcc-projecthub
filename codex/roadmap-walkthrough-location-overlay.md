# Walkthrough Location Overlay

Status: **Idea / future** — captured for later, not scheduled. Builds on the shipped
Insta360 walkthroughs feature (`project_walkthroughs` table, customer portal Walkthroughs tab).

## Problem

Customers watching a 360° site walkthrough have no spatial context — they can't tell
*where* in the building the camera is. Tim shoots one video per area/floor (Level 1,
Level 2, Roof, Exterior, Area 3A, etc.), so each clip already corresponds to a location.
Goal: overlay the site plan with a position marker so the customer sees where the
walkthrough is happening.

## Hard constraint

Insta360's share player sends `Content-Security-Policy: frame-ancestors https://*.insta360.com`.
We cannot iframe it, overlay on it, or read its playback time. **Any overlay synced to
video playback is impossible while the video is hosted on Insta360.** This forks the feature
into two very different builds.

## Phase 1 — Static "you are here" (low effort, keeps Insta360 hosting)

Each walkthrough card shows a floor-plan thumbnail for that area with the area highlighted
or a marker dropped. No video sync — the marker is static per clip. Leverages the existing
per-area shooting workflow.

Scope:
- Source floor plans from the project's SharePoint PDFs (per level). Convert each level to
  an image (server-side PDF→PNG, or admin uploads an image).
- New data: a `project_floor_plans` table (project_id, level_label, image_url) and, on
  `project_walkthroughs`, optional `floor_plan_id` + `marker_x` / `marker_y` (normalized
  0–1 coordinates).
- Admin: in the Walkthroughs section, pick the plan for a video and click once to drop the
  marker.
- Customer: card renders the plan thumbnail with the marker; optionally a larger plan view
  above the week's card grid with all that week's markers.
- Reuses: existing `project_walkthroughs`, customer/data scoped fetch, WalkthroughCard.

Effort: days. Recommended first step; answers ~80% of "where am I looking?".

### Stitched per-floor plan bases (built 2026-07-27)

The floor-plan images to use as the marker/tracking base for Mobile Arena already exist —
built by stitching GMC's quadrant piping sheets into one plan per level. Each source PDF is
four sheets (Quad A/B/C/D) on the GMC template, laid out `D|A` over `C|B` with the arena bowl
as the center void. Assembly method: each sheet carries green dashed **match lines** at the
quadrant seams (detectable by color) — right quads' left seam at x≈281, left quads' right seam
at x≈2829, top quads' bottom seam at y≈2373, bottom quads' top seam at y≈284 (at native
3456×2592 render); crop each sheet to its own side of the seams, drop the title block (x≥3204),
tile, then strip the green seam cross and white out the duplicated "Mechanical Plan Notes"
blocks. Chosen over these sheets' bare architectural overlay because these **carry the
equipment labels and pipe callouts**, which the plain floor overlay lacks.

Output (single-page, ~200 dpi, equipment labels intact), in
`OneDrive - The Controls Company, LLC/Projects/Mobile Arena/test/`:
- `Catwalk Piping Plan - STITCHED.pdf`
- `Event Piping Plan - STITCHED.pdf`
- `Concourse Piping Plan - STITCHED.pdf`
- `Suite Piping Plan - STITCHED.pdf`

These are the plans to calibrate the ARKit tracking path against (2-point calibration maps the
track's meters onto the plan). Note the `test/` folder is a scratch/working location and gets
reorganized — promote these to a stable path before wiring them into `project_floor_plans`.

## Phase 2 — Moving dot synced to playback (high effort, re-hosts off Insta360)

The dot moves along a path on the plan as the video plays (see the interactive concept
mockup demoed in-session). Three required pieces:

1. **Self-hosted video.** Export each clip from Insta360 as MP4 and host it (Supabase
   storage / SharePoint / CDN). 360 clips are large (~2–8 GB for the 10–18 min videos);
   smooth streaming wants HLS transcoding. This reverses the "keep hosting on Insta360"
   decision and adds storage/bandwidth cost.
2. **Web 360 player.** Render the equirectangular video in WebGL (three.js / Panolens) to
   preserve look-around. Known pattern, real component to build/tune.
3. **Path authoring — the "I'm not a video editor" problem.** No indoor GPS and the camera
   records no floor position, so the path must come from Tim. Practical approach: a
   *click-along* tool — play the clip once, click on the plan wherever you are; each click
   is timestamped; the dot interpolates linearly between waypoints. ~10 clicks / ~2 min per
   video. Not editing, but a per-video step that never fully disappears.
   - Data: a `walkthrough_waypoints` table (walkthrough_id, t_seconds, x, y) or a JSONB
     column on `project_walkthroughs`. This same shape is what any *automatic* positioning
     source (below) would populate — click-along is just the manual fallback.

Effort: multi-week. Only pursue if Phase 1 proves insufficient.

## Positioning sources (how to feed the dot's path)

The moving dot needs a time→position track. Options, split by where they actually work.
All of them land in the same `walkthrough_waypoints` shape and sync the same way (see below).

**Outdoors — GPS works:**
- **Insta360 native GPS** — the GPS Action/Preview Remote (or the phone app) writes a GPS
  track directly into the `.insv` metadata, already time-aligned to the video. Cleanest for
  exterior clips. Drives a dot on a **site aerial / plot plan**, not a floor plan.
- **Dedicated GPS logger or phone GPX app** — records a timestamped track; aligned to the
  video afterward. Same outdoor-only limitation.
- Applies to our data: only the **Exterior** (and partially **Roof**) clips would benefit;
  interior clips get no usable fix.

**Indoors — GPS does NOT work (no satellite line-of-sight); use instead:**
- **SLAM / visual-inertial odometry from the 360 video itself** — reconstruct the walked
  path from the footage's visual features + the gyro/IMU already in the file. No extra
  hardware; uses data we already capture. Tools: OpenVSLAM (equirectangular support),
  COLMAP (structure-from-motion). Compute-heavy and finicky, but the most elegant automatic
  indoor answer. Best long-term bet.
- **ARKit phone walked alongside** — an iPhone Pro running a 6-DoF motion-tracking session
  logs an indoor path (visual + inertial, not GPS) that works inside. Carry it with the
  camera, log its pose, sync by time.
- **UWB beacons** (site anchors + a tag on the rig) — centimeter accuracy indoors, but
  per-building hardware setup. Overkill unless this becomes a major feature.
- Rejected: raw IMU/gyro dead-reckoning alone (no visual correction) drifts within seconds.

**Sync mechanism (common to all sources):** timestamp alignment. The video carries a precise
`creation_time` + 25 fps timing, so any time-stamped external track (GPX, ARKit pose log,
SLAM output) maps onto the waypoint-interpolation model directly. One shared marker (start
both together, or a clap) fixes the offset. This is the easy part; the hard part is always
*getting* an accurate indoor track.

Recommended future bet: GPS for exterior clips (cheap, real win), SLAM-from-video for
interior (no hardware), with manual click-along as the always-available fallback.

## Middle option (no re-hosting)

Draw the *full walked path* as a static polyline on the plan (from a one-time click-along),
plus chapter timestamps beside it ("0:00 stairwell, 3:00 mech room"). Shows the route taken
without a synced player or self-hosting. Cheaper than Phase 2, richer than Phase 1.

## Raw source footage (available for Phase 2)

Original camera files are retained in SharePoint, one folder per shoot:
`TCC Projects - Documents/video files/<Project> <M-D-YY>/` (locally synced under
`C:\Users\TimothyCollins\The Controls Company, LLC\TCC Projects - Documents\video files`).

- Format is Insta360 `.insv` (proprietary dual-fisheye) — **not web-playable**. Phase 2 must
  first export each clip to equirectangular MP4 via Insta360 Studio (multi-GB output).
- Files are named by capture time (`VID_YYYYMMDD_HHMMSS_..._NNN.insv`), not by area. Map each
  to its area/floor by matching duration against the `project_walkthroughs` rows (which carry
  the scraped duration).
- Large: e.g. `Mobile Arena 7-21-26` is ~25 GB across 8 clips. Budget storage/bandwidth
  accordingly when self-hosting.

### Metadata findings (probed 2026-07-21)

`.insv` is an MP4 container. Parsing (no exiftool/ffprobe on the box — used a Python box
parser) found:

- Standard MP4 fields: per-file `creation_time` and duration, two 1920×1920 fisheye video
  tracks at 25 fps (≈5.7K stitched), Ambarella chipset (`AMBAxV4`).
- A top-level `inst` box (up to ~42 MB) holding Insta360's timed telemetry: **gyro/IMU +
  exposure**. This is orientation data (drives stabilization), **not position**. No GPS
  present (indoor). IMU cannot yield floor position — integrating it drifts within seconds.
- Implication for Phase 2: the moving-dot **path must still be authored manually**
  (click-along). Telemetry can supply camera heading/orientation for free, but not location.
- Files split by capture time, not area, but duration maps cleanly 1:1 to the shared clips.

File → area map for the `Mobile Arena 7-21-26` shoot (raw runs a few seconds longer than the
trimmed share):

| Raw file (…_NNN.insv) | Duration | Walkthrough |
|---|---|---|
| 027 | 8:50 | Exterior |
| 028 | 2:32 | Exterior up to Roof |
| 029 | 11:01 | Roof Level |
| 030 | 10:18 | Area 3C/3B |
| 031 | 9:19 | Area 3A |
| 032 | 17:09 | Level 2 |
| 033 | 18:27 | Level 1 |
| 026 | 0:03 | test blip — ignore |

## Recommendation

Ship Phase 1 if/when this becomes a priority; treat Phase 2 as a separate decision gated on
willingness to re-host and to do the per-video click-along.

## Phase 2 chosen path — hybrid self-hosted PSV player (PoC built 2026-07-27)

Decision: **hybrid**. Keep most clips on Insta360 (free hosting, plain cards). Selectively
**convert** high-value clips to a self-hosted equirectangular MP4 played in
**Photo Sphere Viewer (PSV)** with a **live minimap dot** synced to playback. This resolves the
Insta360 CSP blocker (we own the player, so we can read `currentTime`) while preserving interactive
360 look-around — strictly better than pre-rendering the dot into a flat video.

### PoC status — all working, verified locally in Chrome
Authoring + viewer tools live in OneDrive `Projects/Mobile Arena/Walkthrough Tracking/`:
- `clickalong.html` — pan/zoom plan; drop timed waypoints two ways: real-time stopwatch, or type the
  paused video's timecode (m:ss) then click. Exports `<area>_waypoints.json` (`{area, image_name,
  points:[{t,x,y}], ...}`). Also renders a standalone pulsing-dot MP4 (WebCodecs+mp4-muxer, or the
  `render_dot.py` / `Make dot video.bat` fallback) for Insta360 clips that can't sync.
- `psv-walkthrough-viewer.html` — PSV (three.js + video adapter + video plugin, CDN) with a
  draggable/zoomable minimap; dot follows `videoPlugin.getTime()`. **Auto-loads** from
  `?data=<jsonUrl>&embed=1` (JSON may carry `video_url`/`plan_url`/`points`); `embed=1` hides the
  authoring toolbar. Verified with the real Mobile Arena exterior clip (VID_027, 8:44) + its
  Exterior waypoints on the stitched Event plan.
- Stitched per-floor plans (Catwalk/Event/Concourse/Suite) are the minimap bases — see the
  "Stitched per-floor plan bases" section above.

### Portal integration — `codex/task-127-psv-hybrid-walkthroughs.md`
Adds `player_type` ('insta360'|'psv'), `video_url`, `plan_url`, `waypoints jsonb` to
`project_walkthroughs`; admin UI to create a psv row; a `/api/walkthroughs/[id]/data` endpoint that
feeds the viewer; and a customer card that opens `/psv-walkthrough-viewer.html?data=…&embed=1` (the
viewer is already copied to `public/`). Customer uploads nothing.

- **Hosting:** Cloudflare R2 (no egress fees) for the MP4 + plan image; R2 CORS required because the
  cross-origin video becomes a WebGL texture. Export from Insta360 Studio as **H.264** (not H.265 —
  browsers can't decode HEVC in `<video>`).
- **Cross-origin verification (2026-07-27):** PSV v5's video adapter creates the video element with
  `crossOrigin = "anonymous"` whenever viewer `withCredentials` is false. The deployed viewer sets
  that option explicitly and also loads the R2 plan image anonymously. ProjectHub currently sends
  no Content-Security-Policy header, so no app CSP allowlist change is needed; R2's CORS and range
  response headers remain mandatory.
- **Cost model:** convert only select clips, so storage/bandwidth stays bounded; everything else
  keeps Insta360's free hosting.
