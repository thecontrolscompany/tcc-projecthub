// Database types matching Supabase schema

export type UserRole = "admin" | "pm" | "lead" | "installer" | "ops_manager" | "customer";
export type InternalContactRole = "pm" | "lead" | "installer" | "ops_manager";
export type ProjectAssignmentRole = "pm" | "lead" | "installer" | "ops_manager";
export type OrganizationStatus = "active" | "trial" | "suspended" | "archived";
export type OrganizationMemberRole = "owner" | "admin" | "manager" | "member" | "customer";
export type PlatformModuleId =
  | "platform"
  | "crm"
  | "hvac_estimator"
  | "projecthub"
  | "billing"
  | "time"
  | "documents"
  | "analytics";
export type QuoteRequestStatus = "new" | "reviewing" | "quoted" | "won" | "lost";
export type OpportunityStage =
  | "new"
  | "under_review"
  | "waiting_on_info"
  | "assigned"
  | "estimating"
  | "proposal_ready"
  | "submitted"
  | "won"
  | "lost"
  | "archived";
export type WeeklyUpdateStatus = "draft" | "submitted";
export type ChangeOrderUiStatus =
  | "draft"
  | "needs_pricing"
  | "ready_to_submit"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected"
  | "voided"
  | "superseded"
  | "executed"
  | "billed"
  | "paid";
export type ChangeOrderLegacyStatus = "pending" | "needs_revision" | "approved_po" | "approved_email" | "void";
export type ChangeOrderStatus = ChangeOrderUiStatus | ChangeOrderLegacyStatus;
export type ChangeOrderPricingMode = "quick_total" | "detailed";
export type ChangeOrderLineItemCategory = "labor" | "material" | "equipment" | "subcontractor" | "other";
export type ChangeOrderAttachmentKind = "backup" | "supporting" | "photo" | "pdf" | "signed" | "customer";
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
  default_organization_id?: string | null;
}

export interface Organization {
  id: string;
  slug: string;
  name: string;
  status: OrganizationStatus;
  billing_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformModule {
  id: PlatformModuleId;
  name: string;
  description: string | null;
  route_prefix: string;
  is_core: boolean;
  created_at: string;
}

export interface OrganizationModule {
  organization_id: string;
  module_id: PlatformModuleId;
  enabled: boolean;
  enabled_at: string;
  disabled_at: string | null;
  settings: Record<string, unknown>;
  module?: PlatformModule;
}

export interface OrganizationMembership {
  organization_id: string;
  profile_id: string;
  role: OrganizationMemberRole;
  module_roles: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  organization?: Organization;
  profile?: Profile;
}

export interface Customer {
  id: string;
  organization_id?: string | null;
  name: string;
  contact_email: string | null;
}

export interface Project {
  id: string;
  organization_id?: string | null;
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
  labor_rate: number;
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
  invoice_number: string | null;
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
  activity_updates: string | null;
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
  submitted_at: string | null;
  updated_at: string;
  // joined
  project?: Project;
  pm?: Profile;
}

export type WalkthroughWaypoint = {
  t: number;
  x: number;
  y: number;
};

export interface ProjectWalkthrough {
  id: string;
  project_id: string;
  share_url: string | null;
  player_type: "insta360" | "psv";
  video_url: string | null;
  plan_url: string | null;
  waypoints: WalkthroughWaypoint[] | null;
  media_id: string | null;
  title: string | null;
  duration: string | null;
  cover_image_url: string | null;
  recorded_date: string | null; // ISO date string
  created_at: string;
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

export type EstimateStatus = "draft" | "in_progress" | "ready" | "proposal_exported" | "awarded" | "archived";

export interface EstimateRecord {
  id: string;
  organization_id: string | null;
  owner_id: string;
  body: Record<string, unknown>;
  name: string | null;
  number: string | null;
  archived: boolean;
  status: EstimateStatus;
  linked_opportunity_id: string | null;
  linked_project_id: string | null;
  total_amount: number | null;
  gross_margin_amount: number | null;
  gross_margin_pct: number | null;
  proposal_exported_at: string | null;
  estimate_ready_at: string | null;
  created_at: string;
  updated_at: string;
  owner?: Pick<Profile, "id" | "full_name" | "email"> | null;
  opportunity?: Pick<CrmOpportunity, "id" | "opportunity_number" | "project_name" | "stage"> | null;
  project?: Pick<Project, "id" | "name" | "job_number"> | null;
}

export interface PursuitSummary {
  id: string;
  pursuit_number: string | null;
  project_name: string;
  project_location: string | null;
  owner_name: string | null;
  gc_name: string | null;
  engineer_name: string | null;
  shared_scope_notes: string | null;
  status: "active" | "awarded" | "lost" | "passed" | "archived";
  linked_project_id: string | null;
  sharepoint_folder: string | null;
  sharepoint_item_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LegacyOpportunityImportBatch {
  id: string;
  source_name: string;
  source_file_name: string | null;
  source_file_size_bytes: number | null;
  imported_by: string | null;
  imported_at: string;
  row_count: number;
  status: "draft" | "reviewing" | "ready" | "promoted" | "archived";
  notes: string | null;
  source_metadata: Record<string, unknown> | null;
}

export interface LegacyOpportunityImportRow {
  id: string;
  batch_id: string;
  source_row_number: number;
  source_external_id: string | null;
  legacy_opportunity_name: string | null;
  company_name: string | null;
  contact_name: string | null;
  estimator_name: string | null;
  project_location: string | null;
  job_number: string | null;
  bid_date: string | null;
  proposal_date: string | null;
  amount: number | null;
  status: string | null;
  outcome: string | null;
  notes: string | null;
  raw_payload: Record<string, unknown>;
  normalized_payload: Record<string, unknown>;
  validation_issues: string[];
  review_status: "pending" | "matched" | "promoted" | "rejected";
  promoted_quote_request_id: string | null;
  sharepoint_folder?: string | null;
  sharepoint_item_id?: string | null;
  proposal_docx_document_id?: string | null;
  proposal_pdf_document_id?: string | null;
  estimate_workbook_document_id?: string | null;
  created_at: string;
}

export interface LegacyOpportunityMatchCandidate {
  id?: string;
  import_row_id: string;
  candidate_type: "project" | "pursuit";
  candidate_id: string;
  confidence_score: number;
  reason_codes: string[];
  detail: Record<string, unknown>;
  created_at?: string;
}

export interface LegacyOpportunityLinkReview {
  id: string;
  import_row_id: string;
  selected_project_id: string | null;
  selected_pursuit_id: string | null;
  selected_action: "link_project" | "link_pursuit" | "create_pursuit" | "standalone" | "reject" | "merge_pursuit";
  reviewed_by: string | null;
  reviewed_at: string;
  notes: string | null;
}

export interface OpportunityDocument {
  id: string;
  pursuit_id: string | null;
  quote_request_id: string | null;
  legacy_import_row_id: string | null;
  estimate_id: string | null;
  project_id: string | null;
  document_role: "proposal_docx" | "proposal_pdf" | "estimate_xlsm" | "addendum" | "supporting_scope" | "customer_upload";
  file_name: string;
  file_ext: string | null;
  content_type: string | null;
  file_size_bytes: number | null;
  storage_provider: string;
  storage_path: string | null;
  storage_item_id: string | null;
  storage_web_url: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  archived_for_customer: boolean;
  is_primary_source: boolean;
  extraction_status: "pending" | "completed" | "failed";
  extraction_version: string | null;
  extracted_at: string | null;
  extracted_by: string | null;
  extraction_notes: string | null;
  extracted_json: Record<string, unknown> | null;
}

export interface OpportunityPricingItem {
  id: string;
  legacy_import_row_id: string | null;
  source_document_id: string | null;
  label: string;
  amount: number | null;
  item_type: "base_bid" | "bond" | "alternate" | "deduct" | "allowance" | "vendor_fee" | "other";
  is_conditional: boolean;
  included_in_base: boolean;
  notes: string | null;
  sort_order: number;
}

export interface OpportunityScopeItem {
  id: string;
  legacy_import_row_id: string | null;
  source_document_id: string | null;
  section_type: "scope" | "clarification" | "exclusion" | "warranty" | "reference";
  heading: string | null;
  body: string;
  sort_order: number;
}

export interface OpportunityEquipmentGroup {
  id: string;
  legacy_import_row_id: string | null;
  source_document_id: string | null;
  system_label: string;
  quantity: number | null;
  control_type: string | null;
  tag_text: string | null;
  notes: string | null;
  sort_order: number;
}

export interface OpportunityEstimateSummary {
  id: string;
  legacy_import_row_id: string | null;
  source_document_id: string | null;
  source_sheet_name: string;
  labor_hours_total: number | null;
  labor_cost_total: number | null;
  material_cost_total: number | null;
  direct_indirect_cost_total: number | null;
  total_cost: number | null;
  overhead_rate: number | null;
  overhead_value: number | null;
  profit_rate: number | null;
  profit_value: number | null;
  vendor_fee_rate: number | null;
  vendor_fee_value: number | null;
  base_bid_amount: number | null;
  bond_amount: number | null;
  final_total_amount: number | null;
  extracted_at: string;
  extracted_json: Record<string, unknown> | null;
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
  pursuit_id?: string | null;
  opportunity_number?: string | null;
  customer_id?: string | null;
  project_name?: string | null;
  project_location?: string | null;
  proposal_date?: string | null;
  bid_date?: string | null;
  due_date?: string | null;
  stage?: OpportunityStage | null;
  assigned_estimator_id?: string | null;
  assigned_at?: string | null;
  internal_notes?: string | null;
  outcome_reason?: string | null;
  opportunity_value?: number | null;
  base_bid_amount?: number | null;
  bond_amount?: number | null;
  final_price_amount?: number | null;
  proposal_docx_document_id?: string | null;
  proposal_pdf_document_id?: string | null;
  estimate_workbook_document_id?: string | null;
  sharepoint_folder?: string | null;
  sharepoint_item_id?: string | null;
  submitted_at?: string | null;
  linked_project_id?: string | null;
  project?: { name: string; job_number: string | null; customer?: { name: string | null } | null } | null;
  linked_project?: { name: string; job_number: string | null; customer?: { name: string | null } | null } | null;
  pursuit?: PursuitSummary | null;
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
  cor_number: string;
  co_number: string;
  sequence_number: number;
  number_prefix: string;
  number_padding: number;
  title: string;
  description: string | null;
  amount: number;
  status: ChangeOrderStatus;
  pricing_mode: ChangeOrderPricingMode;
  requested_amount: number;
  approved_amount: number;
  requested_days: number;
  approved_days: number;
  requested_by_name: string | null;
  customer_contact_name: string | null;
  customer_contact_email: string | null;
  source: string | null;
  what_happened: string | null;
  work_required: string | null;
  reason: string | null;
  terms_note: string | null;
  status_reason: string | null;
  internal_notes: string | null;
  submitted_date: string | null;
  approved_date: string | null;
  submitted_by: string | null;
  approved_by: string | null;
  reference_doc: string | null;
  notes: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  executed_at: string | null;
  billed_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  rejected_at: string | null;
  superseded_at: string | null;
  combined_at: string | null;
  superseded_by_change_order_id: string | null;
  combined_into_change_order_id: string | null;
  modified_by: string | null;
  labor_amount: number;
  material_amount: number;
  equipment_amount: number;
  subcontractor_amount: number;
  other_amount: number;
  created_at: string;
  updated_at: string;
  // joined / bundled
  project?: Project | null;
  line_items?: ChangeOrderLineItem[];
  attachments?: ChangeOrderAttachment[];
  status_history?: ChangeOrderStatusHistory[];
}

export interface ChangeOrderLineItem {
  id: string;
  change_order_id: string;
  category: ChangeOrderLineItemCategory;
  sort_order: number;
  description: string;
  role: string | null;
  people_count: number | null;
  hours_per_person: number | null;
  days: number | null;
  hourly_rate: number | null;
  quantity: number | null;
  unit: string | null;
  unit_cost: number | null;
  lump_sum: number | null;
  markup_percent: number;
  base_amount: number;
  total: number;
  created_at: string;
  updated_at: string;
}

export interface ChangeOrderAttachment {
  id: string;
  change_order_id: string;
  attachment_kind: ChangeOrderAttachmentKind;
  title: string | null;
  description: string | null;
  file_name: string;
  content_type: string | null;
  storage_provider: string;
  storage_path: string | null;
  storage_web_url: string | null;
  file_size_bytes: number | null;
  sort_order: number;
  is_customer_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChangeOrderStatusHistory {
  id: string;
  change_order_id: string;
  previous_status: ChangeOrderStatus | null;
  new_status: ChangeOrderStatus;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
  metadata: Record<string, unknown>;
}

export interface ProjectChangeOrderSequence {
  project_id: string;
  next_sequence: number;
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
  unit_cost: number | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  qty_received?: number;
  remain_surplus?: number;
  status?: BomStatus;
}

export interface ControlsAssemblyCatalogRow {
  id: string;
  organization_id: string;
  description: string;
  mtl_unit: number;
  mtl_per: string;
  hrs_unit: number;
  hrs_per: string;
  category: string | null;
  alternate_ids: string[];
  part_number: string | null;
  manufacturer: string | null;
  io_type: string | null;
  created_at?: string;
  updated_at?: string;
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

export interface TimeDayHoursRow {
  work_date: string;
  total_hours: number;
}

export interface EmployeeHoursRow {
  qb_user_id: number;
  display_name: string;
  total_hours: number;
  jobcode_count: number;
}

export interface EmployeeProjectHoursRow {
  project_key?: string;
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
  invoice_number: string | null;
  notes: string | null;
  synced_from_onedrive: boolean;
  poc_driven?: boolean;
  has_recent_update?: boolean;
}

// ============================================================
// CRM MODULE TYPES — RelationshipHub
// ============================================================

export type CrmAccountType =
  | "general_contractor"
  | "mechanical_contractor"
  | "electrical_contractor"
  | "tab_commissioning"
  | "controls_contractor"
  | "hvac_oem"
  | "controls_oem"
  | "owner"
  | "other";

export type CrmAccountStatus = "active" | "inactive" | "prospect";
export type CrmRelationshipHealth = "strong" | "good" | "at_risk" | "dormant" | "unknown";

export type CrmContactRoleType =
  | "salesperson"
  | "sales_manager"
  | "estimator"
  | "project_manager"
  | "senior_project_manager"
  | "operations_manager"
  | "owner"
  | "cfo"
  | "cfo_estimator"
  | "unknown";

export type CrmContactMethod = "email" | "phone" | "mobile" | "in_person";
export type CrmInfluenceLevel = "high" | "medium" | "low" | "unknown";
export type CrmBuyingRole =
  | "decision_maker"
  | "influencer"
  | "evaluator"
  | "user"
  | "gatekeeper"
  | "unknown";
export type CrmConfidenceLevel = "confirmed" | "partially_confirmed" | "needs_verification";

export type CrmOpportunityStage =
  | "target_account"
  | "initial_contact"
  | "relationship_building"
  | "opportunity_identified"
  | "request_for_pricing"
  | "estimating"
  | "proposal_sent"
  | "follow_up_negotiation"
  | "verbal_award"
  | "po_received"
  | "closed_lost"
  | "on_hold";

export type CrmOpportunityContactRole =
  | "primary"
  | "secondary"
  | "estimating"
  | "pm_handoff"
  | "technical"
  | "executive";

export type CrmActivityType =
  | "meeting"
  | "call"
  | "email"
  | "site_visit"
  | "lunch"
  | "estimate_request"
  | "proposal_followup"
  | "pm_handoff"
  | "other";

export type CrmTaskPriority = "low" | "medium" | "high" | "urgent";
export type CrmTaskStatus = "open" | "in_progress" | "completed" | "cancelled";

export interface CrmAccount {
  id: string;
  organization_id?: string | null;
  company_name: string;
  type: CrmAccountType;
  types: CrmAccountType[];
  territory: string | null;
  status: CrmAccountStatus;
  notes: string | null;
  relationship_owner_profile_id: string | null;
  tags: string[];
  website: string | null;
  address: string | null;
  relationship_health: CrmRelationshipHealth;
  last_meaningful_contact_date: string | null;
  next_scheduled_followup_date: string | null;
  who_buys: string | null;
  who_issues_po: string | null;
  who_influences_spec: string | null;
  who_owns_estimating_relationship: string | null;
  handoff_notes: string | null;
  linked_customer_id: string | null;
  created_at: string;
  updated_at: string;
  // joined
  relationship_owner?: Pick<Profile, "id" | "full_name" | "email"> | null;
  contacts?: CrmContact[];
  opportunities?: CrmOpportunity[];
}

export interface CrmContact {
  id: string;
  organization_id?: string | null;
  account_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  role_type: CrmContactRoleType;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  location: string | null;
  preferred_contact_method: CrmContactMethod;
  influence_level: CrmInfluenceLevel;
  buying_role: CrmBuyingRole;
  reports_to_contact_id: string | null;
  issues_purchase_orders: boolean;
  involved_in_estimating: boolean;
  involved_in_project_execution: boolean;
  notes: string | null;
  is_active: boolean;
  confidence_level: CrmConfidenceLevel;
  created_at: string;
  updated_at: string;
  // joined
  account?: Pick<CrmAccount, "id" | "company_name" | "type"> | null;
  reports_to?: Pick<CrmContact, "id" | "display_name"> | null;
}

export interface CrmOpportunity {
  id: string;
  organization_id?: string | null;
  opportunity_number: string;
  account_id: string;
  project_name: string;
  primary_contact_id: string | null;
  estimator_profile_id: string | null;
  pm_profile_id: string | null;
  internal_owner_profile_id: string | null;
  estimated_value: number | null;
  estimated_gross_margin: number | null;
  estimated_margin_pct: number | null;
  probability: number | null;
  expected_close_date: string | null;
  bid_due_date: string | null;
  market_type: string | null;
  stage: CrmOpportunityStage;
  next_step: string | null;
  last_activity_date: string | null;
  lead_source: string | null;
  notes: string | null;
  linked_pursuit_id: string | null;
  linked_quote_request_id: string | null;
  created_at: string;
  updated_at: string;
  // joined
  account?: Pick<CrmAccount, "id" | "company_name"> | null;
  primary_contact?: Pick<CrmContact, "id" | "display_name" | "role_type"> | null;
  opportunity_contacts?: CrmOpportunityContact[];
}

export interface CrmOpportunityContact {
  id: string;
  organization_id?: string | null;
  opportunity_id: string;
  contact_id: string;
  contact_role_on_opportunity: CrmOpportunityContactRole;
  created_at: string;
  // joined
  contact?: Pick<CrmContact, "id" | "display_name" | "role_type" | "confidence_level"> | null;
}

export interface CrmActivity {
  id: string;
  organization_id?: string | null;
  activity_type: CrmActivityType;
  activity_date: string;
  summary: string;
  key_decisions: string | null;
  follow_up_actions: string | null;
  follow_up_due_date: string | null;
  attendees_text: string | null;
  account_id: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  logged_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
  // joined
  account?: Pick<CrmAccount, "id" | "company_name"> | null;
  contact?: Pick<CrmContact, "id" | "display_name"> | null;
  opportunity?: Pick<CrmOpportunity, "id" | "project_name" | "opportunity_number"> | null;
  logged_by?: Pick<Profile, "id" | "full_name" | "email"> | null;
}

export interface CrmTask {
  id: string;
  organization_id?: string | null;
  title: string;
  description: string | null;
  assigned_to_profile_id: string | null;
  due_date: string | null;
  priority: CrmTaskPriority;
  status: CrmTaskStatus;
  account_id: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  reminder_date: string | null;
  completed_at: string | null;
  created_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
  // joined
  assigned_to?: Pick<Profile, "id" | "full_name" | "email"> | null;
  account?: Pick<CrmAccount, "id" | "company_name"> | null;
  opportunity?: Pick<CrmOpportunity, "id" | "project_name" | "opportunity_number"> | null;
}

export interface CrmSalespersonTarget {
  id: string;
  profile_id: string;
  period_start: string;
  period_end: string;
  target_customer_meetings_per_week: number | null;
  target_outreach_touches_per_week: number | null;
  target_active_opportunities: number | null;
  target_proposals_requested: number | null;
  target_proposals_sent: number | null;
  target_closed_won_revenue: number | null;
  target_gross_margin: number | null;
  strategic_notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  profile?: Pick<Profile, "id" | "full_name" | "email"> | null;
}

export interface CrmDashboardMetrics {
  pipeline_by_stage: Array<{
    stage: CrmOpportunityStage;
    count: number;
    total_value: number;
  }>;
  open_opps_by_account: Array<{
    account_id: string;
    company_name: string;
    count: number;
    total_value: number;
  }>;
  revenue_by_close_month: Array<{
    month: string;
    total_value: number;
    count: number;
  }>;
  stale_opportunities: Array<{
    id: string;
    opportunity_number: string;
    project_name: string;
    company_name: string;
    last_activity_date: string | null;
    days_stale: number;
  }>;
  accounts_single_contact: Array<{
    id: string;
    company_name: string;
    contact_count: number;
  }>;
  contacts_by_role: Array<{
    role_type: CrmContactRoleType;
    count: number;
  }>;
  tasks_due_this_week: CrmTask[];
  po_issuers: Array<{
    id: string;
    display_name: string;
    company_name: string;
    email: string | null;
  }>;
  estimating_contacts_by_account: Array<{
    account_id: string;
    company_name: string;
    contacts: Array<{ id: string; display_name: string }>;
  }>;
}
