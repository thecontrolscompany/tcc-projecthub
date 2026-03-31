# Task 015 - PM Import from Microsoft

## Context

Admins need a one-click way to pull internal Microsoft 365 users into the PM Directory
instead of manually entering PM email addresses.

The import should use the Microsoft provider token already stored in the Supabase session,
call Microsoft Graph `GET /users`, filter down to internal tenant people, and upsert those
records into `pm_directory` without breaking any existing `profile_id` links.

Task 014 is complete and migration `004_project_fields.sql` has already been run manually.
Do not recreate or modify migration 004.

## Read before starting

- `codex/CLAUDE-HANDOFF.md`
- `src/app/admin/page.tsx`
- `src/lib/graph/client.ts`
- `src/types/database.ts`
- `supabase/migrations/001_initial_schema.sql`
- `src/app/api/admin/migrate-sharepoint/route.ts`
- `src/app/auth/callback/route.ts`

---

## Part A - Schema alignment for PM last name

The current checked-in schema defines `pm_directory` with:

```sql
id uuid primary key default gen_random_uuid(),
profile_id uuid references profiles(id) on delete set null,
first_name text,
email text unique not null
```

Task 015 requires storing `last_name` as well. Create a new additive migration:

`supabase/migrations/005_pm_directory_last_name.sql`

```sql
ALTER TABLE pm_directory
  ADD COLUMN IF NOT EXISTS last_name TEXT;
```

This is a new migration for Task 015. Do not recreate migration 004.

---

## Part B - Update TypeScript types

In `src/types/database.ts`, extend `PmDirectory`:

```ts
last_name: string | null;
```

Any local PM Directory UI types should also include `last_name` where relevant.

---

## Part C - Microsoft Graph helper support

In `src/lib/graph/client.ts`, add a helper for listing tenant users from Graph.

Requirements:

- Use the existing `graphFetch()` helper
- Call Graph `GET /users`
- Request enough fields to filter and map records:
  - `id`
  - `givenName`
  - `surname`
  - `displayName`
  - `mail`
  - `userPrincipalName`
  - `userType`
  - `accountEnabled`
- Handle Graph paging via `@odata.nextLink`
- Return a normalized array of candidate users

Suggested Graph query:

```text
/users?$select=id,givenName,surname,displayName,mail,userPrincipalName,userType,accountEnabled&$top=999
```

---

## Part D - Admin import API route

Create:

`src/app/api/admin/import-pm-directory/route.ts`

### Route

```ts
POST /api/admin/import-pm-directory
```

### Behavior

- Require an authenticated admin user
- Require a Microsoft provider token from the Supabase session
- Call Graph `GET /users`
- Filter to internal tenant users only:
  - include only `userType === "Member"`
  - exclude guest/external users
  - exclude disabled accounts
  - exclude likely shared mailboxes / non-person accounts by requiring a real email and at least one personal name field
- Normalize email to lowercase
- Prefer `mail`; fall back to `userPrincipalName` only if it looks like an email address

### Upsert behavior

For each qualifying user:

- Match an existing `profiles` row by email to determine `profile_id`
- Upsert into `pm_directory` using `email` as the conflict target
- Write:
  - `email`
  - `first_name`
  - `last_name`
- Set `profile_id` only when the existing `pm_directory.profile_id` is null
- Never overwrite a non-null existing `profile_id`

Implementation note:

- Read existing `pm_directory` rows up front into a map keyed by lowercase email
- Read matching `profiles` rows for candidate emails into a map keyed by lowercase email
- Build upsert payloads that preserve existing `profile_id` when already linked

### Response shape

Return:

```json
{
  "inserted": 0,
  "updated": 0,
  "skipped": 0
}
```

### Error handling

- `401` for unauthenticated
- `403` for non-admin
- `400` if provider token is missing
- If Graph fails because the app lacks `User.ReadBasic.All`, return a clear actionable message for Timothy:

```text
Microsoft Graph access was denied. Grant admin consent for the User.ReadBasic.All permission in Azure, then sign out and sign back in with Microsoft.
```

- Other Graph failures should return a concise error message from the response when available

---

## Part E - Admin UI

In the PM Directory tab in `src/app/admin/page.tsx`:

- Add an `Import from Microsoft` button near the section header
- On click:
  - call `POST /api/admin/import-pm-directory`
  - disable the button while running
  - show loading text while import is in progress
- After completion:
  - refresh the PM Directory table
  - show the returned summary:
    - inserted count
    - updated count
    - skipped count
- If the API returns an error, show the message inline in the tab

UI text can be concise, for example:

- Loading: `Importing from Microsoft...`
- Success: `Import complete: 12 inserted, 4 updated, 18 skipped.`

Update the table to display `last_name` as a new column if present.

---

## Part F - Build and output

After implementation:

- Run `npm run build`
- Fix any new errors introduced by Task 015
- Create `codex/task-015-output.md`

Output format:

```md
## Files modified
- list each

## Migration file created
- filename and purpose

## API route
- auth behavior
- Graph endpoint used
- filtering rules
- upsert behavior

## Admin UI
- where the button was added
- loading/result behavior

## Error handling
- missing token behavior
- missing scope behavior

## Build result
- clean or paste errors

## Blockers or follow-up
- any ambiguity, or "none"
```
