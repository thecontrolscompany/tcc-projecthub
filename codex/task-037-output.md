# Task 037 Output

## What Changed

- Added a reusable `ComboboxInput` in `src/components/project-modal.tsx`
  - Replaced the old contractor `<datalist>` inputs for General, Mechanical, and Electrical contractors
  - Shows suggestions on focus, filters while typing, supports free text, and supports keyboard navigation

- Added a `SiteAddressInput` in `src/components/project-modal.tsx`
  - Replaced the old site address `<datalist>`
  - Debounces address lookup and shows live suggestions
  - Uses a new server proxy route at `src/app/api/address-search/route.ts` so the Nominatim request can include the required `User-Agent` header
  - Still allows free-text addresses

- Added phone formatting in `src/app/admin/page.tsx`
  - Added `formatPhone`
  - PM/contact phone input now autoformats while typing
  - Contact table phone values now render consistently as `(555) 555-1234`

- Added primary PM designation support
  - Updated `src/components/project-modal.tsx` to show `★ Primary` for the selected primary PM and `Set Primary` for other PM assignments
  - Updated `src/components/admin-projects-tab.tsx` to track `primaryPersonId`, auto-assign a first PM as primary, preserve it on edit, and send `is_primary` in the save payload
  - Updated `src/components/ops-project-list.tsx` to support the same primary PM UX in the shared modal
  - Updated `src/app/api/admin/save-project/route.ts` to prefer the explicitly marked primary PM when writing `pm_id`

## Issues Hit

- Browsers do not reliably allow setting a custom `User-Agent` header on client-side fetches, so the Nominatim lookup was implemented through a small local API route proxy to satisfy that requirement safely.

## Final Build Status

- `npm run build` passes clean
