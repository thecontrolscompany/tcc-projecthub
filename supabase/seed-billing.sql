-- TCC ProjectHub - Billing Seed
-- Run this after the SharePoint migration to create initial billing periods
-- for all active projects. Run in Supabase SQL Editor.
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING).

INSERT INTO customers (id, name, contact_email)
VALUES ('00000000-0000-0000-0000-000000000001', 'Sample Customer', 'customer@example.com')
ON CONFLICT DO NOTHING;

-- After Timothy creates a PM user in Supabase Auth dashboard,
-- run this to add them to pm_directory:
-- INSERT INTO pm_directory (profile_id, first_name, email)
-- VALUES ('<pm-user-id>', 'First', 'pm@controlsco.net');

INSERT INTO billing_periods (project_id, period_month, estimated_income_snapshot, pct_complete, prev_billed)
SELECT
  p.id,
  date_trunc('month', CURRENT_DATE)::date,
  COALESCE(p.estimated_income, 0),
  0,
  0
FROM projects p
WHERE p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM billing_periods bp
    WHERE bp.project_id = p.id
      AND bp.period_month = date_trunc('month', CURRENT_DATE)::date
  )
ON CONFLICT (project_id, period_month) DO NOTHING;
