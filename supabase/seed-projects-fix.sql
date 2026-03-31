-- Fix: update projects using wildcard match (names include job number prefix)

UPDATE projects SET
  estimated_income = 27048.06,
  customer_id = (SELECT id FROM customers WHERE name = 'HHH Contractors')
WHERE name ILIKE '%Triple H Labor%';

UPDATE projects SET
  estimated_income = 34950,
  customer_id = (SELECT id FROM customers WHERE name = 'CSUSA')
WHERE name ILIKE '%Arena Toilet Controls%';

UPDATE projects SET
  estimated_income = 120239,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
WHERE name ILIKE '%Cytiva Belt 8%';

UPDATE projects SET
  estimated_income = 135357,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
WHERE name ILIKE '%Daphne Elementary South%';

UPDATE projects SET
  estimated_income = 69646,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
WHERE name ILIKE '%Daphne HS Additions%';

UPDATE projects SET
  estimated_income = 14879,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
WHERE name ILIKE '%Eastern Shore Transportation%';

UPDATE projects SET
  estimated_income = 63798,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
WHERE name ILIKE '%Elberta Elementary%';

UPDATE projects SET
  estimated_income = 144635,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
WHERE name ILIKE '%Elberta Middle School%';

UPDATE projects SET
  estimated_income = 23014,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
WHERE name ILIKE '%Magnolia Elementary%';

UPDATE projects SET
  estimated_income = 642450,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
WHERE name ILIKE '%Mobile Arena%';

UPDATE projects SET
  estimated_income = 17231,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
WHERE name ILIKE '%Robertsdale Elementary%';

UPDATE projects SET
  estimated_income = 338832,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
WHERE name ILIKE '%Soundside High School%';

UPDATE projects SET
  estimated_income = 75003,
  customer_id = (SELECT id FROM customers WHERE name = 'Johnson Controls')
WHERE name ILIKE '%SOF Human Performance%';

UPDATE projects SET
  estimated_income = 49080,
  customer_id = (SELECT id FROM customers WHERE name = 'Moses Electric')
WHERE name ILIKE '%Titan Lighting%';

UPDATE projects SET
  estimated_income = 382198,
  customer_id = (SELECT id FROM customers WHERE name = 'RQ Construction')
WHERE name ILIKE '%Hurlburt Dorms%';

UPDATE projects SET
  estimated_income = 42247,
  customer_id = (SELECT id FROM customers WHERE name = 'Siemens Industry')
WHERE name ILIKE '%NAS%';

UPDATE projects SET
  estimated_income = 307512,
  customer_id = (SELECT id FROM customers WHERE name = 'Trane U.S. Inc.')
WHERE name ILIKE '%Crestview Elementary%';

UPDATE projects SET
  estimated_income = 78723,
  customer_id = (SELECT id FROM customers WHERE name = 'Trane U.S. Inc.')
WHERE name ILIKE '%Destin Elementary%';

UPDATE projects SET
  estimated_income = 71206,
  customer_id = (SELECT id FROM customers WHERE name = 'Trane U.S. Inc.')
WHERE name ILIKE '%Eglin Wildcat%';

UPDATE projects SET
  estimated_income = 33151,
  customer_id = (SELECT id FROM customers WHERE name = 'Trane U.S. Inc.')
WHERE name ILIKE '%Pivotal Healthcare%';

UPDATE projects SET
  estimated_income = 45334,
  customer_id = (SELECT id FROM customers WHERE name = 'Trane U.S. Inc.')
WHERE name ILIKE '%Rutherford High School%';

UPDATE projects SET
  estimated_income = 70963,
  customer_id = (SELECT id FROM customers WHERE name = 'Trane U.S. Inc.')
WHERE name ILIKE '%Titan Hangar 3%';

UPDATE projects SET
  estimated_income = 1596000,
  customer_id = (SELECT id FROM customers WHERE name = 'USAF')
WHERE name ILIKE '%Eglin 1416%';

UPDATE projects SET
  estimated_income = 43773,
  customer_id = (SELECT id FROM customers WHERE name = 'Walters Controls')
WHERE name ILIKE '%Eglin Airman%';

-- After updating projects, sync estimated_income_snapshot in billing_periods
UPDATE billing_periods bp
SET estimated_income_snapshot = p.estimated_income
FROM projects p
WHERE bp.project_id = p.id
AND p.estimated_income > 0;

