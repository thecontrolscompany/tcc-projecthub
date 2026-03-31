## Files modified
- `src/components/app-shell.tsx`
- `src/components/sidebar-nav.tsx`
- `src/app/admin/page.tsx`
- `src/app/pm/page.tsx`
- `src/app/customer/page.tsx`
- `codex/task-023-ui-overhaul-output.md`

## Shell and sidebar
- Fixed the top alignment mismatch by making the sidebar logo section `h-14` to match the shared header
- Added a collapsible sidebar:
  - expanded width `w-56`
  - collapsed width `w-16`
  - content/header offsets adjust with the sidebar width
- Persisted collapsed state in `localStorage`
- Kept the shell client-side so it can manage this state

## Header
- Added a collapse toggle button in the shared header
- Added current page title on the left side of the header
- Added a circle avatar with user initials on the right side of the header
- Kept the theme toggle in the header

## Navigation cleanup
- Added inline SVG icons to all nav items without adding dependencies
- Renamed:
  - `Dashboard` -> `Admin`
  - `SharePoint Migration` -> `SharePoint`
  - `PM Updates` -> `PM Portal`
- Removed nonexistent roles from navigation config
- Updated nav roles to use actual app roles only:
  - `admin`
  - `pm`
  - `lead`
  - `installer`
  - `ops_manager`
  - `customer`
- Removed admin-only sidebar links that are redundant with admin tabs/pages:
  - `Projects`
  - `PM Portal`
  - `Users`
- Added role-appropriate nav entries for:
  - `lead`
  - `installer`
  - `ops_manager`

## Visual polish
- Moved the user email/signout area into a cleaner sidebar footer with avatar styling
- Updated admin page tabs to use a pill/filled active state
- Increased page-title styling where it was still smaller on portal pages
- Removed redundant full-page top headers from the PM and admin portal pages so the shared shell header is the primary chrome

## Build result
- clean
- Ran `npm run build`

## Git
- Committed and pushed the UI overhaul to `origin main`

## Notes
- Left unrelated local files untouched
