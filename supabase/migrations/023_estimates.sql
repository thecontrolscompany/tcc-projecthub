CREATE TABLE IF NOT EXISTS public.estimates (
  id                text PRIMARY KEY,
  owner_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body              jsonb NOT NULL,
  name              text GENERATED ALWAYS AS (body->>'name') STORED,
  number            text GENERATED ALWAYS AS (body->>'number') STORED,
  archived          boolean NOT NULL DEFAULT false,
  linked_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estimates_owner_id_updated_at_idx
  ON public.estimates (owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS estimates_linked_project_id_idx
  ON public.estimates (linked_project_id)
  WHERE linked_project_id IS NOT NULL;

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimates_own_select"
  ON public.estimates
  FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "estimates_own_insert"
  ON public.estimates
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "estimates_own_update"
  ON public.estimates
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "estimates_own_delete"
  ON public.estimates
  FOR DELETE
  USING (auth.uid() = owner_id);

CREATE POLICY "estimates_privileged_select"
  ON public.estimates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'ops_manager')
    )
  );
