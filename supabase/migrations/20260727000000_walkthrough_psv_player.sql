ALTER TABLE project_walkthroughs
  ADD COLUMN player_type text NOT NULL DEFAULT 'insta360'
    CHECK (player_type IN ('insta360', 'psv')),
  ADD COLUMN video_url text,
  ADD COLUMN plan_url text,
  ADD COLUMN waypoints jsonb;

-- Insta360 rows require share_url in the application; PSV rows use video_url instead.
ALTER TABLE project_walkthroughs ALTER COLUMN share_url DROP NOT NULL;
