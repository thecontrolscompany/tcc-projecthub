-- 1. Restore project_name from sharepoint_folder for pursuits where the
--    document extractor overwrote it with a doc-derived title.
--    Pattern: strip "Bids/QR-YYYY-NNN - " prefix from sharepoint_folder.
UPDATE pursuits
SET project_name = regexp_replace(sharepoint_folder, '^Bids/QR-\d+-\d+ - ', '')
WHERE sharepoint_folder IS NOT NULL
  AND status = 'lost'
  AND project_name != regexp_replace(sharepoint_folder, '^Bids/QR-\d+-\d+ - ', '');

-- 2. Clear bad owner_name values - these are clearly not company names.
UPDATE pursuits SET owner_name = NULL WHERE id = 'b2b749ac-99c6-4b79-82db-a04b94c79ce6';
UPDATE pursuits SET owner_name = NULL WHERE id = 'fa02c856-c0d2-41f6-8e67-18585b47f17c';
UPDATE pursuits SET owner_name = NULL WHERE id = 'efd7e96c-4410-49f7-9240-be54ada6b1a8';
UPDATE pursuits SET owner_name = NULL WHERE id = '0ebca3d8-6f69-433d-b0c7-b4227f90df36';
UPDATE pursuits SET owner_name = NULL WHERE id = '1adcac56-1571-4623-853a-b6c9949dbede';
UPDATE pursuits SET owner_name = NULL WHERE id = 'd18a8e0e-856a-4391-8ee3-6c403d368577';
UPDATE pursuits SET owner_name = NULL WHERE id = '4dba942c-2887-48c1-b809-83e97e15e0b7';

-- 3. Link 6 USA pursuits to the existing QR-2021-049 - USA SharePoint folder.
--    They share the folder; each remains a separate pursuit record.
UPDATE pursuits
SET sharepoint_folder = 'Bids/QR-2021-049 - USA',
    sharepoint_item_id = NULL
WHERE id IN (
  'aee753d1-df26-455b-af4b-085ffe00adb1',
  'cc03259a-7447-4db9-a372-eb29a120abfa',
  'f9ebbd6f-6c93-4839-b696-94145fc2769b',
  'e66fe808-b3c0-4eb2-aa1d-e0bb4f700057',
  'a49e92d6-a1b3-464c-9484-3eb2f1c5dc44',
  'bc320631-07bc-47e0-a30b-75e1a6f6504f'
);

-- 4. Also fix the Adams Homes pursuit that matched the wrong year folder
--    (matched QR-2023-043 instead of QR-2021-001).
UPDATE pursuits
SET project_name = 'Adams Homes',
    sharepoint_folder = 'Bids/QR-2021-001 - Adams Homes',
    sharepoint_item_id = NULL
WHERE id = '1580a963-beff-48cd-b5a7-5d5a11237ccf';
