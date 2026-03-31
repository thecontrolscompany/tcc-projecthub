-- 1. Insert customers
INSERT INTO customers (name) VALUES
  ('HHH Contractors'),
  ('CSUSA'),
  ('Engineered Cooling Services'),
  ('Johnson Controls'),
  ('Moses Electric'),
  ('RQ Construction'),
  ('Siemens Industry'),
  ('Trane U.S. Inc.'),
  ('USAF'),
  ('Walters Controls')
ON CONFLICT DO NOTHING;

-- 2. Insert PM directory
INSERT INTO pm_directory (email, first_name) VALUES
  ('jnoa@engcool.com', 'Jarett'),
  ('bivey@engcool.com', 'Blane'),
  ('nbaker@engcool.com', 'Nick'),
  ('jadcock@engcool.com', 'Jason'),
  ('bhicks@engcool.com', 'Brian'),
  ('alan.preble@jci.com', 'Alan'),
  ('jimmy.williams@siemens.com', 'Bo'),
  ('wayne.foster@siemens.com', 'LaWayne'),
  ('chris.favre@trane.com', 'Chris'),
  ('ashleyh.carroll@trane.com', 'Heath'),
  ('robert.harman@trane.com', 'RJ'),
  ('thomas.mondi@tranetechnologies.com', 'Tom'),
  ('sagnew@trane.com', 'Scott'),
  ('richard@walterscontrols.net', 'Richard'),
  ('bdrummond@engineeredcooling.com', 'Brandon'),
  ('steve.guess@walterscontrols.net', 'Steve')
ON CONFLICT (email) DO NOTHING;

-- 3. Update projects with estimated_income and customer_id
UPDATE projects SET
  estimated_income = 27048.06,
  customer_id = (SELECT id FROM customers WHERE name = 'HHH Contractors')
WHERE name ILIKE 'Triple H Labor';

UPDATE projects SET
  estimated_income = 34950,
  customer_id = (SELECT id FROM customers WHERE name = 'CSUSA')
WHERE name ILIKE 'Arena Toilet Controls';

UPDATE projects SET
  estimated_income = 120239,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
  -- pm: jnoa@engcool.com
WHERE name ILIKE 'Cytiva Belt 8';

UPDATE projects SET
  estimated_income = 135357,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
  -- pm: bivey@engcool.com
WHERE name ILIKE 'Daphne Elementary South';

UPDATE projects SET
  estimated_income = 69646,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
WHERE name ILIKE 'Daphne HS Additions';

UPDATE projects SET
  estimated_income = 14879,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
  -- pm: bivey@engcool.com
WHERE name ILIKE 'Eastern Shore Transportation';

UPDATE projects SET
  estimated_income = 63798,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
  -- pm: bivey@engcool.com
WHERE name ILIKE 'Elberta Elementary';

UPDATE projects SET
  estimated_income = 144635,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
  -- pm: bivey@engcool.com
WHERE name ILIKE 'Elberta Middle School';

UPDATE projects SET
  estimated_income = 23014,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
  -- pm: bivey@engcool.com
WHERE name ILIKE 'Magnolia Elementary';

UPDATE projects SET
  estimated_income = 642450,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
WHERE name ILIKE 'Mobile Arena';

UPDATE projects SET
  estimated_income = 17231,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
  -- pm: bivey@engcool.com
WHERE name ILIKE 'Robertsdale Elementary';

UPDATE projects SET
  estimated_income = 338832,
  customer_id = (SELECT id FROM customers WHERE name = 'Engineered Cooling Services')
  -- pm: jnoa@engcool.com
WHERE name ILIKE 'Soundside High School';

UPDATE projects SET
  estimated_income = 75003,
  customer_id = (SELECT id FROM customers WHERE name = 'Johnson Controls')
WHERE name ILIKE 'SOF Human Performance';

UPDATE projects SET
  estimated_income = 49080,
  customer_id = (SELECT id FROM customers WHERE name = 'Moses Electric')
WHERE name ILIKE 'Titan Lighting';

UPDATE projects SET
  estimated_income = 382198,
  customer_id = (SELECT id FROM customers WHERE name = 'RQ Construction')
WHERE name ILIKE 'Hurlburt Dorms B90369';

UPDATE projects SET
  estimated_income = 42247,
  customer_id = (SELECT id FROM customers WHERE name = 'Siemens Industry')
  -- pm: jimmy.williams@siemens.com
WHERE name ILIKE 'NAS Fitness Center';

UPDATE projects SET
  estimated_income = 307512,
  customer_id = (SELECT id FROM customers WHERE name = 'Trane U.S. Inc.')
  -- pm: Chris.Favre@trane.com
WHERE name ILIKE 'Crestview Elementary';

UPDATE projects SET
  estimated_income = 78723,
  customer_id = (SELECT id FROM customers WHERE name = 'Trane U.S. Inc.')
  -- pm: Thomas.Mondi@tranetechnologies.com
WHERE name ILIKE 'Destin Elementary';

UPDATE projects SET
  estimated_income = 71206,
  customer_id = (SELECT id FROM customers WHERE name = 'Trane U.S. Inc.')
  -- pm: Chris.Favre@trane.com
WHERE name ILIKE 'Eglin Wildcat Facility';

UPDATE projects SET
  estimated_income = 33151,
  customer_id = (SELECT id FROM customers WHERE name = 'Trane U.S. Inc.')
  -- pm: Chris.Favre@trane.com
WHERE name ILIKE 'Pivotal Healthcare';

UPDATE projects SET
  estimated_income = 45334,
  customer_id = (SELECT id FROM customers WHERE name = 'Trane U.S. Inc.')
  -- pm: ashleyh.carroll@trane.com
WHERE name ILIKE 'Rutherford High School Building 1';

UPDATE projects SET
  estimated_income = 70963,
  customer_id = (SELECT id FROM customers WHERE name = 'Trane U.S. Inc.')
  -- pm: Chris.Favre@trane.com
WHERE name ILIKE 'Titan Hangar 3';

UPDATE projects SET
  estimated_income = 1596000,
  customer_id = (SELECT id FROM customers WHERE name = 'USAF')
WHERE name ILIKE 'Eglin 1416';

UPDATE projects SET
  estimated_income = 43773,
  customer_id = (SELECT id FROM customers WHERE name = 'Walters Controls')
  -- pm: richard@walterscontrols.net
WHERE name ILIKE 'Eglin Airman';


