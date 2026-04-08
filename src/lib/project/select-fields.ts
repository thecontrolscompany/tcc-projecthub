/**
 * Canonical Supabase select string for fetching a full project with assignments.
 * Used by the project editor modal in both admin-projects-tab and ops-project-list.
 */
export const PROJECT_SELECT_FIELDS = `
  id,
  name,
  job_number,
  estimated_income,
  contract_price,
  migration_status,
  is_active,
  billed_in_full,
  paid_in_full,
  completed_at,
  customer_id,
  customer_poc,
  customer_po_number,
  site_address,
  start_date,
  scheduled_completion,
  scope_description,
  general_contractor,
  mechanical_contractor,
  electrical_contractor,
  all_conduit_plenum,
  certified_payroll,
  buy_american,
  bond_required,
  source_estimate_id,
  special_requirements,
  special_access,
  notes,
  pm_directory_id,
  pm_id,
  sharepoint_folder,
  created_at,
  customer:customers(name),
  pm_directory:pm_directory(id, first_name, last_name, email, profile_id),
  project_assignments(
    id,
    profile_id,
    pm_directory_id,
    role_on_project,
    profile:profiles(id, full_name, email, role),
    pm_directory:pm_directory(id, first_name, last_name, email, profile_id)
  )
`;
