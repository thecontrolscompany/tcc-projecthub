# Task 129 - Continue EST-2026-090 (USA Health Providence Hospital Roof AHU Replacement, Siemens)

This is a bid-data task, not a feature. No app code changes are expected. Do NOT use Playwright.

## Where things stand (done in Claude Code, 10/22/2026)

- **Request:** James Page (Siemens Account Executive, james.page@siemens.com, 850-748-7801) emailed 10/20/2026. Siemens is assembling a design-build package and wants TCC for the low-voltage wiring scope. Budgetary pricing due to the engineer ~11/3/2026. A site walk is expected before final numbers. He did NOT ask for a price breakout.
- **Estimate:** `estimates.id = f6164f69-982d-489e-8e64-3c87f59ea649`, number `EST-2026-090`, status `draft`, customer "Siemens Industry, Inc." (CRM account `a572588b-3bd4-4416-a978-e2185ac09c58`).
  - Live app: https://internal.thecontrolscompany.com/estimating/f6164f69-982d-489e-8e64-3c87f59ea649
- **Pricing:** install-only (Siemens furnishes controllers, panels, devices, programming). 11 line items, 805.9 h, 41 trips, 130.2 mi round trip, Healthcare +15%, 100% retrofit, OH 15 / profit 30 / bond 4.
  - Total $101,588.50 = $97,682 base + $3,908 optional bond.
- **Proposal pricing rows** (`body.settings.proposalPricingRows`). They must sum to `ceil(total - bond)` within $1 or the proposal silently falls back to one price:
  1. Phase I - Chiller (East Tower) - $4,185 (ALLOWANCE: no chiller points list)
  2. Phase II - AHU-16 & AHU-18 (East Tower) - $21,667
  3. Phase III - AHU-17 (North Tower) - $12,127 (includes re-terminating EF-11/14A/14B)
  4. Phase IV - AHU-15 & AHU-19 (West Tower) - $21,667
  5. Phase V - AHU-20 (Core) - $12,357
  6. Project-Wide - Comm Trunk, Weekend Cutovers, Phasing & Coordination - $25,679
- **Proposal:** generated and saved to SharePoint as HTML: `Bids/EST-2026-090 - USA Health Providence Hospital Roof AHU Replacement/02 Estimate/HVAC_Control_Installation_Proposal_USA-Health-Providence-Hospital-Roof-AHU-Replacement_2026-10-23.html`. It has an `opportunity_documents` row (role `proposal_pdf`). Nothing has been sent to Siemens.
- **Source documents** are all in the bid folder:
  - `04 Drawings`: RTU Study PDF (TRO Jung|Brannen / MBA-Dell, 9/30/2026, USA Project No. 26-042) and the Apogee points list `Points Roof_Airhandlers_2026-10-16...Xlsx`.
  - `02 Estimate`: the original email `.msg`.
- **Local synced copy of the bid folder:** `C:\Users\TimothyCollins\The Controls Company, LLC\TCC Projects - Documents\Bids\EST-2026-090 - USA Health Providence Hospital Roof AHU Replacement\`

### Assumptions carried (also in the estimate notes; confirm at the site walk)
1. All devices are field-installed; none are factory-mounted on the new AHUs.
2. One new Siemens panel per AHU, mounted at the unit; 120V by Div 26.
3. Exterior rooftop raceway is GRS per the MEP narrative; a ~150 LF/AHU premium over EMT is carried.
4. The chiller is an allowance (60111 chiller assembly, BACnet trunk, P-15/P-16 S/S/S, CHWS/R wells).
5. The BLN trunk is an allowance: 1,200 LF cable plus 400 LF GRS.
6. EF-11 and EF-14A/B points (13) are re-terminated to the new AHU-17 panel.
7. 7 weekend cutovers at 12 h OT-equivalent each.
8. 80 h of phasing/remobilization (5 phases).
9. Excluded: 120V, VFDs, valve bodies, dampers, smoke detectors/FA, programming, crane.

## What to do now

1. **Verify state.** Run `npx supabase db query --linked` and confirm all three:
   - the estimate row matches the numbers above (status, `total_amount`, 11 items, `proposalPricingRows` sum = 97682);
   - the proposal document row exists;
   - the HTML proposal exists in the local synced `02 Estimate` folder.

   Report any mismatch and stop.
2. **Make a PDF of the proposal for emailing.** Run headless Edge on the local HTML:

   `msedge --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="<02 Estimate>\HVAC Control Installation Proposal - USA Health Providence Hospital - Siemens.pdf" "file:///<path to the .html>"`

   Write it to the same local `02 Estimate` folder so OneDrive syncs it. Open/inspect the PDF text (e.g. with pypdf) and confirm all of these:
   - six phase rows;
   - $97,682 subtotal and $101,589 total;
   - the "Budgetary Pricing Basis" section;
   - no browser chrome or "Print / Save as PDF" button text.

   If the button text prints, note it in the report; do not edit app code.
3. **Write a site-walk checklist** to `02 Estimate\Site Walk Checklist - EST-2026-090.md`. Turn each assumption above into a yes/no or quantity question to confirm with James Page/Siemens at the site walk. Add these:
   - panel locations (new electrical penthouses vs. on unit);
   - whether new AHUs ship with factory controls;
   - whether Siemens reuses the PXCC7011-7016 panels;
   - chiller points list and scope ownership;
   - BLN routing between towers;
   - roof access path, ICRA class and escort needs;
   - weekend shutdown windows;
   - whether Siemens wants the phase breakout or a single lump sum.
4. **Do NOT change the estimate, its status, or send anything.** Tim decides on status ("Proposal Exported") and on sending to Siemens.
5. **Commit and push.** Run `git add codex/task-129-providence-bid-continuation.md`, then `git commit`, then `git push`. This task file is the only repo change; the PDF and checklist live in SharePoint, not git.

## Procedure for later revisions (after the site walk; only when Tim asks)

- **Reference harness:** the build harness pattern is in Claude memory `reference_estimator_programmatic_build.md`.
  - Import `calcEstimate` (components/estimate/estimateCalc.js) and `computeCosts` (components/estimate/projectSettings.js) from `src/modules/hvac-estimator` via `file:///` URLs in Node. Results match the app to the cent.
  - Items are `type:"custom"`, `installType:"EMT"`, with `custom[]` entries:
    - assemblies: `{cat:"Assembly", emtAID, plnAID, qty}`;
    - custom lines: `{isCustom:true, unitMtl, unitLbr, qty}`.
- **Trips:** `trips = ceil(labor hrs / 20)`.
- **Re-tie the pricing rows** after any line-item change:
  1. Price each phase's items alone with `trips: 0`.
  2. Spread the remainder (mileage etc.) by labor hours.
  3. Make the last row absorb the rounding so the rows sum to `ceil(total - bond)`.
- **Persist the update:**
  - Snapshot `body` first.
  - Update `body` and `total_amount` with dollar-quoted jsonb via `npx supabase db query --linked -f file.sql`.
  - Use an `updated_at` guard.
- **Proposal boilerplate** (no overtime, weekend work excluded, exposed wiring in EMT) is hardcoded. Override it only with lines in `settings.customerScope`; the current scope already does this for weekend cutovers and GRS.
- **Re-generate the proposal from the app** (Outputs > Generate Proposal) only after Tim confirms his Microsoft session is fresh. A stale token makes the SharePoint save fail with "Microsoft access token not available".

## Report back

Report back with all of the following:
- the verification results;
- the PDF path and a 1-line content check;
- the checklist path;
- the commit hash.

## Execution record - October 28, 2026 (Codex)

- Initial read-only verification passed via `npx --offline --yes supabase db query --linked`: EST-2026-090 remains `draft`, total_amount `101588.50`, 11 items, and six proposalPricingRows totaling `97682`. Each stored phase amount matches the task above.
- Confirmed proposal document `ee4e813a-b2e3-4087-a129-9c5713f15c06`, role `proposal_pdf`, referencing the named 2026-10-23 HTML; confirmed that HTML exists locally. Checked the current `public/report-assets/proposal-template.html` before export.
- Exported the unchanged HTML with headless Microsoft Edge to `02 Estimate/HVAC Control Installation Proposal - USA Health Providence Hospital - Siemens.pdf`. Edge could not load the long synced file URL directly (ERR_FILE_NOT_FOUND); printed an identical temporary HTML copy, then copied the PDF to the required synced destination.
- Inspected text and all four rendered PDF pages. PASS: $97,682 base price, $101,589 total, Budgetary Pricing Basis, no browser chrome or Print / Save as PDF button text, no clipping/overlap. FAILED requested content check: six phase pricing rows are absent. The saved source HTML contains one `Price` row despite the six correct database rows, and its scope says pricing is broken out by phase. This PDF is an unchanged export and requires review before sending; no proposal HTML, app code, or estimate data was changed to repair the discrepancy.
- Wrote `02 Estimate/Site Walk Checklist - EST-2026-090.md` covering all carried assumptions and requested confirmations, with quantities and response/ownership fields.
- No estimate or status changes; nothing sent to Siemens. PDF and checklist remain in the locally synced bid folder, outside git. OneDrive server-side synchronization was not independently verified.
