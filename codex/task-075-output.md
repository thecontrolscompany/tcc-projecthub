# Task 075 Output

## What Was Done

- Added `supabase/migrations/044_weekly_update_labor_hours.sql` to extend `weekly_updates` with QB Time labor-hour fields.
- Created `src/app/api/pm/hours-pull/route.ts` to pull mapped QB Time timesheets for a project/week, group them by worker, round to the nearest 0.5 hour, and return total hours plus detail rows.
- Updated weekly update save handling to accept and persist labor-hour fields.
- Renamed weekly crew log typing and UI language from `men` to `workers`.
- Added PM weekly-update UI for:
  - pulling hours from QB Time,
  - showing per-person labor detail,
  - overriding the total when needed,
  - clearing QB Time data to fall back to manual crew-log mode.
- Updated the customer portal to show labor-hour detail when present, show a simple total when only an override exists, and otherwise keep the legacy aggregate crew-log display.
- Updated the printable weekly report page to support the new labor-hour detail mode.
- Updated project/customer data routes to include the new labor-hour fields so the UI can load existing saved values.
- Preserved backward compatibility for older `crew_log` JSON rows that still use the legacy `men` key by normalizing them in the UI/report layers.

## Notes

- Migration `044_weekly_update_labor_hours.sql` must be run manually in Supabase before the UI works.
- `labor_hours_detail` is null on all existing records, so existing weekly updates continue to display exactly as before unless new labor-hour data is saved.

## Decisions Made

- Added backward compatibility for old `crew_log` JSON payloads because renaming the TypeScript field alone would otherwise break older saved weekly updates.
- Updated the printable weekly report page and data-select routes in addition to the task’s core files so the new labor-hour mode works consistently across PM view, customer view, and generated reports.
