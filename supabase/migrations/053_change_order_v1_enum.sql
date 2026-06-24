begin;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'co_status'
      and n.nspname = 'public'
  ) then
    create type public.co_status as enum (
      'pending',
      'approved',
      'rejected',
      'void'
    );
  end if;

  alter type public.co_status add value if not exists 'draft';
  alter type public.co_status add value if not exists 'needs_pricing';
  alter type public.co_status add value if not exists 'ready_to_submit';
  alter type public.co_status add value if not exists 'submitted';
  alter type public.co_status add value if not exists 'in_review';
  alter type public.co_status add value if not exists 'approved';
  alter type public.co_status add value if not exists 'rejected';
  alter type public.co_status add value if not exists 'voided';
  alter type public.co_status add value if not exists 'superseded';
  alter type public.co_status add value if not exists 'executed';
  alter type public.co_status add value if not exists 'billed';
  alter type public.co_status add value if not exists 'paid';
  alter type public.co_status add value if not exists 'needs_revision';
  alter type public.co_status add value if not exists 'approved_po';
  alter type public.co_status add value if not exists 'approved_email';
end
$$;

commit;
