-- TCC ProjectHub — Dev Seed Data
-- Run AFTER creating auth users in Supabase dashboard
-- Replace UUIDs with actual user IDs from auth.users

-- Step 1: Create these users in Supabase Auth dashboard first:
--   timothy@thecontrolscompany.com  (role: admin)
--   pm1@thecontrolscompany.com      (role: pm)
--   pm2@thecontrolscompany.com      (role: pm)
--   customer@example.com            (role: customer, email/password auth)

-- Step 2: Update profiles (trigger should auto-create them, just set roles):
-- update profiles set role = 'admin', full_name = 'Timothy Collins'
--   where email = 'timothy@thecontrolscompany.com';
-- update profiles set role = 'pm', full_name = 'Alex Rivera'
--   where email = 'pm1@thecontrolscompany.com';
-- update profiles set role = 'pm', full_name = 'Jordan Smith'
--   where email = 'pm2@thecontrolscompany.com';
-- update profiles set role = 'customer', full_name = 'Sample Customer'
--   where email = 'customer@example.com';

-- Step 3: Customers
insert into customers (name, contact_email) values
  ('Crestview K-8', 'billing@crestviewk8.edu'),
  ('Mobile Arena', 'contact@mobilearena.com'),
  ('Westside Medical Center', 'facilities@westsidemedical.com')
on conflict do nothing;

-- Step 4: Projects (use actual pm IDs)
-- insert into projects (customer_id, pm_id, name, estimated_income, onedrive_path) values
--   ((select id from customers where name = 'Crestview K-8'),
--    (select id from profiles where email = 'pm1@thecontrolscompany.com'),
--    'Crestview K-8 HVAC Renovation', 185000,
--    'Crestview K-8/Crestview K-8 POC Sheet.xlsx'),
--   ((select id from customers where name = 'Mobile Arena'),
--    (select id from profiles where email = 'pm2@thecontrolscompany.com'),
--    'Mobile Arena Controls Upgrade', 320000,
--    'Mobile Arena/Mobile Arena POC Sheet.xlsx'),
--   ((select id from customers where name = 'Westside Medical Center'),
--    (select id from profiles where email = 'pm1@thecontrolscompany.com'),
--    'Westside Med BAS Integration', 97500,
--    'Westside Medical Center/Westside Medical Center POC Sheet.xlsx');

-- Step 5: PM Directory
-- insert into pm_directory (profile_id, first_name, email) values
--   ((select id from profiles where email = 'pm1@thecontrolscompany.com'), 'Alex', 'pm1@thecontrolscompany.com'),
--   ((select id from profiles where email = 'pm2@thecontrolscompany.com'), 'Jordan', 'pm2@thecontrolscompany.com');

-- Step 6: Billing periods for March 2026
-- insert into billing_periods (period_month, project_id, estimated_income_snapshot, prior_pct, pct_complete, prev_billed) values
--   ('2026-03-01',
--    (select id from projects where name = 'Crestview K-8 HVAC Renovation'),
--    185000, 0.35, 0.50, 64750),
--   ('2026-03-01',
--    (select id from projects where name = 'Mobile Arena Controls Upgrade'),
--    320000, 0.20, 0.30, 64000),
--   ('2026-03-01',
--    (select id from projects where name = 'Westside Med BAS Integration'),
--    97500, 0.10, 0.25, 9750);
