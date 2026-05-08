# SaaS Module Platform Architecture

## Product Direction

The long-term product is a deployable SaaS platform, not a single hard-coded TCC portal.

Each customer gets an organization tenant. Each tenant can enable the modules they need:

- Platform Shell
- CRM
- HVAC Estimator
- ProjectHub
- BillingHub
- TimeHub
- Documents
- Analytics

The TCC deployment is the first tenant and reference implementation, but the data model should not assume that every record belongs to The Controls Company.

## Core Model

### Organization

`organizations` is the tenant boundary.

Every operational record should belong to one organization:

- customers
- projects
- estimates
- opportunities
- quote requests
- pursuits
- billing periods
- weekly updates
- CRM accounts, contacts, activities, and tasks

### Modules

`platform_modules` is the module catalog.

`organization_modules` controls which modules are enabled for each tenant. This is the SaaS packaging layer.

Examples:

- A customer can buy only CRM.
- A customer can buy CRM + HVAC Estimator.
- A customer can buy HVAC Estimator + ProjectHub without BillingHub.
- TCC can run the full suite.

### Memberships

`organization_memberships` connects users to tenants.

This allows:

- one user to belong to multiple customer tenants
- tenant-level roles such as owner/admin/manager/member/customer
- module-level roles stored in `module_roles`
- future tenant switching in the shell

## Module Boundaries

Modules should be peers, not nested applications.

CRM does not own HVAC Estimator. HVAC Estimator does not own ProjectHub. The platform shell owns:

- authentication
- tenant selection
- module enablement
- navigation
- shared design system
- common API patterns

Modules own their domain workflows.

## CRM + HVAC Estimator Workflow

CRM and HVAC Estimator are separate modules connected by shared identifiers:

1. CRM creates an opportunity.
2. HVAC Estimator creates one or more estimates linked to that opportunity.
3. CRM reads estimate totals/status for pipeline tracking.
4. When awarded, ProjectHub creates a project from the chosen estimate.
5. BillingHub and ProjectHub use the awarded estimate as the baseline.

The important identifier chain is:

`crm_opportunities.id -> estimates.linked_opportunity_id -> projects.source_estimate_id`

## Estimate Records

The estimate body remains JSON so HVAC Estimator can preserve its full assembly and price snapshot model.

Structured columns exist for cross-module workflows:

- `organization_id`
- `owner_id`
- `linked_opportunity_id`
- `linked_project_id`
- `status`
- `total_amount`
- `gross_margin_amount`
- `gross_margin_pct`
- `proposal_exported_at`
- `estimate_ready_at`

This lets CRM, ProjectHub, BillingHub, and Analytics use estimate summaries without understanding every HVAC assembly detail.

## API Boundary

Modules should persist through platform-owned API routes.

For HVAC Estimator:

- `GET /api/estimates`
- `POST /api/estimates`
- `GET /api/estimates/[id]`
- `PUT /api/estimates/[id]`
- `DELETE /api/estimates/[id]`

The standalone estimator can temporarily continue local/Supabase storage, but the long-term contract is the ProjectHub platform API.

## Tenant Rules

Every route and API should eventually resolve:

1. current user
2. selected organization
3. enabled module
4. role within organization/module
5. record access within that organization

No module should query global data without an organization boundary.

## Deployment Model

The same codebase can support multiple SaaS deployments:

- single shared multi-tenant deployment
- separate deployments per customer
- white-labeled deployments using organization settings

The database model supports the shared multi-tenant path first, while still allowing isolated deployments later.

## Migration Priority

Because HVAC Estimator is not fully in use yet, make these architectural changes now:

1. Store organization and linked opportunity metadata on estimates.
2. Move persistence behind platform APIs.
3. Keep estimator calculation and assembly logic modular.
4. Avoid hard-coded TCC-only assumptions in new estimator/CRM code.
5. Treat ProjectHub as the platform shell, not as the owner of every module's domain logic.
