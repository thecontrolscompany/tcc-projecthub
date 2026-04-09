# Task 067 — Consolidate pm_directory as Master People Record

## Permissions required — confirm before starting

1. Full read/write to this repository
2. Supabase CLI: run `npx supabase db push` to apply migrations to production
3. No `.env` changes required

---

## Context

The app has two tables that represent the same people:

- **`profiles`** — portal auth accounts. `id` is locked to `auth.users.id`. Fields: `id, email, full_name, role`. Created automatically by the `handle_new_user` trigger on auth signup.
- **`pm_directory`** — the full contact directory (TCC staff + external contacts). Fields: `id, email, first_name, last_name, phone, intended_role, profile_id`. `profile_id` is a nullable FK → `profiles.id`.

The link is one-directional: `pm_directory.profile_id → profiles.id`. There is **no reverse FK**. This causes the QB Time reconcile queue (`/time/reconcile`) to match against `profiles` only — but most employees exist in `pm_directory` without a portal account yet, so they never appear as candidates.

The auth callback at `src/app/auth/callback/route.ts` already handles first-login linking: it finds the pm_directory row by email, sets `pm_directory.profile_id = user.id`, and applies `intended_role` to the profile. This logic is **correct and must be preserved exactly**.

---

## Goal

Make `pm_directory` the authoritative people record. Add a reverse FK `profiles.pm_directory_id`. Backfill both directions by email. Update the QB reconcile to match against `pm_directory` instead of just `profiles`. Keep both tables in sync whenever a user is created. Unify the admin contacts UI into one list.

---

## Step 1 — Migration 041: Add reverse FK and phone to profiles

Create `supabase/migrations/041_profiles_pm_directory_link.sql`:

```sql
-- Reverse FK from profiles back to pm_directory
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pm_directory_id uuid
    REFERENCES public.pm_directory(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_pm_directory_id
  ON public.profiles(pm_directory_id);

-- Surface phone on profiles (sourced from pm_directory)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;
```

Push: `npx supabase db push`

---

## Step 2 — Migration 042: Backfill both directions by email

Create `supabase/migrations/042_backfill_people_links.sql`:

```sql
-- Set profiles.pm_directory_id where email matches
UPDATE public.profiles p
SET
  pm_directory_id = pmd.id,
  phone           = COALESCE(p.phone, pmd.phone)
FROM public.pm_directory pmd
WHERE LOWER(TRIM(pmd.email)) = LOWER(TRIM(p.email))
  AND p.pm_directory_id IS NULL;

-- Set pm_directory.profile_id where email matches and not yet linked
UPDATE public.pm_directory pmd
SET profile_id = p.id
FROM public.profiles p
WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(pmd.email))
  AND pmd.profile_id IS NULL;
```

Push: `npx supabase db push`

---

## Step 3 — Update auth callback to set the reverse FK on first login

**File:** `src/app/auth/callback/route.ts`

This file already links `pm_directory.profile_id = user.id` on first login (around line 39–43). After that `pm_directory.update` call, add the reverse link on the profile:

```typescript
// Existing code sets pm_directory.profile_id — keep that exactly as-is.
// Add this immediately after it:
if (pmDirectory?.id) {
  await adminClient
    .from("profiles")
    .update({ pm_directory_id: pmDirectory.id })
    .eq("id", user.id)
    .is("pm_directory_id", null);
}
```

Do not change anything else in this file.

---

## Step 4 — Update create-user API to always link pm_directory

**File:** `src/app/api/admin/create-user/route.ts`

After the existing `await adminClient.from("profiles").upsert(...)` call, add a block that finds or creates the pm_directory entry and links both directions:

```typescript
if (newUser.user) {
  const userId = newUser.user.id;
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? fullName;
  const lastName = nameParts.slice(1).join(" ") || null;

  const { data: existingPmd } = await adminClient
    .from("pm_directory")
    .select("id, profile_id")
    .ilike("email", email)
    .maybeSingle();

  let pmdId: string;

  if (existingPmd) {
    pmdId = existingPmd.id;
    if (!existingPmd.profile_id) {
      await adminClient
        .from("pm_directory")
        .update({ profile_id: userId })
        .eq("id", pmdId);
    }
  } else {
    const { data: newPmd } = await adminClient
      .from("pm_directory")
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        profile_id: userId,
        intended_role: ["pm", "lead", "installer", "ops_manager"].includes(role)
          ? role
          : null,
      })
      .select("id")
      .single();
    pmdId = newPmd!.id;
  }

  await adminClient
    .from("profiles")
    .update({ pm_directory_id: pmdId })
    .eq("id", userId)
    .is("pm_directory_id", null);
}
```

---

## Step 5 — Update project-portal-contact API to set the reverse FK

**File:** `src/app/api/admin/project-portal-contact/route.ts`

In the `POST` handler, after the `profiles.upsert(...)` call (around line 76–87), add:

```typescript
// Set the reverse link on the newly created or existing profile
await adminClient
  .from("profiles")
  .update({ pm_directory_id: pmDirectoryId })
  .eq("id", resolvedProfileId)
  .is("pm_directory_id", null);
```

Do not change anything else in this file.

---

## Step 6 — Update import-pm-directory API to link existing profiles

**File:** `src/app/api/admin/import-pm-directory/route.ts`

After the bulk pm_directory upsert completes (find the point where pm_directory rows have been inserted/updated), add a pass that links any portal profiles that already exist for those emails:

```typescript
// After the pm_directory bulk upsert loop:
const upsertedEmails = candidatesForUpsert.map((c: { email: string }) =>
  c.email.toLowerCase()
);

if (upsertedEmails.length > 0) {
  const { data: matchedProfiles } = await adminClient
    .from("profiles")
    .select("id, email")
    .in("email", upsertedEmails);

  for (const profile of matchedProfiles ?? []) {
    const { data: pmdEntry } = await adminClient
      .from("pm_directory")
      .select("id, profile_id")
      .ilike("email", profile.email)
      .maybeSingle();

    if (pmdEntry) {
      if (!pmdEntry.profile_id) {
        await adminClient
          .from("pm_directory")
          .update({ profile_id: profile.id })
          .eq("id", pmdEntry.id);
      }
      await adminClient
        .from("profiles")
        .update({ pm_directory_id: pmdEntry.id })
        .eq("id", profile.id)
        .is("pm_directory_id", null);
    }
  }
}
```

To find the right insertion point: look for where the import loop ends and results are returned. The variable holding the upsert candidates may be named differently — read the file, find the array of contacts being upserted into pm_directory, and use that array's email values.

---

## Step 7 — Fix the QB Time reconcile data layer

This is the core fix. The reconcile snapshot at `src/lib/time/data.ts` currently scores QB users against `profiles` entries only. Change it to score against `pm_directory` entries, which is the actual people directory and has first/last name separately (better matching).

### 7a — Update interfaces in `src/lib/time/data.ts`

Replace the existing `TimeReconcileCandidate`, `TimeReconcileUser`, `TimeReconcileProfile`, and `TimeReconcileSnapshot` interfaces with:

```typescript
export interface TimeReconcileCandidate {
  id: string;               // pm_directory.id
  fullName: string;
  email: string;
  phone: string | null;
  profileId: string | null; // null = no portal account yet
  profileRole: UserRole | null;
  hasPortalAccount: boolean;
  score: number;
  reasons: string[];
}

export interface TimeReconcileUser {
  qbUserId: number;
  displayName: string;
  email: string;
  username: string;
  payrollId: string;
  active: boolean;
  suggestions: TimeReconcileCandidate[];
}

export interface TimeReconcileProfile {
  id: string;               // pm_directory.id
  fullName: string;
  email: string;
  phone: string | null;
  profileId: string | null;
  role: UserRole | null;
}

export interface TimeReconcileSnapshot {
  users: TimeReconcileUser[];
  eligibleProfiles: TimeReconcileProfile[];
  ignoredCount: number;
  mappedCount: number;
}
```

Also add this internal type near the other row types at the top of the file:

```typescript
type PmdCandidateRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  profile_id: string | null;
  profile: { id?: string; role?: string } | { id?: string; role?: string }[] | null;
};
```

### 7b — Replace `buildCandidate` with `buildPmdCandidate`

Remove the old `buildCandidate` function entirely. Add:

```typescript
function buildPmdCandidate(
  user: Pick<QbUserRow, "qb_user_id" | "display_name" | "email">,
  pmd: { id: string; fullName: string; email: string; phone: string | null; profileId: string | null; profileRole: UserRole | null }
): TimeReconcileCandidate | null {
  const reasons: string[] = [];
  let score = 0;

  const userEmail = normalizeValue(user.email);
  const pmdEmail = normalizeValue(pmd.email);
  const userEmailLocal = userEmail.split("@")[0] ?? "";
  const pmdEmailLocal = pmdEmail.split("@")[0] ?? "";

  if (userEmail && pmdEmail && userEmail === pmdEmail) {
    score += 100;
    reasons.push("Exact email match");
  }

  if (normalizeName(user.display_name) === normalizeName(pmd.fullName)) {
    score += 85;
    reasons.push("Exact name match");
  }

  if (userEmailLocal && pmdEmailLocal && userEmailLocal === pmdEmailLocal) {
    score += 45;
    reasons.push("Email local-part match");
  }

  const userParts = splitNameParts(user.display_name);
  const pmdParts = splitNameParts(pmd.fullName);
  const overlap = userParts.filter((p) => pmdParts.includes(p));

  if (overlap.length >= 2) {
    score += 40;
    reasons.push("First and last name overlap");
  } else if (overlap.length === 1) {
    score += 18;
    reasons.push(`Name overlap: ${overlap[0]}`);
  }

  if (!score) return null;

  return {
    id: pmd.id,
    fullName: pmd.fullName,
    email: pmd.email,
    phone: pmd.phone,
    profileId: pmd.profileId,
    profileRole: pmd.profileRole,
    hasPortalAccount: Boolean(pmd.profileId),
    score,
    reasons,
  };
}
```

### 7c — Replace `loadPortalReconcileSnapshot`

Replace the entire `loadPortalReconcileSnapshot` function with:

```typescript
async function loadPortalReconcileSnapshot() {
  const supabase = createPortalTimeClient();

  const [qbUsersResult, mappingsResult, pmdResult, reviewStatesResult] = await Promise.all([
    supabase
      .from("qb_time_users")
      .select("qb_user_id, display_name, email, username, payroll_id, active")
      .order("display_name"),
    supabase
      .from("profile_qb_time_mappings")
      .select("qb_user_id, profile_id")
      .eq("is_active", true),
    supabase
      .from("pm_directory")
      .select("id, first_name, last_name, email, phone, profile_id, profile:profiles(id, role)")
      .order("last_name")
      .order("first_name"),
    supabase
      .from("qb_time_user_review_states")
      .select("qb_user_id, status"),
  ]);

  if (qbUsersResult.error) throw qbUsersResult.error;
  if (mappingsResult.error) throw mappingsResult.error;
  if (pmdResult.error) throw pmdResult.error;
  if (reviewStatesResult.error) throw reviewStatesResult.error;

  const mappedQbUserIds = new Set(
    (mappingsResult.data ?? []).map((m: { qb_user_id: number }) => m.qb_user_id)
  );
  const mappedProfileIds = new Set(
    (mappingsResult.data ?? [])
      .map((m: { profile_id: string }) => m.profile_id)
      .filter(Boolean)
  );
  const ignoredQbUserIds = new Set(
    ((reviewStatesResult.data ?? []) as PortalReviewStateRow[])
      .filter((s) => s.status === "ignored")
      .map((s) => s.qb_user_id)
  );

  // Normalise pm_directory rows
  const allPmd = ((pmdResult.data ?? []) as PmdCandidateRow[]).map((entry) => {
    const profile = Array.isArray(entry.profile) ? entry.profile[0] : entry.profile;
    const profileId = profile?.id ?? entry.profile_id ?? null;
    return {
      id: entry.id,
      fullName:
        [entry.first_name, entry.last_name].filter(Boolean).join(" ").trim() ||
        entry.email ||
        "Unnamed",
      email: entry.email ?? "",
      phone: entry.phone ?? null,
      profileId,
      profileRole: (profile?.role ?? null) as UserRole | null,
    };
  });

  // Eligible = pm_directory entries whose linked profile is NOT already QB-mapped
  const eligiblePmd = allPmd.filter(
    (p) => !p.profileId || !mappedProfileIds.has(p.profileId)
  );

  const users = (
    (qbUsersResult.data ?? []) as Array<
      Pick<QbUserRow, "qb_user_id" | "display_name" | "email" | "username" | "payroll_id" | "active">
    >
  )
    .filter(
      (u) =>
        !mappedQbUserIds.has(u.qb_user_id) &&
        !ignoredQbUserIds.has(u.qb_user_id)
    )
    .map((user) => ({
      qbUserId: user.qb_user_id,
      displayName: user.display_name,
      email: user.email ?? "",
      username: user.username ?? "",
      payrollId: user.payroll_id ?? "",
      active: user.active,
      suggestions: eligiblePmd
        .map((pmd) => buildPmdCandidate(user, pmd))
        .filter((c): c is TimeReconcileCandidate => Boolean(c))
        .sort((a, b) => b.score - a.score || a.fullName.localeCompare(b.fullName))
        .slice(0, 5),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return {
    users,
    eligibleProfiles: eligiblePmd.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      email: p.email,
      phone: p.phone,
      profileId: p.profileId,
      role: p.profileRole,
    })),
    ignoredCount: ignoredQbUserIds.size,
    mappedCount: mappedQbUserIds.size,
  } satisfies TimeReconcileSnapshot;
}
```

---

## Step 8 — Update the reconcile API to accept pmDirectoryId

**File:** `src/app/api/time/reconcile/route.ts`

### 8a — Change the Zod schema for `map_existing_profile`

Replace `profileId: z.uuid()` with `pmDirectoryId: z.uuid()`:

```typescript
z.object({
  action: z.literal("map_existing_profile"),
  qbUserId: z.number().int().positive(),
  pmDirectoryId: z.uuid()
}),
```

Remove the `create_portal_user` action from the discriminated union and its handler entirely — user creation is now handled inline when the pm_directory entry has no profile.

### 8b — Replace the `map_existing_profile` handler

```typescript
if (parsed.data.action === "map_existing_profile") {
  const { qbUserId, pmDirectoryId } = parsed.data;

  const [{ data: qbUser, error: qbUserError }, { data: pmdEntry, error: pmdError }] =
    await Promise.all([
      client.from("qb_time_users").select("qb_user_id").eq("qb_user_id", qbUserId).maybeSingle(),
      client
        .from("pm_directory")
        .select("id, email, first_name, last_name, profile_id")
        .eq("id", pmDirectoryId)
        .maybeSingle(),
    ]);

  if (qbUserError) throw qbUserError;
  if (pmdError) throw pmdError;
  if (!qbUser) return NextResponse.json({ error: "QuickBooks user not found." }, { status: 404 });
  if (!pmdEntry) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  let profileId = pmdEntry.profile_id;

  // If no portal account yet, create one
  if (!profileId) {
    if (!pmdEntry.email) {
      return NextResponse.json(
        { error: "This contact has no email — cannot create a portal account." },
        { status: 400 }
      );
    }
    const fullName =
      [pmdEntry.first_name, pmdEntry.last_name].filter(Boolean).join(" ").trim() ||
      pmdEntry.email;
    const tempPassword = generateTemporaryPassword();

    const { data: created, error: createError } = await client.auth.admin.createUser({
      email: pmdEntry.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "installer" },
    });

    if (createError) throw createError;
    profileId = created.user?.id ?? null;
    if (!profileId) {
      return NextResponse.json({ error: "Failed to create portal account." }, { status: 500 });
    }

    await client.from("profiles").upsert({
      id: profileId,
      email: pmdEntry.email,
      full_name: fullName,
      role: "installer",
      pm_directory_id: pmDirectoryId,
    });
    await client
      .from("pm_directory")
      .update({ profile_id: profileId })
      .eq("id", pmDirectoryId);
  } else {
    // Ensure reverse link is set
    await client
      .from("profiles")
      .update({ pm_directory_id: pmDirectoryId })
      .eq("id", profileId)
      .is("pm_directory_id", null);
  }

  const { error: upsertError } = await client.from("profile_qb_time_mappings").upsert(
    {
      profile_id: profileId,
      qb_user_id: qbUserId,
      match_source: "manual_admin_map",
      confidence_score: 100,
      is_active: true,
    },
    { onConflict: "profile_id,qb_user_id" }
  );
  if (upsertError) throw upsertError;

  await client.from("qb_time_user_review_states").delete().eq("qb_user_id", qbUserId);

  return NextResponse.json({ success: true });
}
```

The `ignore_user` handler is unchanged.

---

## Step 9 — Update the reconcile UI component

**File:** `src/components/time/time-reconcile-page.tsx`

### 9a — Remove the "Create portal user" section entirely

The role selector card and "Create portal user" button are gone — portal accounts are now created automatically inside the API when a pm_directory entry has no profile. Remove:
- The `RoleState` type
- The `selectedRoles` state
- The `DEFAULT_ROLE` and `ROLE_OPTIONS` constants
- The entire "Create portal user" card JSX
- `"create"` from `PendingState`

### 9b — Update suggestion cards

Each candidate now has `hasPortalAccount`, `phone`, and `profileId`. Update the candidate card to show:
- A `StateChip` labelled "portal active" (success) if `hasPortalAccount`, or "no portal account" (warn) if not
- Phone number if present: `{candidate.phone && <span>Phone: {candidate.phone}</span>}`
- Note below the Map button when `!hasPortalAccount`: `<p className="mt-1 text-xs text-text-secondary">A portal account will be created automatically.</p>`

### 9c — Update `runAction` payload type

```typescript
async function runAction(
  qbUserId: number,
  payload:
    | { action: "map_existing_profile"; pmDirectoryId: string }
    | { action: "ignore_user" },
  pendingState: "map" | "ignore"
)
```

All `{ action: "map_existing_profile", profileId: ... }` calls → `{ action: "map_existing_profile", pmDirectoryId: ... }`.

### 9d — Update the manual picker

The `eligibleProfiles` entries now have `id` = pm_directory id, `phone`, `profileId`, `role`. Update the select option label:

```typescript
<option key={profile.id} value={profile.id}>
  {profile.fullName} ({profile.email})
  {profile.phone ? ` · ${profile.phone}` : ""}
  {" · "}
  {profile.role ?? (profile.profileId ? "portal user" : "no portal account")}
</option>
```

The Map button `onClick` passes `{ action: "map_existing_profile", pmDirectoryId: manualPickId }`.

---

## Step 10 — Unify the admin contacts data endpoint

**File:** `src/app/api/admin/data/route.ts`

Replace the `section === "contacts"` handler with a single joined query:

```typescript
if (section === "contacts") {
  if (requesterRole !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { data, error } = await adminClient
    .from("pm_directory")
    .select(`
      id, email, first_name, last_name, phone, intended_role, profile_id,
      profile:profiles(id, full_name, role, pm_directory_id)
    `)
    .order("last_name")
    .order("first_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ contacts: data ?? [] });
}
```

The separate `section === "users"` handler stays unchanged — it powers the User Management tab.

---

## Step 11 — Update `src/types/database.ts`

Add `pm_directory_id` and `phone` to the `Profile` type (or wherever profiles fields are typed). Find the Profile interface/type and add:

```typescript
pm_directory_id: string | null;
phone: string | null;
```

---

## Step 12 — Build, verify, commit, push

```bash
npm run build
```

Fix any TypeScript errors. Common issues to expect:
- `TimeReconcileCandidate` usages that still reference `fullName` from the old profile shape — update to the new field names
- `map_existing_profile` callers that still pass `profileId` — update to `pmDirectoryId`
- The `section=contacts` response type in any frontend component that destructures `{ contacts, profiles }` — update to just `{ contacts }`

Once build is clean:

```bash
git add -A
git commit -m "$(cat <<'EOF'
Consolidate pm_directory as master people record

Add profiles.pm_directory_id reverse FK (migration 041). Backfill both
directions by email (migration 042). Update auth callback, create-user,
import-pm-directory, and project-portal-contact to keep links in sync.

Fix QB Time reconcile to match against pm_directory instead of profiles
only — this is why the team wasn't appearing in the reconcile queue.
Employees in pm_directory without portal accounts now show as candidates;
mapping them auto-creates a portal account if needed.

Unify admin contacts data endpoint to join pm_directory + profile in
one query.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push
```

---

## What NOT to change

- `project_contacts` table or any code that reads/writes it — it is external contractor data, completely separate from the people identity system
- `project_customer_contacts` table — it is a permissions matrix and is correct as-is
- `project_assignments` table or its queries — it correctly accepts either `profile_id` or `pm_directory_id`
- All RLS policies — auth is unchanged
- The `handle_new_user` DB trigger — the migration does not modify it; the auth signup flow is unchanged
- The `intended_role` application logic in `src/app/auth/callback/route.ts` — preserve exactly, only add the reverse FK write as described in Step 3

---

## Validation checklist before committing

- [ ] `npx supabase db push` succeeds for migrations 041 and 042
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `/time/reconcile` page loads (snapshot returns data, no 500)
- [ ] `/admin/contacts` page loads (contacts list renders)
- [ ] `/api/admin/data?section=contacts` returns `{ contacts: [...] }` (not 500)
- [ ] `/api/admin/data?section=users` still returns `{ users: [...] }` (unchanged)
- [ ] `/api/admin/data?section=project-lookups` still returns `{ customers, profiles, contacts }` (unchanged)

---

## Single-line prompt for Codex

```
Read codex/task-067-consolidate-people-records.md and implement all changes. Confirm permissions at the start.
```
