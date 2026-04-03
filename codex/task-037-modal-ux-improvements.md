# Task 037 — Project Modal UX Improvements

Four focused improvements to the project edit/create modal and PM directory form.

---

## 1 — Fix contractor autocomplete with a custom ComboboxInput

**Problem**: The current `<datalist>` approach only shows suggestions when existing DB records have contractor names. If the database is empty or sparse, nothing appears — the user just sees a plain text input.

**Fix**: Build a reusable `ComboboxInput` component in `src/components/project-modal.tsx` (co-located, not a separate file) that:
- Renders a text `<input>` with a dropdown below it
- Shows all `suggestions` on focus
- Filters suggestions as the user types (case-insensitive `includes` match)
- Still allows typing any free text — it is NOT a locked select
- Closes on blur (use `onMouseDown` on options to prevent premature blur) or on selection
- Keyboard: ArrowDown/ArrowUp navigates the list; Enter selects the highlighted item; Escape closes
- Uses the existing `inputClassName` styling; dropdown uses `bg-surface-raised border border-border-default rounded-xl shadow-lg` positioned absolutely below the input with `z-50`

Replace all three contractor fields (General, Mechanical, Electrical) with `<ComboboxInput>`:

```tsx
<ComboboxInput
  value={values.generalContractor}
  onChange={(v) => onChange("generalContractor", v)}
  suggestions={contractorNames ?? []}
  className={inputClassName}
/>
```

Remove the old `<datalist id="contractor-names-list">` element and the `list="contractor-names-list"` attributes entirely.

---

## 2 — Site address autocomplete via Nominatim (OpenStreetMap)

**Problem**: Site address uses the same empty-datalist pattern. User wants real address suggestions as they type.

**Fix**: Build a `SiteAddressInput` component in `src/components/project-modal.tsx` that queries the Nominatim API for address suggestions:

```
https://nominatim.openstreetmap.org/search?q={query}&format=json&addressdetails=1&limit=5&countrycodes=us
```

Requirements:
- Debounce the query by 300ms (use `useEffect` with a `setTimeout`/`clearTimeout` — no external debounce library)
- Show a loading indicator ("Searching…") while fetching
- Display results as `display_name` from the Nominatim JSON response
- On selection, set the value to `display_name`
- Still allows the user to type and save any free text — do not lock the input
- Add the required Nominatim User-Agent header: `User-Agent: tcc-projecthub/1.0 (timothy@thecontrolsco.com)`
- Only fire the query when the input is at least 4 characters
- On blur, if no selection was made, keep whatever the user typed

Replace the site address `<input list="site-addresses-list">` and its `<datalist>` with `<SiteAddressInput>`:

```tsx
<SiteAddressInput
  value={values.siteAddress}
  onChange={(v) => onChange("siteAddress", v)}
  className={inputClassName}
/>
```

---

## 3 — Phone number autoformat in PM Directory form

**File**: `src/app/admin/page.tsx`

**Where**: The PM Directory tab form uses `formPhone` state for the phone input field.

**Fix**: Add a `formatPhone` utility function at the top of that file:

```ts
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
```

Change the phone `<input>` `onChange` to:
```tsx
onChange={(e) => setFormPhone(formatPhone(e.target.value))}
```

Also display existing phone values through `formatPhone` wherever `pm.phone` is rendered in the directory table, so stored values like `5555551234` or `555-555-1234` all display uniformly as `(555) 555-1234`.

---

## 4 — Primary PM designation when multiple PMs assigned

**Problem**: When a project has multiple PM assignments, `pm_id` on the `projects` table is set to whichever PM happens to be found first. There's no way to explicitly designate one as primary.

### Client changes — `src/components/project-modal.tsx`

1. Add `primaryPersonId: string | null` to the `ProjectModal` props.
2. Add `onSetPrimary: (personId: string) => void` to the props.
3. In the assignments list, for any assignment where `roleOnProject === "pm"`:
   - If `assignment.personId === primaryPersonId`: show a gold star badge `★ Primary` next to the name
   - Otherwise: show a small `Set Primary` button that calls `onSetPrimary(assignment.personId)`

No DB schema changes — `pm_id` on `projects` already stores the primary PM.

### Client changes — `src/components/admin-projects-tab.tsx`

1. Add `primaryPersonId` state (type `string | null`, default `null`).
2. When opening edit: initialize `primaryPersonId` to the `personId` matching the project's `pm_id` (look it up in `teamMemberOptions` by `profileId`).
3. When opening new project: set `primaryPersonId` to `null`.
4. When `onAddAssignment` fires and the role is `"pm"` and `primaryPersonId` is null: auto-set `primaryPersonId` to the newly added person's id.
5. When `onRemoveAssignment` removes the current primary: set `primaryPersonId` to the next PM assignment's personId, or `null` if none remain.
6. Pass `primaryPersonId` and `onSetPrimary={(id) => setPrimaryPersonId(id)}` to `<ProjectModal>`.
7. In `handleSaveProject`, when building `resolvedAssignments`, add `is_primary: assignment.personId === primaryPersonId` to each resolved assignment object.

### Server changes — `src/app/api/admin/save-project/route.ts`

1. Update `ResolvedAssignment` type to include `is_primary?: boolean`.
2. Change line:
   ```ts
   const primaryPm = resolvedAssignments.find((a) => a.role_on_project === "pm") ?? null;
   ```
   to:
   ```ts
   const primaryPm =
     resolvedAssignments.find((a) => a.role_on_project === "pm" && a.is_primary) ??
     resolvedAssignments.find((a) => a.role_on_project === "pm") ??
     null;
   ```
   (Falls back to first PM if none explicitly marked primary.)

---

## 5 — Build + commit

- Run `npm run build` — must pass clean.
- Commit all changes as one commit: `"Add combobox autocomplete, Nominatim address search, phone format, primary PM"` and push to `origin/main`.
- Create `codex/task-037-output.md` with: what was changed, any issues hit, final build status.
