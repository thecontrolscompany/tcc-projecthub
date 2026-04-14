CREATE TABLE IF NOT EXISTS public.legacy_opportunity_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_file_name text,
  source_file_size_bytes bigint,
  imported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  row_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewing', 'ready', 'promoted', 'archived')),
  notes text,
  source_metadata jsonb
);

CREATE TABLE IF NOT EXISTS public.legacy_opportunity_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.legacy_opportunity_import_batches(id) ON DELETE CASCADE,
  source_row_number integer NOT NULL,
  source_external_id text,
  legacy_opportunity_name text,
  company_name text,
  contact_name text,
  estimator_name text,
  project_location text,
  job_number text,
  bid_date date,
  proposal_date date,
  amount numeric(12,2),
  status text,
  outcome text,
  notes text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'matched', 'promoted', 'rejected')),
  promoted_quote_request_id uuid REFERENCES public.quote_requests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.legacy_opportunity_match_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_row_id uuid NOT NULL REFERENCES public.legacy_opportunity_import_rows(id) ON DELETE CASCADE,
  candidate_type text NOT NULL CHECK (candidate_type IN ('project', 'pursuit')),
  candidate_id uuid NOT NULL,
  confidence_score numeric(5,2) NOT NULL DEFAULT 0,
  reason_codes text[] NOT NULL DEFAULT '{}',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.legacy_opportunity_link_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_row_id uuid NOT NULL REFERENCES public.legacy_opportunity_import_rows(id) ON DELETE CASCADE,
  selected_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  selected_pursuit_id uuid REFERENCES public.pursuits(id) ON DELETE SET NULL,
  selected_action text NOT NULL CHECK (selected_action IN ('link_project', 'link_pursuit', 'create_pursuit', 'standalone', 'reject')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.legacy_opportunity_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_opportunity_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_opportunity_match_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_opportunity_link_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manages legacy opportunity import batches" ON public.legacy_opportunity_import_batches;
CREATE POLICY "Admin manages legacy opportunity import batches" ON public.legacy_opportunity_import_batches FOR ALL USING (
  current_user_role() = 'admin'
) WITH CHECK (
  current_user_role() = 'admin'
);

DROP POLICY IF EXISTS "Admin manages legacy opportunity import rows" ON public.legacy_opportunity_import_rows;
CREATE POLICY "Admin manages legacy opportunity import rows" ON public.legacy_opportunity_import_rows FOR ALL USING (
  current_user_role() = 'admin'
) WITH CHECK (
  current_user_role() = 'admin'
);

DROP POLICY IF EXISTS "Admin manages legacy opportunity match candidates" ON public.legacy_opportunity_match_candidates;
CREATE POLICY "Admin manages legacy opportunity match candidates" ON public.legacy_opportunity_match_candidates FOR ALL USING (
  current_user_role() = 'admin'
) WITH CHECK (
  current_user_role() = 'admin'
);

DROP POLICY IF EXISTS "Admin manages legacy opportunity link reviews" ON public.legacy_opportunity_link_reviews;
CREATE POLICY "Admin manages legacy opportunity link reviews" ON public.legacy_opportunity_link_reviews FOR ALL USING (
  current_user_role() = 'admin'
) WITH CHECK (
  current_user_role() = 'admin'
);

CREATE INDEX IF NOT EXISTS idx_legacy_opportunity_import_rows_batch_id
  ON public.legacy_opportunity_import_rows (batch_id, source_row_number);

CREATE INDEX IF NOT EXISTS idx_legacy_opportunity_import_rows_review_status
  ON public.legacy_opportunity_import_rows (review_status);

CREATE INDEX IF NOT EXISTS idx_legacy_opportunity_match_candidates_import_row_id
  ON public.legacy_opportunity_match_candidates (import_row_id, confidence_score DESC);
