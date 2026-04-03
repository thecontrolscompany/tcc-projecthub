# Task 039 — Customer Portal Dropdown: Show All Contacts

## Problem

The "Customer Portal Access" section in the edit project modal has a dropdown to add people.
It currently fetches only `profiles` with `role = "customer"`.
It should show **everyone in the `pm_directory` (Contacts) table** instead.

Additionally, the add/remove actions use the browser Supabase client directly — this is the broken
pattern for Microsoft SSO sessions. Move them to server API routes.

---

## 1 — Update the data route

In `src/app/api/admin/data/route.ts`, find the `section === "project-customer-contacts"` block.

Change the `profileResult` query from:
```ts
adminClient.from("profiles").select("*").eq("role", "customer").order("email")
```

To fetching everyone from `pm_directory`:
```ts
adminClient
  .from("pm_directory")
  .select("id, email, first_name, last_name, profile_id")
  .order("email")
```

Return shape becomes:
```ts
{
  contacts: ProjectCustomerContact[],   // existing rows for this project (unchanged)
  availableContacts: Array<{            // renamed from "profiles"
    id: string;          // pm_directory.id
    email: string;
    first_name: string | null;
    last_name: string | null;
    profile_id: string | null;          // null = no portal account yet
  }>;
}
```

---

## 2 — New API route: add contact to project portal

Create `src/app/api/admin/project-portal-contact/route.ts`.

### POST — add a contact

Body: `{ projectId: string; pmDirectoryId: string }`

Logic:
1. Auth check (admin or ops_manager).
2. Look up the `pm_directory` row by `pmDirectoryId`.
3. If `profile_id` is null — create a portal account:
   - Call `adminClient.auth.admin.createUser({ email, password: crypto.randomUUID(), email_confirm: true })`
   - Upsert into `profiles`: `{ id: newUser.id, email, full_name: first+last or email, role: "customer" }`
   - Update `pm_directory` row: set `profile_id = newUser.id`
4. Insert into `project_customer_contacts`:
   ```ts
   { project_id: projectId, profile_id: resolvedProfileId, portal_access: false, email_digest: false }
   ```
   Use `ON CONFLICT (project_id, profile_id) DO NOTHING`.
5. Return the new row joined with profile:
   ```ts
   { contact: { id, project_id, profile_id, portal_access, email_digest, profile: { email, full_name } } }
   ```

### DELETE — remove a contact

Body: `{ projectId: string; profileId: string }`

Logic: delete from `project_customer_contacts` where `project_id = projectId AND profile_id = profileId`.
Return `{ ok: true }`.

### PATCH — toggle portal_access or email_digest

Body: `{ projectId: string; profileId: string; field: "portal_access" | "email_digest"; value: boolean }`

Logic: update the row. If setting `portal_access = false`, also set `email_digest = false`.
Return `{ ok: true }`.

---

## 3 — Update CustomerContactsSection in project-modal.tsx

### State changes

Remove `allCustomers: Profile[]` state — replace with:
```ts
const [availableContacts, setAvailableContacts] = useState<Array<{
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  profile_id: string | null;
}>>([]);
```

### Load

Update the fetch to use the new response shape (read `json.availableContacts`).

### Dropdown

The `<select>` to pick a person to add should now list `availableContacts`, filtered to exclude
anyone whose `profile_id` already appears in `contacts`.

Option label: `{first_name} {last_name} <{email}>` — fall back to just `{email}` if no name.
Option value: the `pm_directory.id` (not `profile_id`, since it may be null).

### Add

Replace the browser-client insert with:
```ts
const res = await fetch("/api/admin/project-portal-contact", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ projectId, pmDirectoryId: selectedContactId }),
});
const json = await res.json();
if (!res.ok) { setAddError(json.error ?? "Failed to add contact."); return; }
setContacts((prev) => [...prev, json.contact]);
```

If the server created a new portal account, show a brief info message below the dropdown:
`"A portal account was created for {email}. They can use Forgot Password to set their password."`

### Toggle portal_access / email_digest

Replace any browser-client updates with PATCH to `/api/admin/project-portal-contact`.

### Remove

Replace browser-client delete with DELETE to `/api/admin/project-portal-contact`.

---

## 4 — Build + commit

- Run `npm run build` — must pass clean.
- Commit: `"Customer portal dropdown now shows all contacts; auto-creates account if needed"` and push to `origin/main`.
- Create `codex/task-039-output.md` with: what was changed, any issues, build status.
