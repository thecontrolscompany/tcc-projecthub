-- Customer billing is served through /api/customer/data with an explicit
-- column allowlist. Remove direct table access so internal notes and future
-- billing columns cannot be selected through the Supabase client.
drop policy if exists "Customer reads billing for accessible projects"
  on public.billing_periods;
