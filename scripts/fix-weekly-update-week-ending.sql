-- One-time cleanup for historical weekly_updates.week_of values.
-- Goal: normalize every row to the Saturday of that same Sunday-Saturday week.
--
-- Example:
--   Wednesday 2026-04-08 -> Saturday 2026-04-11
--   Thursday  2026-03-19 -> Saturday 2026-03-21
--
-- Run this in Supabase SQL editor after reviewing the preview queries below.

-- Preview rows that would change.
select
  id,
  project_id,
  week_of as current_week_of,
  (week_of + ((6 - extract(dow from week_of)::int + 7) % 7))::date as normalized_week_ending
from public.weekly_updates
where week_of is not null
  and week_of <> (week_of + ((6 - extract(dow from week_of)::int + 7) % 7))::date
order by project_id, week_of;

-- Check for collisions before updating.
-- If this returns any rows, multiple existing updates would collapse onto the same
-- normalized Saturday for the same project and should be reviewed before update.
select
  project_id,
  (week_of + ((6 - extract(dow from week_of)::int + 7) % 7))::date as normalized_week_ending,
  count(*) as row_count
from public.weekly_updates
where week_of is not null
group by project_id, normalized_week_ending
having count(*) > 1
order by project_id, normalized_week_ending;

-- Apply the normalization once the collision check is clear.
update public.weekly_updates
set week_of = (week_of + ((6 - extract(dow from week_of)::int + 7) % 7))::date
where week_of is not null
  and week_of <> (week_of + ((6 - extract(dow from week_of)::int + 7) % 7))::date;

-- Optional verification after update.
select
  id,
  project_id,
  week_of
from public.weekly_updates
order by project_id, week_of desc;
