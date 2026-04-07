CREATE TABLE IF NOT EXISTS project_photos (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  weekly_update_id      uuid        REFERENCES weekly_updates(id) ON DELETE SET NULL,
  caption               text,
  filename              text        NOT NULL,
  content_type          text        NOT NULL DEFAULT 'image/jpeg',
  sharepoint_item_id    text        NOT NULL,
  sharepoint_drive_id   text        NOT NULL,
  sharepoint_web_url    text,
  taken_date            date,
  uploaded_by_profile_id uuid       REFERENCES profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_photos_project_id
  ON project_photos(project_id);
CREATE INDEX IF NOT EXISTS idx_project_photos_created_at
  ON project_photos(project_id, created_at DESC);
