// Database types matching Supabase schema

export type UserRole = "admin" | "pm" | "lead" | "installer" | "ops_manager" | "customer";
export type InternalContactRole = "pm" | "lead" | "installer" | "ops_manager";
export type ProjectAssignmentRole = "pm" | "lead" | "installer" | "ops_manager";
export type QuoteRequestStatus = "new" | "reviewing" | "quoted" | "won" | "lost";
export type WeeklyUpdateStatus = "draft" | "submitted";
export type ChangeOrderStatus = "pending" | "approved" | "rejected" | "void";
export type WipStatus = "not_started" | "in_progress" | "blocked" | "in_review" | "complete";
export type WipPriority = "low" | "medium" | "high";
export type BomStatus = "not_received" | "partial" | "received" | "surplus";

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  email: string;
  pm_directory_id: string | null;
  phone: string | null;
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
  source_estimate_id: string | null;
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

export interface PocLineItem {
  id: string;
  project_id: string;
  category: string;
  weight: number;
  pct_complete: number; // 0–1
  sort_order: number;
  created_at: string;
}

export interface PocSnapshotEntry {
  id: string;
  category: string;
  weight: number;
  pct_complete: number;
}

export interface CrewLogEntry {
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";
  workers: number;
  hours: number;
  activities: string;
}

export interface LaborHoursWorker {
  display_name: string;
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  sat: number;
  total: number;
}

export interface WeeklyUpdate {
  id: string;
  project_id: string;
  pm_id: string | null;
  week_of: string; // ISO date string
  status: WeeklyUpdateStatus;
  pct_complete: number | null;
  notes: string | null;
  blockers: string | null;
  poc_snapshot: PocSnapshotEntry[] | null;
  crew_log: CrewLogEntry[] | null;
  labor_hours_pulled: number | null;
  labor_hours_override: number | null;
  labor_hours_source: "qb_time" | "manual" | null;
  labor_hours_pulled_at: string | null;
  labor_hours_detail: LaborHoursWorker[] | null;
  material_delivered: string | null;
  equipment_set: string | null;
  safety_incidents: string | null;
  inspections_tests: string | null;
  delays_impacts: string | null;
  other_remarks: string | null;
  imported_from?: string | null;
  include_bom_report?: boolean;
  submitted_at: string;
  // joined
  project?: Project;
  pm?: Profile;
}

export type WeeklyUpdateEdit = {
  id: string;
  weekly_update_id: string;
  edited_by_profile_id: string | null;
  edited_at: string;
  editor_name: string | null;
  note: string | null;
};

export interface PmDirectory {
  id: string;
  profile_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  intended_role: InternalContactRole | null;
  // joined
  profile?: Profile;
}

export interface ProjectCustomerContact {
  id: string;
  project_id: string;
  profile_id: string;
  portal_access: boolean;
  email_digest: boolean;
  created_at: string;
  // joined
  profile?: Profile;
}

export interface ProjectAssignment {
  id: string;
  project_id: string;
  profile_id: string | null;
  pm_directory_id: string | null;
  role_on_project: ProjectAssignmentRole;
  created_at: string | null;
  profile?: Profile | null;
  pm_directory?: PmDirectory | null;
}

export interface EstimatePayload {
  estimate_id: string;
  project_name: string;
  items: Array<{
    id: string;
    type: string;
    quantity: number;
    labor_hours: number;
    description: string;
  }>;
}

export type QuoteRequest = {
  id: string;
  created_at: string;
  updated_at: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  project_description: string;
  site_address: string | null;
  estimated_value: number | null;
  status: QuoteRequestStatus;
  notes: string | null;
  project_id: string | null;
  project?: { name: string; job_number: string | null } | null;
};

export interface CustomerFeedback {
  id: string;
  project_id: string;
  profile_id: string;
  message: string;
  submitted_at: string;
  reviewed: boolean;
}

export interface PortalFeedback {
  id: string;
  submitted_by: string;
  type: "bug" | "feature" | "ux" | "other";
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  page_area: string | null;
  status: "new" | "reviewing" | "planned" | "done" | "wont_fix";
  created_at: string;
}

export interface ChangeOrder {
  id: string;
  project_id: string;
  co_number: string;
  title: string;
  description: string | null;
  amount: number;
  status: ChangeOrderStatus;
  submitted_date: string | null;
  approved_date: string | null;
  submitted_by: string | null;
  approved_by: string | null;
  reference_doc: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WipItem {
  id: string;
  project_id: string;
  system_area: string;
  task: string;
  status: WipStatus;
  assigned_to: string | null;
  responsible_co: string | null;
  blocker: string | null;
  priority: WipPriority;
  due_date: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BomItem {
  id: string;
  project_id: string;
  section: string;
  designation: string | null;
  code_number: string | null;
  description: string;
  qty_required: number;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  qty_received?: number;
  remain_surplus?: number;
  status?: BomStatus;
}

export interface MaterialReceipt {
  id: string;
  bom_item_id: string;
  qty_received: number;
  date_received: string;
  received_by: string | null;
  packing_slip: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProjectHoursRow {
  project_id: string;
  project_name: string;
  total_hours: number;
  worker_count: number;
}

export interface ProjectWorkerHoursRow {
  qb_user_id: number;
  display_name: string;
  total_hours: number;
}

export interface EmployeeHoursRow {
  qb_user_id: number;
  display_name: string;
  total_hours: number;
  jobcode_count: number;
}

export interface EmployeeProjectHoursRow {
  project_id: string | null;
  project_name: string;
  total_hours: number;
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
  poc_driven?: boolean;
  has_recent_update?: boolean;
}
