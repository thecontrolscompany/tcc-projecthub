# Task 016 — PM Import Consent Error UX

**Date:** 2026-03-31
**Status:** Complete

## What was done

Improved the UX when the admin clicks "Import from Microsoft" and the app lacks `User.ReadBasic.All` admin consent in Azure.

### Changes

#### `src/app/api/admin/import-pm-directory/route.ts`
- Extended the 403 / consent-denied error branch to also match `InsufficientPermissions` error codes
- When a consent-denied error is detected, the JSON response now includes a `consentUrl` field pointing to the Azure tenant admin consent URL:
  ```
  https://login.microsoftonline.com/7eec7a09-a47b-4bf1-a877-80fd5323c774/adminconsent
    ?client_id=0777b14d-29c4-4186-8d8e-4a8f43de6589
    &redirect_uri=https%3A%2F%2Finternal.thecontrolscompany.com%2Fadmin
  ```
- Error message updated to explain the one-click flow

#### `src/app/admin/page.tsx`
- Extended the `status` state type to include optional `consentUrl?: string`
- `handleImport` now reads `json.consentUrl` from the error response and stores it in state
- The error banner now conditionally renders a "Grant Admin Consent in Azure →" link that opens the consent URL in a new tab when `consentUrl` is present

## How it works

1. Admin clicks "Import from Microsoft"
2. Graph API returns 403 Authorization_RequestDenied / InsufficientPermissions
3. API route returns `{ error: "...", consentUrl: "https://login.microsoftonline.com/..." }`
4. Admin page shows the error message + an inline "Grant Admin Consent in Azure →" button
5. Timothy clicks the button, logs in as a Global Admin in Azure, and grants consent
6. He then signs out and back in to get a fresh provider token with the new permission
7. Import succeeds

## Build
`npm run build` passes clean — 24 routes, no TypeScript or lint errors.
