# Continuity — Integrate HVAC Estimator Workflow

## Current User Request

Commit and push the direct legacy HVAC Estimator UI port into ProjectHub, then answer whether saves can support undo or recovery points. Maintain this continuity document at the beginning and end of each prompt so progress is not lost if chat state breaks again.

## Starting State

- Working repo: `c:\Users\TimothyCollins\dev\tcc-projecthub`
- Related source repo: `c:\Users\TimothyCollins\dev\hvac-estimator`
- Migration direction: bring HVAC Estimator workflow into ProjectHub as `/estimating`.
- Known current ProjectHub migration pieces:
  - `src/modules/hvac-estimator/` contains copied estimating engine/data foundation.
  - `/estimating` list exists.
  - `/estimating/new` creates platform-native estimate shells.
  - `/api/estimates` and `/api/estimates/[id]` support estimate persistence.
  - Current turn added `/estimating/[id]` detail page and clickable list rows.

## Next Recovery Action

Search both repos for the phrase "Integrate HVAC Estimator workflow" and adjacent task records. Reconstruct the lost conversation from local files, git commits, and docs.

## Recovered Conversation Source

- Codex session index entry:
  - `C:\Users\TimothyCollins\.codex\session_index.jsonl`
  - Thread name: `Integrate HVAC Estimator workflow`
  - Session id: `019e07b4-3849-7481-9a29-3303fc4a62e7`
- Session transcript:
  - `C:\Users\TimothyCollins\.codex\sessions\2026\05\08\rollout-2026-05-08T08-08-31-019e07b4-3849-7481-9a29-3303fc4a62e7.jsonl`

## Recovered User Intent

Original request:

1. Add a link from OpportunityHub to HVAC Estimator.
2. Explain what it would take to bring HVAC Estimator into ProjectHub architecture.
3. Define a workflow where an opportunity is created first, then estimated in HVAC Estimator against the same opportunity.

Follow-up architectural direction:

- Since HVAC Estimator was not fully functional/in use yet, make the architectural changes now rather than preserve a standalone split.
- Long-term target is a deployable SaaS platform with tenant-selected modules.
- CRM and HVAC Estimator should be peer modules inside the platform, not one-off TCC-only features.

Chosen architecture:

`Organization -> Enabled Modules -> CRM Opportunity -> HVAC Estimate -> ProjectHub Project`

Seeded/defined modules:

- `platform`
- `crm`
- `hvac_estimator`
- `projecthub`
- `billing`
- `time`
- `documents`
- `analytics`

## Recovered Implementation History

### First Bridge

Implemented:

- Added `Estimator` to OpportunityHub subnav.
- Added `/crm/opportunities/new`.
- Added `Estimate in HVAC Estimator` action on opportunity detail.
- Initially passed these query params to standalone estimator:
  - `opportunityId`
  - `opportunityNumber`
  - `projectName`
  - `customer`
- Wrote `docs/hvac-estimator-projecthub-workflow.md`.

### SaaS/Module Foundation

Implemented:

- Added tenant/module schema:
  - `organizations`
  - `platform_modules`
  - `organization_modules`
  - `organization_memberships`
- Seeded platform modules including `crm` and `hvac_estimator`.
- Added organization ownership across core/platform records.
- Added tenant/module-aware estimate policies.
- Added ProjectHub-owned estimate API boundary:
  - `GET /api/estimates`
  - `POST /api/estimates`
  - `GET /api/estimates/[id]`
  - `PUT /api/estimates/[id]`
  - `DELETE /api/estimates/[id]`
- Added `docs/saas-module-platform-architecture.md`.
- Updated standalone `hvac-estimator` to read and carry platform launch context:
  - `organizationId`
  - `linkedOpportunityId`
  - opportunity/project/customer metadata

Committed and pushed:

- ProjectHub: `4df87aa` — `Add platform-native HVAC estimator module foundation`
- HVAC Estimator: `e18d129` — `Carry platform opportunity context into estimates`

### Platform-Native Estimator Roll-In Sprint

User asked to:

1. Create `src/modules/hvac-estimator/` in ProjectHub.
2. Move pure estimator logic first:
   - `estimateCalc`
   - `projectSettings`
   - `assemblyData`
   - price book helpers
3. Add adapter functions converting estimator JSON into platform `estimates` rows.
4. Build `/estimating` estimate list using `/api/estimates`.
5. Build `/estimating/new?opportunityId=...` to create first platform-native estimate.

Implemented:

- Copied estimator pure/data modules into `src/modules/hvac-estimator/`.
- Added `src/modules/hvac-estimator/platform-adapter.ts`.
- Rebuilt `/estimating` as API-backed estimate list.
- Added `/estimating/new`.
- Updated CRM opportunity detail so `Estimate in HVAC Estimator` launches platform-native `/estimating/new?opportunityId=...` instead of standalone app.

Validation:

- `npm run build` passed.

Committed and pushed:

- ProjectHub: `4df87aa` — `Add platform-native HVAC estimator module foundation`

### Estimate Creation Improvements

User asked:

- `Estimate / opportunity number` should auto-number unless manually overwritten.
- `Customer` should be dropdown from existing Accounts.
- Add new customer should use the same path as `New Account`.

Implemented:

- Auto-number defaults like `EST-2026-001`, still editable.
- Customer dropdown sourced from CRM Accounts.
- Added `/crm/accounts/new`.
- Added `Add new customer` link from estimate form with return path.
- New estimates store both customer account id and customer name.

Validation:

- Cleared stale `.next` cache.
- `npm run build` passed.

Committed and pushed:

- ProjectHub: `dc81209` — `Improve platform estimate creation flow`

### Organization Fallback Fix

User reported:

- `No organization selected.`

Implemented organization resolution order:

1. Explicit `organization_id`
2. Linked opportunity `organization_id`
3. User default organization RPC
4. User organization membership
5. Seeded `tcc` organization fallback

Validation:

- `npm run build` passed.

Committed and pushed:

- ProjectHub: `04f2576` — `Resolve estimate organization fallbacks`

## Current Turn Additions Before Recovery Request

The user said progress was lost and clarified this was the HVAC Estimator migration into ProjectHub.

This turn added a small continuation slice:

- `/estimating` list rows now link to `/estimating/[id]`.
- Added `/estimating/[id]` server page.
- Added `/estimating/[id]/estimate-detail-client.tsx`.
- Detail page shows:
  - estimate summary
  - linked opportunity
  - linked project placeholder
  - status
  - notes
  - item count
  - migration checkpoint for future editor port
- Status and notes save through existing `/api/estimates/[id]` `PUT`.

Validation:

- `npm run build` passed after a small `??`/`||` parser fix.

These current-turn additions are not committed yet.

## End-of-Prompt Continuity Update

Recovered the prior conversation successfully from local Codex session logs. The exact historical thread exists outside the repos under `.codex\sessions`. The migration work in git is not lost; it is represented by commits `4df87aa`, `e18d129`, `dc81209`, and `04f2576`.

Next recommended migration slice:

1. Commit the current `/estimating/[id]` detail-page continuation if desired.
2. Begin porting the actual estimator editing surfaces into ProjectHub:
   - `EstimateContext`
   - `estimateStore` replacement backed by `/api/estimates`
   - `EstimatePage` or a smaller ProjectHub-native editor shell
   - `AddEquipButtons`
   - `ProjectSettingsPanel`
   - one system editor first, likely VAV or RTU
3. Keep standalone `hvac-estimator` intact until `/estimating` can create, edit, price, and export a real estimate inside ProjectHub.

## End-of-Prompt Continuity Update — Current Status Answer

As of this prompt, migration status is:

- Architecture decision is made: HVAC Estimator is a tenant-enabled SaaS module inside the platform, peer to CRM and ProjectHub.
- ProjectHub has tenant/module schema and estimate API boundaries committed and pushed.
- ProjectHub has copied pure estimator logic/data under `src/modules/hvac-estimator/`.
- ProjectHub can list estimates at `/estimating`.
- ProjectHub can create platform-native estimate shells at `/estimating/new`, including opportunity context, auto-numbering, account dropdown, and organization fallback.
- Standalone `hvac-estimator` has compatibility metadata committed so estimates can carry platform context.
- Current uncommitted continuation adds `/estimating/[id]` detail view with status/notes save and a summary page, but not full equipment editing.
- Not yet migrated: live system editor UI, estimate context/store replacement, equipment add/edit workflow, assembly picker UI, price book admin UI, proposal/internal exports, opportunity summary writeback, award handoff automation.

## End-of-Prompt Continuity Update — Next Step Implemented

Implemented the next migration slice in ProjectHub:

- `/estimating` list rows now link into `/estimating/[id]`.
- Added `/estimating/[id]/page.tsx`.
- Rebuilt `/estimating/[id]/estimate-detail-client.tsx` into the first platform-native editable estimate workspace.
- The detail page now:
  - maintains the estimate body in React state
  - adds catalog-backed HVAC equipment line items from copied estimator data
  - supports equipment types: AHU, VAV, RTU, DX/HP, VRF, FCU, UH, Network
  - lets the user set tag, location, quantity, install type, and selected components
  - lets the user change line-item quantity
  - lets the user remove line items
  - recalculates material, labor, overhead, profit, bond, sell price, raw material, and raw labor hours using the migrated estimator cost model
  - saves the updated estimate body and summary columns through `PUT /api/estimates/[id]`
- Validation: `npm run build` passes.
- Existing warning only: Next middleware/proxy deprecation.

Current uncommitted files from this recovery/migration slice:

- `codex/continuity-integrate-hvac-estimator-workflow.md`
- `src/app/estimating/estimating-list-client.tsx`
- `src/app/estimating/[id]/page.tsx`
- `src/app/estimating/[id]/estimate-detail-client.tsx`

Remaining migration work:

- Replace the quick line-item editor with richer migrated system editors/diagrams.
- Add component quantity editing and existing-item component selection editing.
- Port project settings panel.
- Port price book UI.
- Port proposal/internal export actions.
- Add opportunity summary writeback and award handoff automation.

## End-of-Prompt Continuity Update — Next Phase Implemented

Continued the ProjectHub-native HVAC Estimator editor migration:

- Added core Project Settings controls directly inside `/estimating/[id]`:
  - wage rate
  - overhead %
  - profit %
  - bond %
  - default install type
  - vertical market
  - miles round trip
  - trips
  - site access
  - safety requirements
  - VAV field mount
  - fire seals
  - misc materials
  - supervision
- Added "Apply Default Install" action to update existing line items to the selected default install type.
- Added existing line-item component editing:
  - show/hide component editor per line item
  - toggle catalog components on/off
  - edit selected component quantity
  - change existing line item install type
- Cost summary recalculates live after settings, component, install type, and quantity changes.
- Save still writes the full estimate body and platform summary columns through `PUT /api/estimates/[id]`.
- Validation: `npm run build` passes.
- Existing warning only: Next middleware/proxy deprecation.

Current uncommitted files from the recovery/migration work remain:

- `codex/continuity-integrate-hvac-estimator-workflow.md`
- `src/app/estimating/estimating-list-client.tsx`
- `src/app/estimating/[id]/page.tsx`
- `src/app/estimating/[id]/estimate-detail-client.tsx`

Recommended next phase:

1. Port or recreate a richer system-specific editor for one equipment type, likely VAV or RTU.
2. Add default component selections from the estimator data helpers instead of requiring manual component selection.
3. Add price snapshot generation/refresh behavior to preserve historical estimates.
4. Then port proposal/internal export actions.

## End-of-Prompt Continuity Update — Supabase Migrations Applied

User asked to apply Supabase migrations because `No organization selected.` persisted.

Actions taken:

- Ran `supabase migration list`.
- Found remote missing:
  - `20260507000000_report_email_send_attempts`
  - `20260508000000_estimates_opportunity_architecture`
  - `20260508000001_platform_tenants_modules`
  - `20260508000002_estimates_tenant_module_policies`
- `supabase db push` was initially blocked by a stale remote migration history entry for `20260415`.
- Repaired that remote history entry:
  - `supabase migration repair --status reverted 20260415`
- Applied pending migrations:
  - `supabase db push --include-all`
- Verified remote now has the May 8 migrations applied.
- Verified via Supabase client/env that remote data now contains:
  - organization slug `tcc`
  - platform modules `crm`, `hvac_estimator`, `projecthub`
  - enabled organization modules for `tcc`: `crm`, `hvac_estimator`, `projecthub`

Note:

- `supabase migration list` still displays an odd April 15 history mismatch row, but the relevant May 8 tenant/module migrations are applied and data exists.
- If `No organization selected.` persists, likely causes are deployment not yet updated, app using a different Supabase project/env, or the authenticated user/session hitting a different environment than `.env.local`.

## End-of-Prompt Continuity Update — Old UI Alignment Phase

User wanted the migrated ProjectHub estimator UI aligned with the older standalone HVAC Estimator UI, because the old UI was further along.

Implemented first alignment slice:

- Copied old standalone UI support files into the ProjectHub HVAC Estimator module:
  - `src/modules/hvac-estimator/components/estimate/AddEquipButtons.jsx`
  - `src/modules/hvac-estimator/components/estimate/ProjectSettingsPanel.jsx`
  - `src/modules/hvac-estimator/shared/utils.js`
- Updated `/estimating/[id]/estimate-detail-client.tsx` to use:
  - old `AddEquipButtons` equipment button strip
  - old `ProjectSettingsPanel` for project settings/cost controls
- Kept ProjectHub API-backed persistence:
  - estimate body still lives in platform `estimates.body`
  - save still writes via `PUT /api/estimates/[id]`
  - cost calculations still use migrated estimator cost functions
- The add-equipment form remains the temporary platform-native editor, but is now launched from the old equipment button strip.
- The settings UI is now the old estimator settings panel, including mileage/geocode, labor/material/overhead settings, and the old visual style.
- Validation: `npm run build` passes.
- Existing warning only: Next middleware/proxy deprecation.

Current uncommitted files:

- `codex/continuity-integrate-hvac-estimator-workflow.md`
- `src/app/estimating/[id]/estimate-detail-client.tsx`
- `src/modules/hvac-estimator/components/estimate/AddEquipButtons.jsx`
- `src/modules/hvac-estimator/components/estimate/ProjectSettingsPanel.jsx`
- `src/modules/hvac-estimator/shared/utils.js`

Recommended next alignment slice:

1. Port old `EstimateDetail.jsx` table/header layout more directly, now that settings/buttons are copied.
2. Port old system-specific editor entry flow (`setSubPage`) into ProjectHub routing/state.
3. Port one full system editor first, likely RTU or VAV, including default selections and diagrams.
4. Then port assembly picker and export actions.

## End-of-Prompt Continuity Update — Default Selection Phase

Continued old UI/behavior alignment after commit `4ca5237`.

Implemented:

- ProjectHub add-equipment flow now uses migrated standalone estimator default-selection helpers instead of starting with no selected components.
- Added imports and wiring for:
  - AHU: `normalizeAhuCfg`, `getVisibleAhuComponents`, `applyAhuDefaultSelections`
  - VAV: `normalizeVavCfg`, `getVisibleVavComponents`, `applyVavDefaultSelections`
  - RTU: `normalizeRtuCfg`, `getVisibleRtuComponents`, `applyRtuDefaultSelections`
  - DX: `normalizeDxCfg`, `getVisibleDxComponents`, `applyDxDefaultSelections`
  - VRF: `normalizeVrfCfg`, `getVisibleVrfComponents`, `buildDefaultVrfSelected`
  - FCU: `normalizeFcuCfg`, `getVisibleFcuComponents`, `applyFcuDefaultSelections`
  - UH: `normalizeUhCfg`, `getVisibleUhComponents`, `applyUhDefaultSelections`
- The add form now stores:
  - `cfg`
  - selected components with per-component quantity
- Component list in the add form now uses visible components for the selected system config.
- New line items are created with default config and default selected components, closer to the old standalone estimator behavior.
- Add form component quantities are editable before adding the line item.
- Validation: `npm run build` passes.
- Existing warning only: Next middleware/proxy deprecation.

Current uncommitted files:

- `codex/continuity-integrate-hvac-estimator-workflow.md`
- `src/app/estimating/[id]/estimate-detail-client.tsx`

Recommended next phase:

1. Add compact system-specific config controls for RTU and VAV in the add/edit form.
2. Reconcile selected components when config changes, using the imported `reconcile*Selected` helpers.
3. Then port one old full system editor surface.

## End-of-Prompt Continuity Update — SVG Diagram Alignment Phase

User asked to keep going because the migrated UI still did not fully include the old SVG graphics.

Implemented this phase:

- Copied the old standalone estimator diagram layer into ProjectHub:
  - `src/modules/hvac-estimator/shared/UnitaryFlowDiagram.jsx`
  - `src/modules/hvac-estimator/shared/diagramUtils.jsx`
  - `src/modules/hvac-estimator/shared/diagramUtils.js`
  - `src/modules/hvac-estimator/shared/DiagramTooltip.jsx`
  - `src/modules/hvac-estimator/shared/useDiagramTooltip.js`
- Added the legacy draggable SVG flow diagram to `/estimating/[id]` for supported unitary system types:
  - RTU
  - DX/HP
  - VRF
  - UH
- The diagram now appears in the add-equipment editor and reflects/toggles selected components.
- The diagram also appears when editing existing line-item components and writes back through the platform-native estimate state.
- Added a local legacy theme token bridge so copied SVG/tooltip styling renders correctly inside ProjectHub without making the old estimator CSS global.
- Existing line-item component lists now use the system-specific visible component helpers rather than the raw component map, keeping editor behavior closer to the old estimator config model.

Validation:

- `npm run build` passes.
- Existing Next warning only: middleware/proxy deprecation.

Current changed files for this phase:

- `codex/continuity-integrate-hvac-estimator-workflow.md`
- `src/app/estimating/[id]/estimate-detail-client.tsx`
- `src/modules/hvac-estimator/shared/UnitaryFlowDiagram.jsx`
- `src/modules/hvac-estimator/shared/diagramUtils.jsx`
- `src/modules/hvac-estimator/shared/diagramUtils.js`
- `src/modules/hvac-estimator/shared/DiagramTooltip.jsx`
- `src/modules/hvac-estimator/shared/useDiagramTooltip.js`

Recommended next phase:

1. Port the old full system editor shell for one supported system, likely RTU first, so the diagram is paired with the richer legacy config controls.
2. Add AHU/VAV/FCU-specific visual editor coverage, since the copied `UnitaryFlowDiagram` only handles RTU, DX/HP, VRF, and UH.
3. Reconcile selected components when config options change, using the standalone estimator reconcile helpers.
4. After the editor surfaces align, port exports/proposals and opportunity writeback.

## End-of-Prompt Continuity Update — Commit/Push Requested

User asked to commit and push the SVG diagram alignment slice.

Commit scope prepared:

- Continuity document update.
- `/estimating/[id]` detail editor diagram integration.
- Copied legacy diagram rendering/tooltip utilities under `src/modules/hvac-estimator/shared/`.

Staged files:

- `codex/continuity-integrate-hvac-estimator-workflow.md`
- `src/app/estimating/[id]/estimate-detail-client.tsx`
- `src/modules/hvac-estimator/shared/DiagramTooltip.jsx`
- `src/modules/hvac-estimator/shared/UnitaryFlowDiagram.jsx`
- `src/modules/hvac-estimator/shared/diagramUtils.js`
- `src/modules/hvac-estimator/shared/diagramUtils.jsx`
- `src/modules/hvac-estimator/shared/useDiagramTooltip.js`

Validation before commit:

- `npm run build` passed before this commit/push request.
- Staged diff intentionally excludes the many unrelated untracked workspace files.

## End-of-Prompt Continuity Update — Architecture Clarification

User asked why the migration does not simply bring the old HVAC Estimator code and old tables directly into ProjectHub.

Clarification given:

- The old UI/code should largely be brought over, especially the mature estimating surfaces, SVG diagrams, system editors, pricing logic, settings panel, exports, and component helpers.
- The old storage model should not be copied blindly because standalone HVAC Estimator primarily used browser `localStorage` (`tcc_estimates`, price overrides, active estimate, starred items, user/theme/sidebar state) with an optional Supabase adapter pointed at a simple `estimates` table keyed by `owner_id`.
- ProjectHub already has a platform `estimates` table/API with organization tenancy, module enablement, linked CRM opportunities, linked projects, RLS policies, status, archive state, totals, and platform summary columns.
- The practical path is to copy/port old UI and estimator behavior, while adapting persistence to ProjectHub’s platform API/tables.
- If the user wants the fastest UI parity, the next phase should be a more direct port of the old estimator application shell/pages into `/estimating/[id]`, replacing the temporary platform-native editor UI, while keeping ProjectHub API persistence underneath.

No code commit was made for this explanation turn; the continuity document itself is modified and should be committed with the next implementation slice or a documentation commit.

## End-of-Prompt Continuity Update — Direct Legacy UI Port Phase

User said to proceed with the direct legacy UI/code port instead of continuing to hand-rebuild the old estimator UI in small pieces.

Implemented:

- Copied the old standalone estimator detail/table shell into ProjectHub:
  - `src/modules/hvac-estimator/components/estimate/EstimateDetail.jsx`
- Copied the old full system editor pages into ProjectHub:
  - AHU, VAV, RTU, DX/HP, VRF, FCU, UH schematic/editor pages.
- Copied old shared editor dependencies:
  - `UnitEditorPage.jsx`
  - `AddToEstimateBtn.jsx`
  - `SidebarLayout.jsx`
  - `SchematicTabs.jsx`
  - `AssemblyPickerModal.jsx`
  - `DiagramViewer.jsx`
  - `TemplateSvgDiagram.jsx`
  - `PointsList.jsx`
  - `assemblyPicker.js`
  - `conduitFill.js`
  - `useIsMobile.js`
  - `useSidebarWidth.js`
  - `currentUser.js`
- Copied old proposal/internal export generators.
- Added a ProjectHub-specific estimator context adapter:
  - `src/modules/hvac-estimator/shared/EstimateContext.jsx`
  - It mimics the old `useEstimate()` API for a single ProjectHub estimate.
  - It updates ProjectHub estimate body state instead of writing to localStorage.
  - It preserves old `addItem`, `updateItem`, `setSubPage`, `editingItem`, `applyDefaultInstallType`, and price snapshot behavior.
- Updated `/estimating/[id]` to render the old estimator workspace by default:
  - legacy header/table/details UI
  - old add-equipment buttons
  - old full schematic editors through `setSubPage`
  - slim ProjectHub save/status bar above the legacy estimator workspace
  - save still writes through `/api/estimates/[id]`

Validation:

- `npm run build` passes.
- Existing warning only: Next middleware/proxy deprecation.

Important current state:

- This direct port is not committed yet.
- The copied legacy UI now has much higher parity, but the user still needs to click the ProjectHub `Save` button after using old editor actions to persist changes to Supabase.
- Next cleanup should remove or retire the older temporary platform-native editor fallback code from `estimate-detail-client.tsx`, now that legacy UI is the preferred path.
- Next functional polish should test add/edit flows in browser and make save behavior autosave or clearly signal unsaved changes after old editor actions.

## End-of-Prompt Continuity Update — Direct Port Commit/Push

User asked to commit and push the direct legacy UI port, and asked whether saves can support undo or recovery points.

Commit/push scope:

- Direct legacy estimator detail UI port.
- Full old system editor pages for AHU, VAV, RTU, DX/HP, VRF, FCU, and UH.
- Old shared editor dependencies and export generators.
- ProjectHub `useEstimate()` adapter that keeps legacy editor behavior while updating ProjectHub estimate state.
- `/estimating/[id]` legacy workspace routing.
- Continuity document updates.

Validation before commit:

- `npm run build` passed after the direct UI port.

Recovery/undo answer to carry forward:

- Yes, saves can support undo/recovery points.
- Recommended design:
  1. Short-term client undo stack for unsaved edits in `/estimating/[id]`.
  2. Server-side `estimate_versions` or `estimate_snapshots` table for every explicit save/autosave checkpoint.
  3. UI actions: `Undo`, `Redo`, `Save checkpoint`, `Restore previous version`, and optional diff/preview.
  4. Store snapshot metadata: estimate id, organization id, user id, label, reason/autosave/manual, body jsonb, summary totals, created_at.
- Best next implementation is server-side snapshots around `PUT /api/estimates/[id]`, because it protects against browser crashes, bad saves, and accidental destructive edits.
