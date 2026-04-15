-- Add bid_year column
ALTER TABLE pursuits ADD COLUMN IF NOT EXISTS bid_year integer;

-- Populate from sharepoint_folder where pattern matches Bids/QR-YYYY-
UPDATE pursuits
SET bid_year = CAST(substring(sharepoint_folder FROM 'QR-(\d{4})-') AS integer)
WHERE sharepoint_folder ~ 'QR-\d{4}-'
  AND bid_year IS NULL;
