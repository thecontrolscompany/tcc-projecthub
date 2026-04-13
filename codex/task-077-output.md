# Task 077 Output

## What Was Done

- Made the labor-hours detail table in the PM weekly update form fully editable.
- Added helper actions to:
  - edit worker names,
  - edit Mon-Sat values,
  - recalculate per-row totals,
  - add worker rows,
  - remove worker rows.
- Added automatic syncing from editable `laborDetail` rows back to `laborPulled` so the saved grand total follows table edits.
- Added a `+ Add worker manually` action so PMs can build a labor detail table without first pulling from QB Time.
- Kept the existing `Clear / Use manual entry` action so PMs can still revert to aggregate crew-log mode.
- Added the rounding note below labor detail tables in:
  - the PM edit form,
  - the PM read-only submitted summary,
  - the customer weekly update card.

## Decisions Made

- When `laborDetail` becomes empty, `laborPulled` is cleared so an empty manual table does not leave behind a stale saved labor-hours total.
- The editable table uses the existing desktop table layout with inline inputs rather than introducing a second mobile-specific labor editor, which keeps the behavior predictable and aligned with the rest of the weekly update form.
