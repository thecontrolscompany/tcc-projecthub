alter table billing_periods
add column if not exists invoice_number text;

create or replace view billing_rows as
select
  bp.id                                           as billing_period_id,
  bp.period_month,
  p.id                                            as project_id,
  c.name                                          as customer_name,
  p.name                                          as project_name,
  coalesce(pm.email, '')                          as pm_email,
  coalesce(pmd.first_name, split_part(pm.email, '@', 1)) as pm_name,
  bp.estimated_income_snapshot                    as estimated_income,
  greatest(bp.estimated_income_snapshot - bp.prev_billed, 0) as backlog,
  bp.prior_pct,
  bp.pct_complete,
  bp.prev_billed,
  case when bp.estimated_income_snapshot > 0
    then bp.prev_billed / bp.estimated_income_snapshot
    else 0
  end                                             as prev_billed_pct,
  greatest(bp.estimated_income_snapshot * bp.pct_complete - bp.prev_billed, 0) as to_bill,
  bp.actual_billed,
  bp.synced_from_onedrive,
  bp.invoice_number,
  bp.notes
from billing_periods bp
join projects p on p.id = bp.project_id
left join customers c on c.id = p.customer_id
left join profiles pm on pm.id = p.pm_id
left join pm_directory pmd on pmd.profile_id = p.pm_id;
