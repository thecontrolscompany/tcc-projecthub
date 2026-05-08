DROP POLICY IF EXISTS "estimates_own_select" ON public.estimates;
DROP POLICY IF EXISTS "estimates_own_insert" ON public.estimates;
DROP POLICY IF EXISTS "estimates_own_update" ON public.estimates;
DROP POLICY IF EXISTS "estimates_own_delete" ON public.estimates;
DROP POLICY IF EXISTS "estimates_privileged_select" ON public.estimates;
DROP POLICY IF EXISTS "estimates_privileged_all" ON public.estimates;
DROP POLICY IF EXISTS "estimates_pm_lead_linked_opportunity_select" ON public.estimates;

CREATE POLICY "estimates_member_select"
  ON public.estimates
  FOR SELECT
  USING (
    organization_id = ANY(public.current_user_organization_ids())
    AND public.current_user_has_module('hvac_estimator')
  );

CREATE POLICY "estimates_member_insert"
  ON public.estimates
  FOR INSERT
  WITH CHECK (
    organization_id = ANY(public.current_user_organization_ids())
    AND owner_id = auth.uid()
    AND public.current_user_has_module('hvac_estimator')
  );

CREATE POLICY "estimates_owner_update"
  ON public.estimates
  FOR UPDATE
  USING (
    organization_id = ANY(public.current_user_organization_ids())
    AND owner_id = auth.uid()
    AND public.current_user_has_module('hvac_estimator')
  )
  WITH CHECK (
    organization_id = ANY(public.current_user_organization_ids())
    AND owner_id = auth.uid()
    AND public.current_user_has_module('hvac_estimator')
  );

CREATE POLICY "estimates_org_admin_update"
  ON public.estimates
  FOR UPDATE
  USING (
    public.current_user_has_module('hvac_estimator')
    AND EXISTS (
      SELECT 1
      FROM public.organization_memberships membership
      WHERE membership.profile_id = auth.uid()
        AND membership.organization_id = estimates.organization_id
        AND membership.role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    public.current_user_has_module('hvac_estimator')
    AND EXISTS (
      SELECT 1
      FROM public.organization_memberships membership
      WHERE membership.profile_id = auth.uid()
        AND membership.organization_id = estimates.organization_id
        AND membership.role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "estimates_owner_delete"
  ON public.estimates
  FOR DELETE
  USING (
    organization_id = ANY(public.current_user_organization_ids())
    AND owner_id = auth.uid()
    AND public.current_user_has_module('hvac_estimator')
  );

CREATE POLICY "estimates_org_admin_delete"
  ON public.estimates
  FOR DELETE
  USING (
    public.current_user_has_module('hvac_estimator')
    AND EXISTS (
      SELECT 1
      FROM public.organization_memberships membership
      WHERE membership.profile_id = auth.uid()
        AND membership.organization_id = estimates.organization_id
        AND membership.role IN ('owner', 'admin', 'manager')
    )
  );
