-- ops_manager needs SELECT on projects and billing_periods for analytics
CREATE POLICY "Ops manager reads all projects select" ON projects FOR SELECT USING (
  current_user_role() = 'ops_manager'
);

CREATE POLICY "Ops manager reads billing periods select" ON billing_periods FOR SELECT USING (
  current_user_role() = 'ops_manager'
);
