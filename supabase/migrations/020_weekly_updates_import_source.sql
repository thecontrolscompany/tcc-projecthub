-- Track where each weekly update came from so imports can be purged independently
ALTER TABLE weekly_updates
  ADD COLUMN IF NOT EXISTS imported_from text; -- original filename, null for manually entered
