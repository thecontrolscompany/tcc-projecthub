# HVAC Estimator to ProjectHub Workflow

## Current Workflow

1. Create the opportunity in OpportunityHub.
   - Use `OpportunityHub -> Pipeline -> New Opportunity`.
   - Required fields are account and project name.
   - New records start in the `estimating` stage so the next action is clear.

2. Estimate against the same opportunity.
   - Open the opportunity detail page.
   - Use `Estimate in HVAC Estimator`.
   - ProjectHub passes these URL parameters to the estimator:
     - `opportunityId`
     - `opportunityNumber`
     - `projectName`
     - `customer`

3. Build the estimate in HVAC Estimator.
   - The estimator remains the assembly-driven pricing engine.
   - Until full integration is complete, the estimator should use the opportunity number as the estimate number/reference.

4. Bring the estimate result back to OpportunityHub.
   - Update the opportunity estimated value, gross margin, and stage.
   - Attach the proposal and estimate workbook through the existing OpportunityHub document workflow where applicable.

5. Convert awarded work to ProjectHub.
   - On award, convert the opportunity/quote into a project.
   - Carry the estimate id into `projects.source_estimate_id`.
   - Use the existing estimator-to-POC endpoint later for schedule-of-values setup.

## What It Takes To Bring HVAC Estimator Into ProjectHub

The apps should converge around ProjectHub as the shell and CRM/project source of truth, with HVAC Estimator becoming the estimating module inside that architecture.

### 1. Shared Data Model

Add first-class opportunity linkage to estimates:

- `estimates.linked_opportunity_id -> crm_opportunities.id`
- Keep `estimates.linked_project_id -> projects.id` for awarded work.
- Keep full estimate payload in `estimates.body` so historical estimates remain reconstructable.
- Add generated columns or views for reporting fields such as project name, total, gross margin, estimator, archived status, and proposal status.

The existing `estimates` table already stores `id`, `owner_id`, `body`, `name`, `number`, `archived`, and `linked_project_id`, so this is an extension rather than a brand-new persistence layer.

### 2. Authentication And Shell

Move HVAC Estimator from standalone Vite routing into ProjectHub's Next.js shell:

- Use ProjectHub auth and roles.
- Expose estimating to `admin`, `ops_manager`, and selected estimator/PM roles.
- Preserve the estimator's internal/customer edition behavior as role-based actions instead of a separate app split.

### 3. Estimator UI Migration

Port the estimator React surfaces into `src/app/estimating` and `src/components/estimating`:

- Estimates list/detail
- Assembly picker
- System editors for VAV, AHU, RTU, DX, VRF, FCU, UH, Plant, and Network
- Price book
- Proposal and internal estimate exports

The estimator already has clean shared modules for estimate context, stores, assembly data, pricing, and exports. Those should be copied in as a bounded module first, then converted from localStorage/Supabase client-side writes to ProjectHub API routes.

### 4. API Boundary

ProjectHub should own the persistence API:

- `GET /api/estimates?opportunity_id=...`
- `POST /api/estimates`
- `PUT /api/estimates/[id]`
- `DELETE /api/estimates/[id]`
- `POST /api/estimates/[id]/proposal`
- `POST /api/estimates/[id]/internal-export`
- `POST /api/estimator/sync-poc`

HVAC Estimator should stop writing directly to Supabase from browser code once it lives inside ProjectHub.

### 5. Opportunity-Aware Estimate Creation

When launched from an opportunity, the estimator should:

- Read `opportunityId` from the route or query string.
- Fetch the opportunity and account from ProjectHub.
- Pre-fill estimate name, number, customer, bid due date, estimator, and notes.
- Save the estimate with `linked_opportunity_id`.
- Update the CRM opportunity totals when the estimate is marked ready or proposal is exported.

### 6. Award Handoff

When an opportunity is won:

- Convert it into a ProjectHub project.
- Copy the selected estimate id into `projects.source_estimate_id`.
- Copy final contract amount into project billing fields.
- Optionally call `/api/estimator/sync-poc` to seed POC line items from estimate assemblies.

## Suggested Phasing

### Phase 1: Link And Context Pass

- Add Estimator to OpportunityHub navigation.
- Add opportunity detail launch button.
- Add new opportunity flow.
- Teach HVAC Estimator to parse opportunity query params and prefill a new estimate.

### Phase 2: Shared Persistence

- Add `linked_opportunity_id` to `estimates`.
- Update HVAC Estimator Supabase store to save linked opportunity ids.
- Add ProjectHub estimate list/read views by opportunity.

### Phase 3: Embedded Module

- Move HVAC Estimator source into ProjectHub under an estimating module.
- Replace Vite app shell with ProjectHub AppShell.
- Keep estimator calculation modules intact.

### Phase 4: Full Handoff Automation

- Proposal export writes back to OpportunityHub.
- Final estimate updates opportunity totals.
- Award conversion carries estimate id into ProjectHub.
- POC setup can be seeded from the estimate.
