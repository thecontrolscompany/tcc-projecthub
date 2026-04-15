-- Add DEFAULT '' to NOT NULL string columns on quote_requests that are never
-- meaningfully populated by legacy import paths (contact info comes later).
-- This prevents null constraint violations when importing historical bids.

alter table quote_requests
  alter column contact_name  set default '',
  alter column contact_email set default '';
