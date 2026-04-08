# Task 059 — PM Portal: Contacts Tab

## Context

The `projects` table has `general_contractor`, `mechanical_contractor`, and
`electrical_contractor` as plain company-name text fields. There is no schema for
contact-level details (person name, phone, email) per contractor role, and the PM
portal shows none of this information today.

This task:
1. Adds a `project_contacts` table (migration 031)
2. Adds a new **Contacts** tab to the PM portal (position 2, between Overview and Weekly Update)
3. PMs see contacts in read-only mode by default; an **Edit** button unlocks editing
4. Adds a new API route for PMs to save contacts
5. Fetches contacts alongside existing project-data in the PM API

No fields are mandatory.

---

## 1. Migration — `supabase/migrations/031_project_contacts.sql`

```sql
CREATE TABLE IF NOT EXISTS project_contacts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role        text        NOT NULL,
  company     text,
  contact_name text,
  phone       text,
  email       text,
  notes       text,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_contacts_project_id
  ON project_contacts(project_id);

CREATE OR REPLACE FUNCTION update_project_contacts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_contacts_updated_at ON project_contacts;
CREATE TRIGGER trg_project_contacts_updated_at
  BEFORE UPDATE ON project_contacts
  FOR EACH ROW EXECUTE FUNCTION update_project_contacts_updated_at();
```

The `role` column is free-text so new types can be added without schema changes.
Predefined roles used by the UI: `gc`, `mechanical`, `electrical`, `owner`,
`architect`, `engineer`, `other`.

---

## 2. PM projects API — `src/app/api/pm/projects/route.ts`

In the `section === "project-data"` handler, add a third parallel fetch alongside
`updatesResult` and `pocResult`:

```ts
adminClient
  .from("project_contacts")
  .select("id, role, company, contact_name, phone, email, notes, sort_order")
  .eq("project_id", projectId)
  .order("sort_order")
  .order("created_at"),
```

Destructure as `contactsResult`. Add to error check. Return in the response:

```ts
return NextResponse.json({
  updates: ...,
  pocItems: ...,
  contacts: contactsResult.data ?? [],
  ...rest of response
});
```

Also add a TypeScript type for the returned contact shape alongside the other inline
types in this file:

```ts
interface ProjectContact {
  id: string;
  role: string;
  company: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  sort_order: number;
}
```

---

## 3. New API route — `src/app/api/pm/contacts/route.ts`

```ts
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

export async function PUT(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const resolvedProfile = await resolveUserRole(user);
  const role = resolvedProfile?.role ?? "customer";
  if (!["admin", "ops_manager", "pm"].includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json() as {
    project_id: string;
    contacts: Array<{
      role: string;
      company?: string | null;
      contact_name?: string | null;
      phone?: string | null;
      email?: string | null;
      notes?: string | null;
      sort_order?: number;
    }>;
  };

  const { project_id, contacts } = body;
  if (!project_id) {
    return NextResponse.json({ error: "Missing project_id." }, { status: 400 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify PM is assigned to this project (admins/ops_managers skip this check)
  if (role === "pm") {
    const { data: pmRows } = await adminClient
      .from("pm_directory")
      .select("id")
      .eq("profile_id", user.id);

    const pmDirIds = (pmRows ?? []).map((r) => r.id);

    const { data: assignmentRows } = await adminClient
      .from("project_assignments")
      .select("project_id")
      .eq("project_id", project_id)
      .or(
        `profile_id.eq.${user.id}${pmDirIds.length > 0 ? `,pm_directory_id.in.(${pmDirIds.join(",")})` : ""}`
      )
      .limit(1);

    if (!assignmentRows?.length) {
      return NextResponse.json({ error: "Not assigned to this project." }, { status: 403 });
    }
  }

  // Delete all existing contacts for this project, then insert the new set.
  // Filter out completely empty rows before inserting.
  const nonEmpty = contacts.filter(
    (c) => c.role && (c.company || c.contact_name || c.phone || c.email || c.notes)
  );

  const { error: deleteError } = await adminClient
    .from("project_contacts")
    .delete()
    .eq("project_id", project_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (nonEmpty.length > 0) {
    const rows = nonEmpty.map((c, i) => ({
      project_id,
      role: c.role,
      company: c.company ?? null,
      contact_name: c.contact_name ?? null,
      phone: c.phone ?? null,
      email: c.email ?? null,
      notes: c.notes ?? null,
      sort_order: c.sort_order ?? i,
    }));

    const { error: insertError } = await adminClient
      .from("project_contacts")
      .insert(rows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
```

---

## 4. PM portal — `src/app/pm/page.tsx`

### 4a. Update ProjectTab type (line ~20)

```ts
type ProjectTab = "overview" | "contacts" | "update" | "poc" | "change-orders" | "rfis" | "bom";
```

### 4b. Add contacts state near other state declarations (around line ~300)

```ts
const [contacts, setContacts] = useState<ProjectContact[]>([]);
```

Add the `ProjectContact` interface at the top of the file (outside component):

```ts
interface ProjectContact {
  id?: string;
  role: string;
  company: string;
  contact_name: string;
  phone: string;
  email: string;
  notes: string;
  sort_order?: number;
}
```

### 4c. Load contacts in `loadData()`

In the block that processes the `project-data` response, add:

```ts
setContacts((json?.contacts ?? []).map((c: ProjectContact) => ({
  ...c,
  company: c.company ?? "",
  contact_name: c.contact_name ?? "",
  phone: c.phone ?? "",
  email: c.email ?? "",
  notes: c.notes ?? "",
})));
```

### 4d. Tab bar — add Contacts button after Overview

```tsx
<PmTabButton active={activeTab === "contacts"} onClick={() => setActiveTab("contacts")}>
  Contacts
</PmTabButton>
```

Insert this immediately after the Overview `PmTabButton` and before the Weekly Update button.

### 4e. Contacts tab content

Add a `{activeTab === "contacts" && (...)}` block after the Overview block and before
the Weekly Update block. The full content is below.

The tab has two modes controlled by local state `contactsEditMode`:

```tsx
{activeTab === "contacts" && (
  <ContactsTab
    projectId={project.id}
    contacts={contacts}
    onSaved={(updated) => setContacts(updated)}
  />
)}
```

---

## 5. New component — `ContactsTab`

Add the `ContactsTab` component at the bottom of `src/app/pm/page.tsx` (before
`PmTabButton`).

### Predefined roles

```ts
const CONTACT_ROLES = [
  { key: "gc", label: "General Contractor" },
  { key: "mechanical", label: "Mechanical Contractor" },
  { key: "electrical", label: "Electrical Contractor" },
  { key: "owner", label: "Owner / Owner's Rep" },
  { key: "architect", label: "Architect" },
  { key: "engineer", label: "Engineer" },
  { key: "other", label: "Other" },
];
```

### Component logic

```tsx
function ContactsTab({
  projectId,
  contacts,
  onSaved,
}: {
  projectId: string;
  contacts: ProjectContact[];
  onSaved: (updated: ProjectContact[]) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<ProjectContact[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function enterEdit() {
    // Build draft: start with one row per predefined role,
    // pre-filling from existing contacts where they match.
    const rows: ProjectContact[] = CONTACT_ROLES.map((r, i) => {
      const existing = contacts.find((c) => c.role === r.key);
      return existing
        ? { ...existing, company: existing.company ?? "", contact_name: existing.contact_name ?? "", phone: existing.phone ?? "", email: existing.email ?? "", notes: existing.notes ?? "" }
        : { role: r.key, company: "", contact_name: "", phone: "", email: "", notes: "", sort_order: i };
    });
    setDraft(rows);
    setSaveError(null);
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setSaveError(null);
  }

  function updateDraft(index: number, field: keyof ProjectContact, value: string) {
    setDraft((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function saveContacts() {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/pm/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ project_id: projectId, contacts: draft }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error ?? "Failed to save.");
      // Return only non-empty rows to the parent
      const saved = draft.filter(
        (c) => c.company || c.contact_name || c.phone || c.email || c.notes
      );
      onSaved(saved);
      setEditMode(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save contacts.");
    } finally {
      setSaving(false);
    }
  }
```

### Read mode render

When `!editMode`, render a card for each contact that has at least one non-empty field.
If no contacts at all, show an empty state.

```tsx
  // READ MODE
  if (!editMode) {
    const populated = contacts.filter(
      (c) => c.company || c.contact_name || c.phone || c.email
    );
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Project Contacts</h3>
            <p className="mt-0.5 text-sm text-text-tertiary">
              Key contacts for this project.
            </p>
          </div>
          <button
            type="button"
            onClick={enterEdit}
            className="rounded-lg border border-border-default bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
          >
            Edit Contacts
          </button>
        </div>

        {populated.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-default px-6 py-10 text-center">
            <p className="text-sm font-medium text-text-secondary">No contacts on file.</p>
            <p className="mt-1 text-xs text-text-tertiary">
              Click Edit Contacts to add GC, mechanical, electrical, and other key contacts.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {populated.map((contact, i) => {
              const roleLabel =
                CONTACT_ROLES.find((r) => r.key === contact.role)?.label ?? contact.role;
              return (
                <div
                  key={contact.id ?? i}
                  className="rounded-2xl border border-border-default bg-surface-raised p-4 space-y-2"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                    {roleLabel}
                  </p>
                  {contact.company && (
                    <p className="font-semibold text-text-primary">{contact.company}</p>
                  )}
                  {contact.contact_name && (
                    <p className="text-sm text-text-secondary">{contact.contact_name}</p>
                  )}
                  <div className="space-y-1">
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="block text-sm text-brand-primary hover:underline"
                      >
                        {contact.phone}
                      </a>
                    )}
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="block text-sm text-brand-primary hover:underline"
                      >
                        {contact.email}
                      </a>
                    )}
                  </div>
                  {contact.notes && (
                    <p className="text-xs text-text-tertiary">{contact.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
```

### Edit mode render

```tsx
  // EDIT MODE
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Edit Contacts</h3>
          <p className="mt-0.5 text-sm text-text-tertiary">
            All fields are optional. Leave blank to omit a contact.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={cancelEdit}
            disabled={saving}
            className="rounded-lg border border-border-default bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-base"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void saveContacts()}
            disabled={saving}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {saveError && (
        <p className="rounded-xl border border-status-danger/20 bg-status-danger/5 px-4 py-3 text-sm text-status-danger">
          {saveError}
        </p>
      )}

      <div className="space-y-6">
        {draft.map((row, index) => {
          const roleLabel =
            CONTACT_ROLES.find((r) => r.key === row.role)?.label ?? row.role;
          return (
            <div
              key={row.role}
              className="rounded-2xl border border-border-default bg-surface-raised p-4 space-y-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                {roleLabel}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Company
                  </label>
                  <input
                    type="text"
                    value={row.company}
                    onChange={(e) => updateDraft(index, "company", e.target.value)}
                    className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
                    placeholder="Company name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={row.contact_name}
                    onChange={(e) => updateDraft(index, "contact_name", e.target.value)}
                    className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
                    placeholder="First Last"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={row.phone}
                    onChange={(e) => updateDraft(index, "phone", e.target.value)}
                    className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
                    placeholder="(555) 555-5555"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Email
                  </label>
                  <input
                    type="email"
                    value={row.email}
                    onChange={(e) => updateDraft(index, "email", e.target.value)}
                    className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
                    placeholder="email@company.com"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Notes
                </label>
                <input
                  type="text"
                  value={row.notes}
                  onChange={(e) => updateDraft(index, "notes", e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
                  placeholder="Optional notes"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Close the `ContactsTab` function after the edit mode return.

---

## Files to change

| File | What changes |
|------|-------------|
| `supabase/migrations/031_project_contacts.sql` | New — project_contacts table |
| `src/app/api/pm/projects/route.ts` | Add contacts fetch to project-data section |
| `src/app/api/pm/contacts/route.ts` | New — PUT handler for saving contacts |
| `src/app/pm/page.tsx` | New tab type, tab button, contacts state, ContactsTab component |

No admin UI changes in this task. No customer portal changes.

---

## Run migration

After creating `supabase/migrations/031_project_contacts.sql`, run it against the
remote Supabase project using the CLI:

```bash
npx supabase db push
```

If the project is not yet linked, link it first:

```bash
npx supabase link --project-ref eb11901ade026e63
```

Then re-run `npx supabase db push`.

If the CLI push fails for any reason (auth, network), fall back to executing the SQL
directly via a Node script using the service role key:

```ts
// scripts/run-migration-031.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const sql = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/031_project_contacts.sql"),
  "utf8"
);

const { error } = await client.rpc("exec_sql", { sql });
if (error) {
  console.error("Migration failed:", error.message);
  process.exit(1);
}
console.log("Migration 031 complete.");
```

Note: if `exec_sql` RPC doesn't exist, use the Supabase dashboard as a last resort.

---

## Acceptance criteria

- [ ] Migration runs clean; `project_contacts` table exists
- [ ] Contacts tab appears in PM portal at position 2 (after Overview, before Weekly Update)
- [ ] Read mode shows empty state when no contacts, card grid when contacts exist
- [ ] Phone numbers are `tel:` links, emails are `mailto:` links in read mode
- [ ] "Edit Contacts" button switches to edit mode
- [ ] Edit mode shows a form row for each of the 7 predefined roles
- [ ] "Cancel" discards changes and returns to read mode
- [ ] "Save Changes" sends PUT to `/api/pm/contacts`, updates the displayed contacts on success
- [ ] Empty rows are not saved (if company/name/phone/email/notes all blank, row is omitted)
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `Add project contacts tab to PM portal`
Push to main.
