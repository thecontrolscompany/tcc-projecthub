-- 048_pursuit_everywhere.sql
--
-- Enforces the invariant: every opportunity (quote_request) has a pursuit.
--
-- 1. Add pursuit_id to legacy import rows so staged packages track their pursuit.
-- 2. Backfill a pursuit for every existing quote_request that has none.

-- Step 1: track pursuit on import rows (created after extraction, before promotion)
ALTER TABLE public.legacy_opportunity_import_rows
  ADD COLUMN IF NOT EXISTS pursuit_id uuid REFERENCES public.pursuits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_legacy_import_rows_pursuit_id
  ON public.legacy_opportunity_import_rows (pursuit_id);

-- Step 2: backfill pursuits for orphaned quote_requests
DO $$
DECLARE
  r RECORD;
  new_id uuid;
BEGIN
  FOR r IN
    SELECT id, company_name, project_name, site_address, status, created_at, updated_at
    FROM public.quote_requests
    WHERE pursuit_id IS NULL
    ORDER BY created_at
  LOOP
    INSERT INTO public.pursuits (
      project_name,
      owner_name,
      project_location,
      status,
      created_at,
      updated_at
    )
    VALUES (
      COALESCE(NULLIF(TRIM(r.project_name), ''), r.company_name, 'Unknown Project'),
      r.company_name,
      r.site_address,
      CASE r.status
        WHEN 'won'  THEN 'awarded'
        WHEN 'lost' THEN 'lost'
        ELSE 'active'
      END,
      r.created_at,
      r.updated_at
    )
    RETURNING id INTO new_id;

    UPDATE public.quote_requests SET pursuit_id = new_id WHERE id = r.id;
  END LOOP;
END $$;
