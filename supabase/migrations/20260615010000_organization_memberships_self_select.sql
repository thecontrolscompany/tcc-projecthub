-- organization_memberships has row-level security enabled but no SELECT
-- policy. With zero policies, the table is invisible to the `authenticated`
-- role entirely -- including via EXISTS subqueries inside other tables'
-- *_admin_write policies (e.g. controls_assembly_catalog_admin_write,
-- estimator_controls_defaults_admin_write), which directly query
-- organization_memberships to check the caller's role. This makes those
-- admin-write policies always evaluate to false, regardless of the caller's
-- actual role.
--
-- Add a self-row SELECT policy so a user can see their own membership rows
-- (their own organization_id/role), which is exactly what those EXISTS
-- checks need and is safe to expose.

ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organization_memberships_self_select" ON public.organization_memberships;

CREATE POLICY "organization_memberships_self_select"
  ON public.organization_memberships
  FOR SELECT
  USING (profile_id = auth.uid());
