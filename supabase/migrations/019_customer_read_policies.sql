-- Migration 019: Customer RLS for weekly_updates and billing_periods
-- Customers can read data for projects where they have portal_access = true

CREATE POLICY "Customer reads updates for accessible projects"
  ON weekly_updates FOR SELECT
  USING (
    current_user_role() = 'customer' AND
    EXISTS (
      SELECT 1 FROM project_customer_contacts pcc
      WHERE pcc.project_id = weekly_updates.project_id
        AND pcc.profile_id = auth.uid()
        AND pcc.portal_access = true
    )
  );

CREATE POLICY "Customer reads billing for accessible projects"
  ON billing_periods FOR SELECT
  USING (
    current_user_role() = 'customer' AND
    EXISTS (
      SELECT 1 FROM project_customer_contacts pcc
      WHERE pcc.project_id = billing_periods.project_id
        AND pcc.profile_id = auth.uid()
        AND pcc.portal_access = true
    )
  );
