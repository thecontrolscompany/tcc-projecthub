# Task 034 Output

## Completed Tasks

### Task 1 - Project Contacts on Customer Portal
- Added `phone` to the `PmDirectory` TypeScript interface in [src/types/database.ts](c:/Users/TimothyCollins/dev/tcc-projecthub/src/types/database.ts).
- Extended the admin Contacts tab in [src/app/admin/page.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/admin/page.tsx) so contacts can store and edit phone numbers.
- Added a `Your Project Team` section to [src/app/customer/page.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/customer/page.tsx) that shows assigned PM/lead contacts with role badge, email, and phone.
- Added site address and general contractor to the customer project header.

### Task 2 - Weekly Update Print / PDF Export
- Added the print-friendly report route at [src/app/reports/weekly-update/[id]/page.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/reports/weekly-update/[id]/page.tsx) with branded HTML output and print CSS.
- Added screen-only back/print controls in [src/app/reports/weekly-update/[id]/PrintButton.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/reports/weekly-update/[id]/PrintButton.tsx).
- Added reusable report links in [src/components/view-report-link.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/view-report-link.tsx).
- Added `View Report` links from the PM portal, customer portal, admin project modal, and ops-shared modal surfaces.

### Task 3 - Admin Weekly Updates View
- Added a `Weekly Updates` tab to [src/app/admin/page.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/admin/page.tsx).
- Built a filterable table for the latest 200 updates with project search, blockers-only toggle, PM/customer info, and report links.

### Task 4 - PM Portal Last Update Preload
- Updated [src/app/pm/page.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/pm/page.tsx) so the most recent weekly update preloads:
  - text fields as placeholders
  - crew log `men` counts as carried-forward values
  - hours and activities left blank

### Task 5 - Installer Portal Stub Replacement
- Rebuilt [src/app/installer/page.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/installer/page.tsx) into a real installer dashboard.
- Added assigned project cards with customer, site address, job number, latest `% complete`, and SharePoint link.

### Task 6 - Public Project Status Page
- Added unauthenticated public status route at [src/app/status/[job_number]/page.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/status/[job_number]/page.tsx).
- Updated [src/lib/supabase/middleware.ts](c:/Users/TimothyCollins/dev/tcc-projecthub/src/lib/supabase/middleware.ts) to allow `/status`.
- Added a copyable public status link to the customer portal project header in [src/app/customer/page.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/customer/page.tsx).

### Task 7 - Cleanup and Polish
- Standardized all report links on the shared `ViewReportLink` component.
- Added loading skeletons to PM and customer portal loading states.
- Replaced the customer empty state with a branded centered contact CTA.
- Added a shared React error boundary in [src/components/error-boundary.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/error-boundary.tsx) and wrapped PM/customer main content.

### Task 8 - Final Verification
- Final `npm run build` completed successfully.
- All Task 034 commits were pushed to `origin/main` after each numbered task.

## Files Modified

- [src/types/database.ts](c:/Users/TimothyCollins/dev/tcc-projecthub/src/types/database.ts)
- [src/app/admin/page.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/admin/page.tsx)
- [src/app/customer/page.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/customer/page.tsx)
- [src/app/pm/page.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/pm/page.tsx)
- [src/app/installer/page.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/installer/page.tsx)
- [src/app/reports/weekly-update/[id]/page.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/reports/weekly-update/[id]/page.tsx)
- [src/app/reports/weekly-update/[id]/PrintButton.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/reports/weekly-update/[id]/PrintButton.tsx)
- [src/app/status/[job_number]/page.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/status/[job_number]/page.tsx)
- [src/components/project-modal.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/project-modal.tsx)
- [src/components/view-report-link.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/view-report-link.tsx)
- [src/components/error-boundary.tsx](c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/error-boundary.tsx)
- [src/lib/supabase/middleware.ts](c:/Users/TimothyCollins/dev/tcc-projecthub/src/lib/supabase/middleware.ts)

## Known Issues / Limitations

- Migration 023 was not executed. Customer-facing reads for `project_assignments`, `pm_directory`, and related `profiles` access still depend on Timothy applying that SQL in Supabase.
- Migration 024 was not executed. Installer portal reads are built in app code, but production RLS still depends on Timothy applying those installer policies.
- The public `/status/[job_number]` page uses the service role key and intentionally exposes only minimal project status data.
- The weekly report page falls back to `The Controls Company` if a project manager display name cannot be resolved through the available row data.

## SQL Appendix

### Migration 023 - PM Directory Phone + Customer Team Read Policies

```sql
ALTER TABLE pm_directory ADD COLUMN IF NOT EXISTS phone text;

CREATE POLICY "Customer reads assignments for accessible projects"
  ON project_assignments FOR SELECT
  USING (
    current_user_role() = 'customer' AND
    EXISTS (
      SELECT 1 FROM project_customer_contacts pcc
      WHERE pcc.project_id = project_assignments.project_id
        AND pcc.profile_id = auth.uid()
        AND pcc.portal_access = true
    )
  );

CREATE POLICY "Customer reads pm_directory for assigned projects"
  ON pm_directory FOR SELECT
  USING (
    current_user_role() = 'customer' AND
    EXISTS (
      SELECT 1 FROM project_assignments pa
      JOIN project_customer_contacts pcc ON pcc.project_id = pa.project_id
      WHERE pa.pm_directory_id = pm_directory.id
        AND pcc.profile_id = auth.uid()
        AND pcc.portal_access = true
    )
  );

CREATE POLICY "Customer reads assigned team profiles"
  ON profiles FOR SELECT
  USING (
    current_user_role() = 'customer' AND
    EXISTS (
      SELECT 1 FROM project_assignments pa
      JOIN project_customer_contacts pcc ON pcc.project_id = pa.project_id
      WHERE pa.profile_id = profiles.id
        AND pcc.profile_id = auth.uid()
        AND pcc.portal_access = true
    )
  );
```

### Migration 024 - Installer RLS Policies

```sql
CREATE POLICY "Installer reads assigned projects"
  ON projects FOR SELECT
  USING (
    current_user_role() = 'installer' AND
    EXISTS (
      SELECT 1 FROM project_assignments pa
      WHERE pa.project_id = projects.id
        AND pa.profile_id = auth.uid()
        AND pa.role_on_project = 'installer'
    )
  );

CREATE POLICY "Installer reads billing for assigned projects"
  ON billing_periods FOR SELECT
  USING (
    current_user_role() = 'installer' AND
    EXISTS (
      SELECT 1 FROM project_assignments pa
      WHERE pa.project_id = billing_periods.project_id
        AND pa.profile_id = auth.uid()
        AND pa.role_on_project = 'installer'
    )
  );

CREATE POLICY "Installer reads assignments for own projects"
  ON project_assignments FOR SELECT
  USING (
    current_user_role() = 'installer' AND
    project_id IN (
      SELECT project_id FROM project_assignments
      WHERE profile_id = auth.uid() AND role_on_project = 'installer'
    )
  );
```

## Testing Checklist

- [x] `npm run build`
- [x] Weekly report route compiles and is reachable at `/reports/weekly-update/[id]`
- [x] PM portal update history includes `View Report`
- [x] Customer portal update cards include `View Report`
- [x] Admin project modal weekly updates include `View Report`
- [x] Admin page includes a `Weekly Updates` tab with search and blockers filter
- [x] PM update form shows last-update placeholders and prior men counts
- [x] Installer portal shows assigned project cards
- [x] Public `/status/[job_number]` route compiles
- [x] Customer portal shows copyable public status link when `job_number` exists
