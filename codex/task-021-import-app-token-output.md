## Files modified
- `src/app/api/admin/import-pm-directory/route.ts`
- `.env.local.example`
- `codex/task-021-import-app-token-output.md`

## PM import auth change
- Replaced the delegated Supabase provider-token flow with an app-only Microsoft Graph token
- The PM import route now uses the client credentials grant against:
  - `https://login.microsoftonline.com/7eec7a09-a47b-4bf1-a877-80fd5323c774/oauth2/v2.0/token`
- The route reads the client secret from:
  - `process.env.MICROSOFT_CLIENT_SECRET`

## Graph import behavior
- PM import still requires the caller to be an authenticated admin
- After admin auth passes, the route fetches an app-only token and uses that token for `GET /users`
- The existing upsert behavior for `pm_directory` remains intact

## Environment example
- Added `MICROSOFT_CLIENT_SECRET` to `.env.local.example`
- Included a comment that it is specifically for the app-only PM import Graph flow

## Azure configuration Timothy must do manually
- Create a client secret for Azure app `0777b14d-29c4-4186-8d8e-4a8f43de6589`
- Put that value in `MICROSOFT_CLIENT_SECRET`
- Add `User.ReadBasic.All` as an APPLICATION permission in Azure
- Grant admin consent for that application permission

## Build result
- clean
- Ran `npm run build`

## Git
- Committed and pushed the app-only PM import token change to `origin main`

## Notes
- Left unrelated untracked files untouched
