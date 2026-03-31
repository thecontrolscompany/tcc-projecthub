## Files modified
- `src/app/api/admin/import-pm-directory/route.ts`
- `src/app/admin/page.tsx`
- `codex/task-016-consent-ux-output.md`

## Consent error UX
- Added a direct `consentUrl` to the PM import API's permission-denied response
- Used the exact Azure admin-consent URL for the TCC tenant, portal app, and `/admin` redirect

## API behavior
- The route now returns `consentUrl` when Graph denies access due to `403`, `Authorization_RequestDenied`, or `InsufficientPermissions`
- The existing error message still explains that `User.ReadBasic.All` admin consent is required

## Admin UI
- The PM Directory error banner now renders the returned error message plus a `Grant Admin Consent in Azure ->` link when `consentUrl` is present
- The consent link opens in a new tab

## Build result
- clean
- Ran `npm run build`

## Git
- Committed and pushed Task 016 consent UX changes to `origin main`

## Notes
- Left unrelated untracked screenshot files untouched
