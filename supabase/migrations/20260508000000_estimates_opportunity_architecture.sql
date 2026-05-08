ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS linked_opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'ready', 'proposal_exported', 'awarded', 'archived')),
  ADD COLUMN IF NOT EXISTS total_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS gross_margin_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS gross_margin_pct numeric(5,4),
  ADD COLUMN IF NOT EXISTS proposal_exported_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimate_ready_at timestamptz;

CREATE INDEX IF NOT EXISTS estimates_linked_opportunity_id_idx
  ON public.estimates (linked_opportunity_id)
  WHERE linked_opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS estimates_status_updated_at_idx
  ON public.estimates (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS estimates_owner_opportunity_updated_at_idx
  ON public.estimates (owner_id, linked_opportunity_id, updated_at DESC)
  WHERE linked_opportunity_id IS NOT NULL;

DROP POLICY IF EXISTS "estimates_privileged_all" ON public.estimates;
CREATE POLICY "estimates_privileged_all"
  ON public.estimates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'ops_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'ops_manager')
    )
  );

DROP POLICY IF EXISTS "estimates_pm_lead_linked_opportunity_select" ON public.estimates;
CREATE POLICY "estimates_pm_lead_linked_opportunity_select"
  ON public.estimates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('pm', 'lead')
    )
    AND linked_opportunity_id IS NOT NULL
  );
