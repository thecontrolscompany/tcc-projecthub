CREATE TABLE IF NOT EXISTS public.estimator_controls_defaults (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  component_key text NOT NULL,
  controls_catalog_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, component_key),
  CONSTRAINT estimator_controls_defaults_controls_catalog_fk
    FOREIGN KEY (organization_id, controls_catalog_id)
    REFERENCES public.controls_assembly_catalog (organization_id, id)
    ON DELETE CASCADE
);

ALTER TABLE public.estimator_controls_defaults ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS estimator_controls_defaults_organization_id_idx
  ON public.estimator_controls_defaults (organization_id);

DROP TRIGGER IF EXISTS trg_estimator_controls_defaults_updated_at ON public.estimator_controls_defaults;
CREATE TRIGGER trg_estimator_controls_defaults_updated_at
  BEFORE UPDATE ON public.estimator_controls_defaults
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "estimator_controls_defaults_member_select" ON public.estimator_controls_defaults;
DROP POLICY IF EXISTS "estimator_controls_defaults_admin_write" ON public.estimator_controls_defaults;

CREATE POLICY "estimator_controls_defaults_member_select"
  ON public.estimator_controls_defaults
  FOR SELECT
  USING (
    organization_id = ANY(public.current_user_organization_ids())
    AND public.current_user_has_module('hvac_estimator')
    AND public.current_user_has_module('controls_estimating')
  );

CREATE POLICY "estimator_controls_defaults_admin_write"
  ON public.estimator_controls_defaults
  FOR ALL
  USING (
    public.current_user_has_module('hvac_estimator')
    AND public.current_user_has_module('controls_estimating')
    AND EXISTS (
      SELECT 1
      FROM public.organization_memberships membership
      WHERE membership.profile_id = auth.uid()
        AND membership.organization_id = estimator_controls_defaults.organization_id
        AND membership.role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    public.current_user_has_module('hvac_estimator')
    AND public.current_user_has_module('controls_estimating')
    AND EXISTS (
      SELECT 1
      FROM public.organization_memberships membership
      WHERE membership.profile_id = auth.uid()
        AND membership.organization_id = estimator_controls_defaults.organization_id
        AND membership.role IN ('owner', 'admin', 'manager')
    )
  );
