ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS migration_status TEXT
    CHECK (migration_status IN ('legacy', 'migrated', 'clean'))
    DEFAULT 'clean';

COMMENT ON COLUMN projects.migration_status IS
  'legacy = migrated from OneDrive, files in /99 Archive; migrated = clean structure applied; clean = created fresh in platform';
