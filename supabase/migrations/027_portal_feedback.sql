CREATE TABLE IF NOT EXISTS portal_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL REFERENCES profiles(id),
  type         text NOT NULL CHECK (type IN ('bug', 'feature', 'ux', 'other')),
  title        text NOT NULL,
  description  text NOT NULL,
  priority     text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  page_area    text,
  status       text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'planned', 'done', 'wont_fix')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE portal_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users insert feedback" ON portal_feedback;
CREATE POLICY "Authenticated users insert feedback"
  ON portal_feedback FOR INSERT
  WITH CHECK (submitted_by = auth.uid());

DROP POLICY IF EXISTS "Admin reads all feedback" ON portal_feedback;
CREATE POLICY "Admin reads all feedback"
  ON portal_feedback FOR ALL
  USING (current_user_role() IN ('admin', 'ops_manager'));

DROP POLICY IF EXISTS "User reads own feedback" ON portal_feedback;
CREATE POLICY "User reads own feedback"
  ON portal_feedback FOR SELECT
  USING (submitted_by = auth.uid());
