-- 1. Add status column to weekly_updates
ALTER TABLE weekly_updates
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted'
  CHECK (status IN ('draft', 'submitted'));

-- 2. Mark all existing rows as submitted (they were submitted at time of insert)
UPDATE weekly_updates SET status = 'submitted' WHERE status IS NULL;

-- 3. Edit audit log
CREATE TABLE IF NOT EXISTS weekly_update_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_update_id uuid NOT NULL REFERENCES weekly_updates(id) ON DELETE CASCADE,
  edited_by_profile_id uuid REFERENCES profiles(id),
  edited_at timestamptz NOT NULL DEFAULT now(),
  editor_name text,
  note text
);

CREATE INDEX IF NOT EXISTS idx_weekly_update_edits_update_id
  ON weekly_update_edits(weekly_update_id);
