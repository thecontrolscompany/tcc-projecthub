-- Phase 1: install and controls assembly catalogs backed by Supabase.

INSERT INTO public.platform_modules (id, name, description, route_prefix, is_core)
VALUES
  ('install_estimating', 'Installation Estimating', 'Installation labor/material assembly catalog and pricing.', '/estimating', false),
  ('controls_estimating', 'Controls Estimating', 'Controls hardware catalog, controls material and engineering labor pricing.', '/estimating', false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  route_prefix = EXCLUDED.route_prefix,
  is_core = EXCLUDED.is_core;

INSERT INTO public.organization_modules (organization_id, module_id, enabled)
SELECT org.id, module.id, true
FROM public.organizations org
CROSS JOIN public.platform_modules module
WHERE org.slug = 'tcc'
  AND module.id IN ('install_estimating', 'controls_estimating')
ON CONFLICT (organization_id, module_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.install_assembly_catalog (
  id              text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  description     text NOT NULL,
  mtl_unit        numeric(12,4) NOT NULL DEFAULT 0,
  mtl_per         text NOT NULL DEFAULT 'E',
  hrs_unit        numeric(10,4) NOT NULL DEFAULT 0,
  hrs_per         text NOT NULL DEFAULT 'E',
  category        text,
  freq            boolean NOT NULL DEFAULT false,
  alternate_ids   text[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id)
);

CREATE TABLE IF NOT EXISTS public.controls_assembly_catalog (
  id              text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  description     text NOT NULL,
  mtl_unit        numeric(12,4) NOT NULL DEFAULT 0,
  mtl_per         text NOT NULL DEFAULT 'E',
  hrs_unit        numeric(10,4) NOT NULL DEFAULT 0,
  hrs_per         text NOT NULL DEFAULT 'E',
  category        text,
  alternate_ids   text[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id)
);

ALTER TABLE public.install_assembly_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controls_assembly_catalog ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS install_assembly_catalog_org_idx ON public.install_assembly_catalog (organization_id);
CREATE INDEX IF NOT EXISTS controls_assembly_catalog_org_idx ON public.controls_assembly_catalog (organization_id);

DROP TRIGGER IF EXISTS trg_install_assembly_catalog_updated_at ON public.install_assembly_catalog;
CREATE TRIGGER trg_install_assembly_catalog_updated_at
  BEFORE UPDATE ON public.install_assembly_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_controls_assembly_catalog_updated_at ON public.controls_assembly_catalog;
CREATE TRIGGER trg_controls_assembly_catalog_updated_at
  BEFORE UPDATE ON public.controls_assembly_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "install_catalog_member_select" ON public.install_assembly_catalog
  FOR SELECT
  USING (
    organization_id = ANY(public.current_user_organization_ids())
    AND public.current_user_has_module('hvac_estimator')
    AND public.current_user_has_module('install_estimating')
  );

CREATE POLICY "controls_catalog_member_select" ON public.controls_assembly_catalog
  FOR SELECT
  USING (
    organization_id = ANY(public.current_user_organization_ids())
    AND public.current_user_has_module('hvac_estimator')
    AND public.current_user_has_module('controls_estimating')
  );

CREATE POLICY "install_catalog_admin_write" ON public.install_assembly_catalog
  FOR ALL
  USING (
    public.current_user_has_module('hvac_estimator')
    AND public.current_user_has_module('install_estimating')
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships membership
      WHERE membership.profile_id = auth.uid()
        AND membership.organization_id = install_assembly_catalog.organization_id
        AND membership.role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    public.current_user_has_module('hvac_estimator')
    AND public.current_user_has_module('install_estimating')
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships membership
      WHERE membership.profile_id = auth.uid()
        AND membership.organization_id = install_assembly_catalog.organization_id
        AND membership.role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "controls_catalog_admin_write" ON public.controls_assembly_catalog
  FOR ALL
  USING (
    public.current_user_has_module('hvac_estimator')
    AND public.current_user_has_module('controls_estimating')
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships membership
      WHERE membership.profile_id = auth.uid()
        AND membership.organization_id = controls_assembly_catalog.organization_id
        AND membership.role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    public.current_user_has_module('hvac_estimator')
    AND public.current_user_has_module('controls_estimating')
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships membership
      WHERE membership.profile_id = auth.uid()
        AND membership.organization_id = controls_assembly_catalog.organization_id
        AND membership.role IN ('owner', 'admin', 'manager')
    )
  );
