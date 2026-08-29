-- Optional refresh-token expiry metadata. QuickBooks Time does not currently
-- return this value, but the nullable column keeps status handling forward-compatible.

alter table public.qb_time_tokens
  add column if not exists refresh_token_expires_at timestamptz;

comment on column public.qb_time_tokens.refresh_token_expires_at is 'Refresh token expiration time when supplied by the OAuth provider.';
