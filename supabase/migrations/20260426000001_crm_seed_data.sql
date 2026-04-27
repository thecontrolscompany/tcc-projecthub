-- ==============================================================
-- CRM SEED DATA — 5 accounts, 19 contacts
-- Uses a CTE so account UUIDs are resolved before contact inserts,
-- all within a single transaction.
-- ==============================================================

WITH inserted_accounts AS (
  INSERT INTO public.crm_accounts
    (company_name, type, status, relationship_health,
     who_buys, who_issues_po, who_influences_spec, who_owns_estimating_relationship)
  VALUES
    ('Engineered Cooling Services', 'mechanical_contractor', 'active', 'good',
     'Operations Manager / Ownership', 'Operations Manager',
     'Senior PM / Salesperson', 'Jack Heaney'),
    ('ST Controls',                 'controls_contractor',   'active', 'strong',
     'Owner',                        'Owner / CFO',
     'Owner',                        'Sean Turbeville'),
    ('Johnson Controls',            'controls_oem',          'active', 'good',
     'Sales Manager',                'Sales Team',
     'Sales Manager / Salesperson',  'Zane Eubanks / Vaughn Bryan'),
    ('Trane',                       'hvac_oem',              'active', 'good',
     'Sales / PM Team',             'PM Team',
     'Senior PM / Estimator',        'Troy David'),
    ('Siemens',                     'controls_oem',          'active', 'good',
     'Sales Team',                   'PM Team',
     'Salesperson',                  'Jim Page')
  RETURNING id, company_name
),

ecs     AS (SELECT id FROM inserted_accounts WHERE company_name = 'Engineered Cooling Services'),
stc     AS (SELECT id FROM inserted_accounts WHERE company_name = 'ST Controls'),
jci     AS (SELECT id FROM inserted_accounts WHERE company_name = 'Johnson Controls'),
trane   AS (SELECT id FROM inserted_accounts WHERE company_name = 'Trane'),
siemens AS (SELECT id FROM inserted_accounts WHERE company_name = 'Siemens')

INSERT INTO public.crm_contacts
  (account_id, first_name, last_name, display_name, role_type,
   influence_level, confidence_level,
   issues_purchase_orders, involved_in_estimating, involved_in_project_execution)
SELECT
  acct_id, first_name, last_name, display_name, role_type,
  influence_level, confidence_level,
  issues_po, involved_estimating, involved_execution
FROM (

  -- Engineered Cooling Services
  SELECT (SELECT id FROM ecs) AS acct_id,
         'Alessa'  AS first_name, 'Smith'   AS last_name, 'Alessa Smith'   AS display_name,
         'sales_manager'       AS role_type,
         'medium'              AS influence_level,
         'partially_confirmed' AS confidence_level,
         false AS issues_po, false AS involved_estimating, false AS involved_execution

  UNION ALL SELECT (SELECT id FROM ecs),
         'Jack', 'Heaney', 'Jack Heaney',
         'salesperson', 'high', 'confirmed',
         false, false, false

  UNION ALL SELECT (SELECT id FROM ecs),
         'Stanton', 'Bergen', 'Stanton Bergen',
         'unknown', 'low', 'needs_verification',
         false, false, false

  UNION ALL SELECT (SELECT id FROM ecs),
         'Mike', 'Hamrac', 'Mike Hamrac',
         'operations_manager', 'high', 'confirmed',
         true, false, true

  UNION ALL SELECT (SELECT id FROM ecs),
         'Blaine', 'Ivy', 'Blaine Ivy',
         'project_manager', 'high', 'confirmed',
         false, false, true

  -- ST Controls
  UNION ALL SELECT (SELECT id FROM stc),
         'Sean', 'Turbeville', 'Sean Turbeville',
         'owner', 'high', 'confirmed',
         true, false, false

  UNION ALL SELECT (SELECT id FROM stc),
         'Jennifer', 'Workman', 'Jennifer Workman',
         'cfo_estimator', 'high', 'confirmed',
         true, true, false

  -- Johnson Controls
  UNION ALL SELECT (SELECT id FROM jci),
         'Zane', 'Eubanks', 'Zane Eubanks',
         'salesperson', 'high', 'confirmed',
         false, false, false

  UNION ALL SELECT (SELECT id FROM jci),
         'Vaughn', 'Bryan', 'Vaughn Bryan',
         'salesperson', 'high', 'confirmed',
         false, false, false

  UNION ALL SELECT (SELECT id FROM jci),
         'Chason', 'Milner', 'Chason Milner',
         'salesperson', 'medium', 'partially_confirmed',
         false, false, false

  UNION ALL SELECT (SELECT id FROM jci),
         NULL, 'McReynolds', 'McReynolds',
         'sales_manager', 'low', 'needs_verification',
         false, false, false

  UNION ALL SELECT (SELECT id FROM jci),
         'Madison', NULL, 'Madison',
         'operations_manager', 'low', 'needs_verification',
         false, false, true

  -- Trane
  UNION ALL SELECT (SELECT id FROM trane),
         'Tom', 'Mondy', 'Tom Mondy',
         'senior_project_manager', 'high', 'confirmed',
         false, false, true

  UNION ALL SELECT (SELECT id FROM trane),
         'Chris', 'Favre', 'Chris Favre',
         'project_manager', 'medium', 'partially_confirmed',
         false, false, true

  UNION ALL SELECT (SELECT id FROM trane),
         'Heath', 'Carroll', 'Heath Carroll',
         'project_manager', 'high', 'confirmed',
         false, false, true

  UNION ALL SELECT (SELECT id FROM trane),
         'Troy', 'David', 'Troy David',
         'estimator', 'high', 'confirmed',
         false, true, false

  -- Siemens
  UNION ALL SELECT (SELECT id FROM siemens),
         'Jim', 'Page', 'Jim Page',
         'salesperson', 'high', 'confirmed',
         false, false, false

  UNION ALL SELECT (SELECT id FROM siemens),
         'Joe', 'Williams', 'Joe Williams',
         'project_manager', 'high', 'confirmed',
         false, false, true

) contacts_data;
