-- ============================================================
-- TCC ProjectHub — Sprint 2026-04-03 POST-SPRINT
-- Adds feedback tables created by task-050.
-- Safe to run multiple times (IF NOT EXISTS / DROP IF EXISTS).
-- Paste into Supabase SQL Editor and run.
-- ============================================================

-- ── Customer Feedback (RLS policies for existing table) ──────

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

-- ── Portal Feedback (new table from task-050) ─────────────────

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
