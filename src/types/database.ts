// Database types matching Supabase schema

export type UserRole = "admin" | "pm" | "customer";

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  email: string;
}

export interface Customer {
  id: string;
  name: string;
  contact_email: string | null;
}

export interface Project {
  id: string;
  customer_id: string;
  pm_id: string | null;
  name: string;
  estimated_income: number;
  onedrive_path: string | null;
  sharepoint_folder?: string | null;
  sharepoint_item_id?: string | null;
  job_number?: string | null;
  migration_status?: "legacy" | "migrated" | "clean" | null;
  billed_in_full: boolean;
  paid_in_full: boolean;
  completed_at: string | null;
  customer_poc: string | null;
  customer_po_number: string | null;
  site_address: string | null;
  contract_price: number | null;
  general_contractor: string | null;
  mechanical_contractor: string | null;
  electrical_contractor: string | null;
  all_conduit_plenum: boolean;
  certified_payroll: boolean;
  buy_american: boolean;
  bond_required: boolean;
  special_requirements: string | null;
  special_access: string | null;
  notes: string | null;
  pm_directory_id: string | null;
  is_active: boolean;
  created_at: string;
  // joined
  customer?: Customer;
  pm?: Profile;
  pm_directory?: PmDirectory;
}

export interface BillingPeriod {
  id: string;
  period_month: string; // ISO date string, first of month
  project_id: string;
  prior_pct: number;
  pct_complete: number;
  prev_billed: number;
  to_bill: number; // generated column
  actual_billed: number | null;
  estimated_income_snapshot: number;
  notes: string | null;
  synced_from_onedrive: boolean;
  // joined
  project?: Project;
}

export interface WeeklyUpdate {
  id: string;
  project_id: string;
  pm_id: string;
  week_of: string; // ISO date string
  pct_complete: number | null;
  notes: string | null;
  blockers: string | null;
  submitted_at: string;
  // joined
  project?: Project;
  pm?: Profile;
}

export interface PmDirectory {
  id: string;
  profile_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  // joined
  profile?: Profile;
}

// Billing table row (joined view used in admin table)
export interface BillingRow {
  billing_period_id: string;
  period_month?: string;
  project_id: string;
  customer_name: string;
  project_name: string;
  pm_email: string;
  pm_name: string;
  estimated_income: number;
  backlog: number; // estimated_income - prev_billed
  prior_pct: number;
  pct_complete: number;
  prev_billed: number;
  prev_billed_pct: number; // prev_billed / estimated_income
  to_bill: number;
  actual_billed: number | null;
  notes: string | null;
  synced_from_onedrive: boolean;
}
