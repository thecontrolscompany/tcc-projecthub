CREATE TABLE IF NOT EXISTS public.pursuits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_number text UNIQUE,
  project_name text NOT NULL,
  project_location text,
  owner_name text,
  gc_name text,
  engineer_name text,
  shared_scope_notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'awarded', 'lost', 'archived')),
  linked_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  sharepoint_folder text,
  sharepoint_item_id text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pursuits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal reads pursuits" ON public.pursuits;
CREATE POLICY "Internal reads pursuits" ON public.pursuits FOR SELECT USING (
  current_user_role() IN ('admin', 'ops_manager', 'pm', 'lead')
);

DROP POLICY IF EXISTS "Admin manages pursuits" ON public.pursuits;
CREATE POLICY "Admin manages pursuits" ON public.pursuits FOR ALL USING (
  current_user_role() = 'admin'
) WITH CHECK (
  current_user_role() = 'admin'
);

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS pursuit_id uuid REFERENCES public.pursuits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opportunity_number text,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS project_location text,
  ADD COLUMN IF NOT EXISTS proposal_date date,
  ADD COLUMN IF NOT EXISTS bid_date date,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS stage text CHECK (stage IN ('new', 'under_review', 'waiting_on_info', 'assigned', 'estimating', 'proposal_ready', 'submitted', 'won', 'lost', 'archived')),
  ADD COLUMN IF NOT EXISTS assigned_estimator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS outcome_reason text,
  ADD COLUMN IF NOT EXISTS opportunity_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS base_bid_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS bond_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS final_price_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS proposal_docx_document_id uuid,
  ADD COLUMN IF NOT EXISTS proposal_pdf_document_id uuid,
  ADD COLUMN IF NOT EXISTS estimate_workbook_document_id uuid,
  ADD COLUMN IF NOT EXISTS sharepoint_folder text,
  ADD COLUMN IF NOT EXISTS sharepoint_item_id text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quote_requests_pursuit_id ON public.quote_requests (pursuit_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_customer_id ON public.quote_requests (customer_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_assigned_estimator_id ON public.quote_requests (assigned_estimator_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_bid_date ON public.quote_requests (bid_date);
CREATE INDEX IF NOT EXISTS idx_quote_requests_proposal_date ON public.quote_requests (proposal_date);
CREATE INDEX IF NOT EXISTS idx_quote_requests_stage ON public.quote_requests (stage);
CREATE INDEX IF NOT EXISTS idx_quote_requests_linked_project_id ON public.quote_requests (linked_project_id);
