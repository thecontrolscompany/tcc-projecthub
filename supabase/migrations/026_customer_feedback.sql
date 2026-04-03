CREATE TABLE IF NOT EXISTS customer_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message      text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed     boolean NOT NULL DEFAULT false
);

ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer inserts own feedback" ON customer_feedback;
CREATE POLICY "Customer inserts own feedback"
  ON customer_feedback FOR INSERT
  WITH CHECK (profile_id = auth.uid() AND current_user_role() = 'customer');

DROP POLICY IF EXISTS "Customer reads own feedback" ON customer_feedback;
CREATE POLICY "Customer reads own feedback"
  ON customer_feedback FOR SELECT
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Admin full access to customer_feedback" ON customer_feedback;
CREATE POLICY "Admin full access to customer_feedback"
  ON customer_feedback FOR ALL
  USING (current_user_role() IN ('admin', 'ops_manager'));
