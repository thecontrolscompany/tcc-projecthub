-- Migration: project_walkthroughs
-- Stores links to Insta360 cloud walkthrough videos per project. Hosting stays on
-- Insta360; customers see TCC-branded cards that open the share player in a new tab.
-- Admin/ops enter share URLs; the app scrapes title/duration/cover from the share page.

CREATE TABLE project_walkthroughs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  share_url text NOT NULL,
  media_id text,                 -- parsed from ?mediaId=
  title text,                    -- from og:title
  duration text,                 -- from og:description ("Video duration: 09:16")
  cover_image_url text,          -- from og:image / twitter:image
  recorded_date date,            -- walkthrough date; defaults to today on insert
  created_at timestamptz DEFAULT now()
);

CREATE INDEX project_walkthroughs_project_idx ON project_walkthroughs (project_id);

ALTER TABLE project_walkthroughs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to project_walkthroughs"
  ON project_walkthroughs FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY "Ops manager full access to project_walkthroughs"
  ON project_walkthroughs FOR ALL
  USING (current_user_role() = 'ops_manager');

CREATE POLICY "Customer reads walkthroughs for accessible projects"
  ON project_walkthroughs FOR SELECT
  USING (
    current_user_role() = 'customer' AND
    EXISTS (
      SELECT 1 FROM project_customer_contacts pcc
      WHERE pcc.project_id = project_walkthroughs.project_id
        AND pcc.profile_id = auth.uid()
        AND pcc.portal_access = true
    )
  );
