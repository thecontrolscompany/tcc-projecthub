-- Track the exact weekly-update version loaded by each editor so stale browser
-- tabs cannot silently overwrite a newer save from another user.
ALTER TABLE public.weekly_updates
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_weekly_updates_project_week_updated
  ON public.weekly_updates(project_id, week_of, updated_at DESC);
