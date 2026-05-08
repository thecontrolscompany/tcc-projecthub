CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trial', 'suspended', 'archived')),
  billing_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_modules (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  route_prefix text NOT NULL,
  is_core boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_modules (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_id text NOT NULL REFERENCES public.platform_modules(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  enabled_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (organization_id, module_id)
);

CREATE TABLE IF NOT EXISTS public.organization_memberships (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'manager', 'member', 'customer')),
  module_roles jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, profile_id)
);

INSERT INTO public.platform_modules (id, name, description, route_prefix, is_core)
VALUES
  ('platform', 'Platform Shell', 'Shared auth, users, settings, navigation, and tenant administration.', '/', true),
  ('crm', 'CRM', 'Accounts, contacts, opportunities, pursuits, and quote intake.', '/crm', false),
  ('hvac_estimator', 'HVAC Estimator', 'Assembly-driven HVAC controls estimating, proposals, and estimate baselines.', '/estimating', false),
  ('projecthub', 'ProjectHub', 'Awarded project management, weekly updates, POC, RFIs, BOM, and closeout.', '/pm', false),
  ('billing', 'BillingHub', 'Billing periods, percent complete, invoices, and revenue tracking.', '/billing', false),
  ('time', 'TimeHub', 'Time entry, reconciliation, project hours, and employee hours.', '/time', false),
  ('documents', 'Documents', 'SharePoint-backed document organization and file workflows.', '/documents', false),
  ('analytics', 'Analytics', 'Dashboards, reporting, and Power BI surfaces.', '/analytics', false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  route_prefix = EXCLUDED.route_prefix,
  is_core = EXCLUDED.is_core;

INSERT INTO public.organizations (slug, name, status)
VALUES ('tcc', 'The Controls Company', 'active')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.organization_modules (organization_id, module_id, enabled)
SELECT org.id, module.id, true
FROM public.organizations org
CROSS JOIN public.platform_modules module
WHERE org.slug = 'tcc'
ON CONFLICT (organization_id, module_id) DO NOTHING;

INSERT INTO public.organization_memberships (organization_id, profile_id, role, is_default)
SELECT org.id, profiles.id,
  CASE
    WHEN profiles.role IN ('admin', 'ops_manager') THEN 'admin'
    WHEN profiles.role = 'customer' THEN 'customer'
    ELSE 'member'
  END,
  true
FROM public.organizations org
CROSS JOIN public.profiles
WHERE org.slug = 'tcc'
ON CONFLICT (organization_id, profile_id) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

UPDATE public.profiles
SET default_organization_id = org.id
FROM public.organizations org
WHERE org.slug = 'tcc'
  AND public.profiles.default_organization_id IS NULL;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.pm_directory
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.billing_periods
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.weekly_updates
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.pursuits
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.crm_accounts
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.crm_opportunities
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.crm_opportunity_contacts
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.crm_activities
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.crm_salesperson_targets
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

DO $$
DECLARE
  default_org_id uuid;
BEGIN
  SELECT id INTO default_org_id FROM public.organizations WHERE slug = 'tcc';

  UPDATE public.customers SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.projects SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.pm_directory SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.billing_periods SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.weekly_updates SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.estimates SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.pursuits SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.quote_requests SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.crm_accounts SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.crm_contacts SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.crm_opportunities SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.crm_opportunity_contacts SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.crm_activities SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.crm_tasks SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.crm_salesperson_targets SET organization_id = default_org_id WHERE organization_id IS NULL;
END $$;

CREATE INDEX IF NOT EXISTS customers_organization_id_idx ON public.customers (organization_id);
CREATE INDEX IF NOT EXISTS projects_organization_id_idx ON public.projects (organization_id);
CREATE INDEX IF NOT EXISTS estimates_organization_id_updated_at_idx ON public.estimates (organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS pursuits_organization_id_idx ON public.pursuits (organization_id);
CREATE INDEX IF NOT EXISTS quote_requests_organization_id_idx ON public.quote_requests (organization_id);
CREATE INDEX IF NOT EXISTS crm_accounts_organization_id_idx ON public.crm_accounts (organization_id);
CREATE INDEX IF NOT EXISTS crm_contacts_organization_id_idx ON public.crm_contacts (organization_id);
CREATE INDEX IF NOT EXISTS crm_opportunities_organization_id_idx ON public.crm_opportunities (organization_id);
CREATE INDEX IF NOT EXISTS crm_activities_organization_id_idx ON public.crm_activities (organization_id);
CREATE INDEX IF NOT EXISTS crm_tasks_organization_id_idx ON public.crm_tasks (organization_id);

CREATE OR REPLACE FUNCTION public.current_user_organization_ids()
RETURNS uuid[] LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(array_agg(organization_id), '{}'::uuid[])
  FROM public.organization_memberships
  WHERE profile_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_default_organization_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT default_organization_id FROM public.profiles WHERE id = auth.uid()),
    (SELECT organization_id FROM public.organization_memberships WHERE profile_id = auth.uid() ORDER BY is_default DESC, created_at ASC LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_module(module_key text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships membership
    JOIN public.organization_modules module
      ON module.organization_id = membership.organization_id
     AND module.enabled = true
    WHERE membership.profile_id = auth.uid()
      AND module.module_id = module_key
  );
$$;
