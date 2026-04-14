ALTER TABLE public.legacy_opportunity_import_rows
  ADD COLUMN IF NOT EXISTS sharepoint_folder text,
  ADD COLUMN IF NOT EXISTS sharepoint_item_id text,
  ADD COLUMN IF NOT EXISTS proposal_docx_document_id uuid,
  ADD COLUMN IF NOT EXISTS proposal_pdf_document_id uuid,
  ADD COLUMN IF NOT EXISTS estimate_workbook_document_id uuid;

CREATE TABLE IF NOT EXISTS public.opportunity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id uuid REFERENCES public.pursuits(id) ON DELETE SET NULL,
  quote_request_id uuid REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  legacy_import_row_id uuid REFERENCES public.legacy_opportunity_import_rows(id) ON DELETE CASCADE,
  estimate_id text REFERENCES public.estimates(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  document_role text NOT NULL CHECK (document_role IN ('proposal_docx', 'proposal_pdf', 'estimate_xlsm', 'addendum', 'supporting_scope', 'customer_upload')),
  file_name text NOT NULL,
  file_ext text,
  content_type text,
  file_size_bytes bigint,
  storage_provider text NOT NULL DEFAULT 'sharepoint',
  storage_path text,
  storage_item_id text,
  storage_web_url text,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  archived_for_customer boolean NOT NULL DEFAULT false,
  is_primary_source boolean NOT NULL DEFAULT false,
  extraction_status text NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'completed', 'failed')),
  extraction_version text,
  extracted_at timestamptz,
  extracted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  extraction_notes text,
  extracted_json jsonb
);

CREATE TABLE IF NOT EXISTS public.opportunity_pricing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id uuid REFERENCES public.pursuits(id) ON DELETE SET NULL,
  quote_request_id uuid REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  legacy_import_row_id uuid REFERENCES public.legacy_opportunity_import_rows(id) ON DELETE CASCADE,
  source_document_id uuid REFERENCES public.opportunity_documents(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  amount numeric(12,2),
  item_type text NOT NULL DEFAULT 'other' CHECK (item_type IN ('base_bid', 'bond', 'alternate', 'deduct', 'allowance', 'vendor_fee', 'other')),
  is_conditional boolean NOT NULL DEFAULT false,
  included_in_base boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.opportunity_scope_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id uuid REFERENCES public.pursuits(id) ON DELETE SET NULL,
  quote_request_id uuid REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  legacy_import_row_id uuid REFERENCES public.legacy_opportunity_import_rows(id) ON DELETE CASCADE,
  source_document_id uuid REFERENCES public.opportunity_documents(id) ON DELETE SET NULL,
  section_type text NOT NULL CHECK (section_type IN ('scope', 'clarification', 'exclusion', 'warranty', 'reference')),
  heading text,
  body text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.opportunity_equipment_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id uuid REFERENCES public.pursuits(id) ON DELETE SET NULL,
  quote_request_id uuid REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  legacy_import_row_id uuid REFERENCES public.legacy_opportunity_import_rows(id) ON DELETE CASCADE,
  source_document_id uuid REFERENCES public.opportunity_documents(id) ON DELETE SET NULL,
  system_label text NOT NULL,
  quantity integer,
  control_type text,
  tag_text text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.opportunity_estimate_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id uuid REFERENCES public.pursuits(id) ON DELETE SET NULL,
  quote_request_id uuid REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  legacy_import_row_id uuid REFERENCES public.legacy_opportunity_import_rows(id) ON DELETE CASCADE,
  estimate_id text REFERENCES public.estimates(id) ON DELETE SET NULL,
  source_document_id uuid REFERENCES public.opportunity_documents(id) ON DELETE SET NULL,
  source_sheet_name text NOT NULL DEFAULT 'Summary',
  labor_hours_total numeric(12,2),
  labor_cost_total numeric(12,2),
  material_cost_total numeric(12,2),
  direct_indirect_cost_total numeric(12,2),
  total_cost numeric(12,2),
  overhead_rate numeric(8,4),
  overhead_value numeric(12,2),
  profit_rate numeric(8,4),
  profit_value numeric(12,2),
  vendor_fee_rate numeric(8,4),
  vendor_fee_value numeric(12,2),
  base_bid_amount numeric(12,2),
  bond_amount numeric(12,2),
  final_total_amount numeric(12,2),
  extracted_at timestamptz NOT NULL DEFAULT now(),
  extracted_json jsonb
);

CREATE TABLE IF NOT EXISTS public.opportunity_extraction_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id uuid REFERENCES public.pursuits(id) ON DELETE SET NULL,
  quote_request_id uuid REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  legacy_import_row_id uuid REFERENCES public.legacy_opportunity_import_rows(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.opportunity_documents(id) ON DELETE CASCADE,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  review_status text NOT NULL CHECK (review_status IN ('approved', 'approved_with_edits', 'rejected')),
  notes text,
  field_overrides jsonb
);

ALTER TABLE public.opportunity_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_pricing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_scope_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_equipment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_estimate_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_extraction_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manages opportunity documents" ON public.opportunity_documents;
CREATE POLICY "Admin manages opportunity documents" ON public.opportunity_documents FOR ALL USING (
  current_user_role() = 'admin'
) WITH CHECK (
  current_user_role() = 'admin'
);

DROP POLICY IF EXISTS "Admin manages opportunity pricing items" ON public.opportunity_pricing_items;
CREATE POLICY "Admin manages opportunity pricing items" ON public.opportunity_pricing_items FOR ALL USING (
  current_user_role() = 'admin'
) WITH CHECK (
  current_user_role() = 'admin'
);

DROP POLICY IF EXISTS "Admin manages opportunity scope items" ON public.opportunity_scope_items;
CREATE POLICY "Admin manages opportunity scope items" ON public.opportunity_scope_items FOR ALL USING (
  current_user_role() = 'admin'
) WITH CHECK (
  current_user_role() = 'admin'
);

DROP POLICY IF EXISTS "Admin manages opportunity equipment groups" ON public.opportunity_equipment_groups;
CREATE POLICY "Admin manages opportunity equipment groups" ON public.opportunity_equipment_groups FOR ALL USING (
  current_user_role() = 'admin'
) WITH CHECK (
  current_user_role() = 'admin'
);

DROP POLICY IF EXISTS "Admin manages opportunity estimate summaries" ON public.opportunity_estimate_summaries;
CREATE POLICY "Admin manages opportunity estimate summaries" ON public.opportunity_estimate_summaries FOR ALL USING (
  current_user_role() = 'admin'
) WITH CHECK (
  current_user_role() = 'admin'
);

DROP POLICY IF EXISTS "Admin manages opportunity extraction reviews" ON public.opportunity_extraction_reviews;
CREATE POLICY "Admin manages opportunity extraction reviews" ON public.opportunity_extraction_reviews FOR ALL USING (
  current_user_role() = 'admin'
) WITH CHECK (
  current_user_role() = 'admin'
);

CREATE INDEX IF NOT EXISTS idx_opportunity_documents_legacy_import_row_id
  ON public.opportunity_documents (legacy_import_row_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunity_pricing_items_legacy_import_row_id
  ON public.opportunity_pricing_items (legacy_import_row_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_opportunity_scope_items_legacy_import_row_id
  ON public.opportunity_scope_items (legacy_import_row_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_opportunity_equipment_groups_legacy_import_row_id
  ON public.opportunity_equipment_groups (legacy_import_row_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_opportunity_estimate_summaries_legacy_import_row_id
  ON public.opportunity_estimate_summaries (legacy_import_row_id, extracted_at DESC);
