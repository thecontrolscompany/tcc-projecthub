# Mobile Arena Riser Reconciliation

Purpose: reconcile the existing CP-based Visio file with the customer-issued revised riser PDF so the Visio can be updated without constant page flipping.

Source files:
- `project updates/Mobile Arena Riser Diagram.vsdx`
- `project updates/New Riser Diagram.pdf`

Working assumption:
- The Visio is the older CP-centered redraw.
- The PDF is the newer customer revision.
- The best update path is to keep the Visio as one page per CP, then revise page contents and off-page references to match the PDF.

## Big-picture notes

- The revised PDF is organized by floor and area, not purely by control panel.
- The Visio is already organized mostly one page per CP, which is a better long-term format for maintenance.
- Do not try to mimic every long jump line from the PDF in Visio. Use off-page connectors and reference notes instead.
- The customer revision appears to swap the old `CP-3` and `CP-6` identities:
  - Revised PDF shows `CP-6` as the CT page.
  - Revised PDF shows `CP-3` as the AHU-7 page.
- `CP-14` exists in the revised PDF but does not currently have its own dedicated Visio page.

## Global cleanup items first

1. Update the Visio cover sheet CP schedule to match the revised PDF.
2. Rename or rebuild the current `CP-3` and `CP-6` pages to match the revised customer numbering.
3. Add a dedicated `CP-14` page, or explicitly decide that `CP-14` stays embedded under `CP-10.2`.
4. Add off-page connector labels instead of long bus lines across areas and floors.

## CP-by-CP crosswalk

## Cover

Current Visio state:
- Cover schedule lists older panel assignments, including `CP-3 = CT` and `CP-6 = AHU-7`.

Revised PDF state:
- `CP-6` is the CT page.
- `CP-3` is the AHU-7 page.
- `CP-14 ELE RM-1` appears in the revised PDF.

Action:
- Update the cover sheet only after the page-level corrections are done, so the cover reflects the final revised structure.

---

## CP-1 HWS

Visio page:
- `CP-1 HWS`

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 2`, First Floor Area D, left side

What still matches:
- `HWP-1-VFD`
- `HWP-2-VFD`
- `HWP-3-VFD`
- `HWP-4-VFD`
- `MASTER BOILER`
- `BSF-1`
- `BTU-1 METER`
- Area remains `1-D`, Pump Room

Likely update notes:
- This page looks structurally stable and is one of the least risky pages.
- Confirm the exact room label formatting against the PDF, but this page is mostly a carry-forward.

Recommendation:
- Treat `CP-1` as a low-priority cleanup page. Use it as the visual standard for page formatting after the revised template is settled.

---

## CP-2 CHWS

Visio page:
- `CP-2 CHWS`

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 1`, First Floor Area D, left side and lower-left branch

What still matches:
- `CHWP-1-VFD`
- `CHWP-2-VFD`
- `CHWP-3-VFD`
- `CHWP-4-VFD`
- `CWP-1`
- `CWP-2`
- `CWP-3`
- `CWP-4`
- `CH-1 PANEL`
- `CH-2 PANEL`
- `CH-3 PANEL`
- `RMS`
- `BTU-2 METER`
- Branch FCUs in the lower portion of the first-floor chiller network

Likely update notes:
- The revised PDF still treats this as a first-floor Area D / chiller branch page.
- The device grouping appears largely consistent, but downstream FCU placement should be checked one by one against the revised locations shown on PDF page 1.
- This page is a good candidate for a simple location and branch-order refresh rather than a full redraw.

Recommendation:
- Keep this as one CP page.
- Update branch order and location text from PDF page 1.
- Add any off-page references only if the revised branch now hands off to another area.

---

## CP-3 AHU-7

Current Visio page:
- Page title says `CP-3 AHU-7`
- Internal content still reflects the revised PDF concept for `AHU-7`

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 4`, top-left cluster

What still matches:
- `AHU-7 SF-VFD`
- `AHU-7 RF-VFD`
- Second-floor FCU branch under this panel
- This page still represents the AHU-7 branch that feeds multiple second-floor FCUs

Likely update notes:
- In the old Visio/XML extraction this page still shows internal `CP-6` text, which is a revision artifact.
- The revised PDF clearly uses `CP-3` for this AHU-7 network.
- This page should be treated as a renumbered panel page, not as a bad branch.
- Device set appears to include:
  - `FCU 2.10`
  - `FCU 2.11`
  - `FCU 2.12`
  - `FCU 2.13`
  - `FCU 2.14`
  - `FCU 2.15`
  - `FCU 2.16`
  - `FCU 2.17`
  - `FCU 2.18`
  - `FCU 2.19`
  - plus the connected `FCU 2.1` through `FCU 2.9` branch content already in your Visio

Action:
- Rename all visible panel references on this page to `CP-3`.
- Keep the page as the AHU-7 sheet.
- Add off-page references to adjacent second-floor area branches instead of trying to trace the long red path from the PDF.

---

## CP-4 AHU-5

Visio page:
- `CP-4 AHU-5`

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 6`, upper-left and lower-left/lower-right rooftop groups

What still matches:
- `AHU-5 SF-VFD`
- `KEF-5`
- `PF-1 VFD`
- `PF-2 VFD`
- `SEF-1-VFD`
- `SEF-2-VFD`
- `SEF-3-VFD`
- Factory controller references for related AHU rooftop equipment

Likely update notes:
- This page now spans rooftop content shown across multiple floor-area boxes in the PDF.
- The revised PDF presentation makes the route look longer than it needs to be in Visio.
- Keep this as one CP page and use off-page references if you want to show where the branch continues by floor area.

Recommendation:
- Do not redraw this like the PDF floor boxes.
- Keep the CP page centered on rooftop devices and annotate the revised floor-area references in notes.

---

## CP-5 AHU-6

Visio page:
- `CP-5 AHU-6`

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 6`, upper-right and lower-middle/lower-right rooftop groups

What still matches:
- `AHU-6 SF-VFD`
- `PF-3 VFD`
- `PF-4 VFD`
- `SEF-4-VFD`
- `SEF-5-VFD`
- `SEF-6-VFD`
- `SEF-7-VFD`
- Factory controller references for related AHU rooftop equipment

Likely update notes:
- Same pattern as `CP-4`: the revised PDF splits this by floor area, but it is still cleaner as one CP page in Visio.
- Check the rooftop equipment grouping against the latest branch continuity, but the page concept is still valid.

Recommendation:
- Keep as one CP page and convert PDF jump lines into off-page or note references.

---

## CP-6 CT

Current Visio page:
- Page title says `CP-6 CT`
- Internal content still carries `CP-3` text in places

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 1`, top-center cluster in First Floor Area D

What still matches:
- `CT-1-VFD`
- `CT-2-VFD`
- `CT-3-VFD`
- `FM-1`
- `FM-2`
- Water-entry association for this branch

Likely update notes:
- This is the inverse of the `CP-3` issue.
- The revised PDF clearly uses `CP-6` as the CT page.
- The branch itself looks basically right; the numbering and title block references need cleanup.

Action:
- Rename all visible panel references on this page to `CP-6`.
- Keep this as the CT page.
- Verify whether the revised PDF still shows `NS-3` on the owner-network side and update that note if needed.

---

## CP-7 AHU-8

Visio page:
- `CP-7 AHU-8`

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 4`, top-right cluster

What still matches:
- `AHU-8 SF-VFD`
- `AHU-8 RF-VFD`
- Water-entry tie shown in the revised PDF

Likely update notes:
- This page looks very light in the current Visio.
- That is not necessarily wrong; the revised PDF also shows this as a short branch.
- This is another low-risk page after the numbering cleanup.

Recommendation:
- Keep as-is structurally, then update labels and notes to match the revised PDF wording.

---

## CP-8 AHU-9

Visio page:
- `CP-8 AHU-9`

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 5`, upper-middle branch feeding third-floor/roof-adjacent areas

What still matches:
- `AHU-9 SF-VFD`
- `SEF-12-VFD`
- `SEF-13-VFD`
- `SEF-14-VFD`
- `SEF-15-VFD`
- `KEF-6`

Likely update notes:
- The revised PDF shows this branch as part of a larger inter-area handoff.
- Current Visio note already includes `To: Area 3-A`, which is the right idea.
- This page is a good example of how to handle the revised drawing: one CP page plus clear handoff notes.

Recommendation:
- Keep the CP page.
- Expand the off-page references so the handoff to the third-floor area is unambiguous.

---

## CP-9 AHU-10 (1 of 2)

Visio page:
- `CP-9 AHU-10 (1 of 2)`

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 1`, First Floor Area A, plus `NETWORK RISER DIAGRAM PAGE 2` continuation

What still matches:
- `AHU-10`
- Large first-floor Area A VAV/FCU population
- Ballroom/admin/market/service corridor branch concept

Likely update notes:
- This page is still the right idea, but the revised PDF splits the area across two PDF sheets.
- Your Visio page already groups a large portion of the first-half branch correctly:
  - ballroom VAVs
  - market and kitchen FCUs
  - service corridor VAVs
  - grand hall vestibule and related FCUs
- Expect room text and branch ordering updates, not a total rebuild.

Action:
- Reconcile room names and order against PDF pages 1 and 2.
- Keep this as part 1 of the `CP-9` page pair.
- Add a clearer handoff note to `CP-9.2`.

---

## CP-9 AHU-10 (2 of 2)

Visio page:
- `CP-9 AHU-10 (2 of 2)`

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 1`, First Floor Area A, plus `NETWORK RISER DIAGRAM PAGE 3` edge conditions toward Area B/C

What still matches:
- `AHU-10`
- Admin-office and support-space VAV group
- Several first-floor FCUs and EVAV/VAV branches

Likely update notes:
- This page contains the admin-office side of the `CP-9` network.
- The revised PDF likely changed some area boundaries more than the actual branch ownership.
- Keep the page as a CP page even if some devices appear in different area boxes in the customer PDF.

Action:
- Update room labels from the revised PDF.
- Add explicit note if some downstream devices now cross into an adjacent customer-defined area.

---

## CP-10 AHU-11 (1 of 2)

Visio page:
- `CP-10 AHU-11 (1 of 2)`

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 3`, right side, First Floor Area B

What still matches:
- `AHU-11`
- Home-team/staff-entry side VAV and EVAV population
- Locker, lounge, treatment, staff-entry, and corridor branch content

Likely update notes:
- This page is still the correct home for the first half of the Area B branch.
- The revised PDF is denser than the old Visio here, so expect location moves and branch-order cleanup.
- The presence of `To: Area 1-C` in the extracted text is useful and should stay as an off-page reference rather than a long drawn line.

Action:
- Update room names and sequence to match PDF page 3.
- Keep as `1 of 2`.
- Use a connector note to the `CP-10.2` page and to any `CP-14` dependency.

---

## CP-10 AHU-11 (2 of 2)

Visio page:
- `CP-10 AHU-11 (2 of 2)`

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 3`, right side and adjacent overlap with the `CP-14` area

What still matches:
- Visitor locker and support-space side of the `CP-10` network
- Multiple `VAV 8-x` and `FCU 1.x` branches

Likely update notes:
- This page currently contains `CP-14 ELE RM-1` content mixed into the `CP-10.2` branch.
- That might be acceptable temporarily, but it is the biggest source of confusion on the first-floor sheets.

Action options:
- Preferred: create a dedicated `CP-14` page and move the `CP-14 ELE RM-1` subtree there.
- Acceptable fallback: keep `CP-14` embedded here, but add a clear boxed note saying `CP-14 subtree shown on CP-10.2 pending breakout`.

Recommendation:
- If you are trying to reduce future confusion, this is worth splitting now.

---

## CP-11 AHU-12

Visio page:
- `CP-11 AHU-12`

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 4`, upper-left cluster

What still matches:
- `AHU-12 SF-VFD`
- `KEF-1`
- `KEF-2`
- `KEF-3`
- Exterior roof / Area `2-D` branch identity

Likely update notes:
- This page appears stable.
- The revised PDF still presents this as a compact rooftop-related branch.

Recommendation:
- Low-priority cleanup page after the numbering and `CP-14` work.

---

## CP-12 AHU-13 (1 of 2)

Visio page:
- `CP-12 AHU-13 (1 of 2)`

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 5`, upper-center and upper-right, plus third-floor Area D handoff

What still matches:
- `AHU-13`
- `KEF-4`
- `KEF-7`
- `KEF-8`
- `SEF-8-VFD`
- `SEF-9-VFD`
- `SEF-10-VFD`
- `SEF-11-VFD`
- Start of the larger third-floor FCU branch

Likely update notes:
- This page is a mix of rooftop devices and third-floor suite FCUs.
- The revised PDF breaks this across area boxes, but it still belongs together electrically as one CP page.
- The existing `To: Area 1-C`, `To: Area 1-B`, and `To: Area 3-A` style notes show where the branch references started to drift.

Action:
- Keep the one-CP structure.
- Replace area notes with clearer off-page reference labels tied to page names or branch names.

---

## CP-12 AHU-13 (2 of 2)

Visio page:
- `CP-12 AHU-13 (2 of 2)`

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 5`, lower third-floor branches

What still matches:
- Broad third-floor FCU population
- Suite, corridor, pantry, storage, and TR branches

Likely update notes:
- This is one of the pages most likely to have location drift because the revised PDF re-boxes the third-floor areas.
- The CP page is still valid. The pain here is mostly location text and which area box each branch visually belongs to in the customer PDF.

Recommendation:
- Do not rebuild from scratch.
- Use the revised PDF only to relabel rooms and reorder branch groupings where needed.
- Preserve the CP-based branching logic already built in Visio.

---

## CP-13 MISC

Visio page:
- `CP-13 MISC`

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 2`, right side, First Floor Area D

What still matches:
- `WH-1`
- `WH-2`
- `WH-3`
- `WH-4`
- `WH-5`
- `WH-6`
- `BP-1`
- Trash room / Area `1-D` identity

Likely update notes:
- This page appears stable and compact.
- Like `CP-1` and `CP-11`, it should be a low-effort update unless the customer changed exact locations or note wording.

Recommendation:
- Use this as another low-risk cleanup page.

---

## CP-14 ELE RM-1

Current Visio state:
- No standalone page found
- `CP-14 ELE RM-1` content appears inside the `CP-10.2` page content

Revised PDF reference:
- `NETWORK RISER DIAGRAM PAGE 3`, left side, First Floor Area C

Likely device group:
- `CP-14 ELE RM-1`
- Related `FCU 1.4`, `FCU 1.5`, `FCU 1.8`, `FCU 1.10`, `FCU 1.11`, `FCU 1.12`, `FCU 1.13`, `FCU 1.14`
- Associated `VAV 8-x` branch content shown around the Area C / emergency electrical / main electrical rooms

Recommendation:
- Add a dedicated `CP-14` page if you want the Visio to remain understandable after the revision.
- If time is tight, leave the subtree in `CP-10.2` for now but mark it clearly as a `CP-14` branch pending page breakout.

## Suggested work order

If you want the fastest path with the least rework, update in this order:

1. `CP-3` and `CP-6` renumber/title cleanup
2. `CP-14` breakout decision
3. `CP-10.1` and `CP-10.2`
4. `CP-9.1` and `CP-9.2`
5. `CP-12.1` and `CP-12.2`
6. `CP-2`
7. `CP-4` and `CP-5`
8. `CP-8`
9. `CP-1`, `CP-7`, `CP-11`, `CP-13`
10. Cover sheet last

## Practical Visio rule set

When updating pages, use this standard:

- One CP root per page
- One local `MS/TP Trunk-1` per page
- No long decorative jump lines copied from the PDF
- Off-page connector labels for cross-area continuity
- If a branch crosses floor-area boxes in the revised PDF, keep it on the same CP page and annotate the revised area names instead of splitting the page

That preserves the cleaner logic you already built while still honoring the customer revision.
