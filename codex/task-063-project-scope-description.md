# Task 063 — Project Scope Description

## Context

The `projects` table has a `notes` field that is used for internal admin notes.
Customers have no way to see a plain-language description of what the project
actually involves. This task adds a separate `scope_description` field (customer-
and PM-facing) and surfaces it on both portals.

---

## 1. Migration — `supabase/migrations/033_project_scope_description.sql`

```sql
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS scope_description text;
```

Run with:
```bash
npx supabase link --project-ref eb11901ade026e63
npx supabase db push
```

---

## 2. Admin project modal — `src/components/project-modal.tsx`

### 2a. Add to `ProjectFormValues` type

```ts
scopeDescription: string;
```

### 2b. Add to `EMPTY_PROJECT_FORM`

```ts
scopeDescription: "",
```

### 2c. Add textarea to the form UI

After the `notes` field (internal notes), add a clearly labelled customer-facing field:

```tsx
<div>
  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
    Scope Description
    <span className="ml-1 normal-case font-normal text-text-tertiary">(visible to customer)</span>
  </label>
  <textarea
    rows={3}
    className={textareaClassName}
    placeholder="Brief description of work scope visible on customer portal"
    value={values.scopeDescription}
    onChange={(e) => onChange("scopeDescription", e.target.value)}
  />
</div>
```

### 2d. Pre-populate for existing projects

In the block where existing project values are mapped into the form (find the block
containing `generalContractor: project.general_contractor ?? ""`), add:

```ts
scopeDescription: project.scope_description ?? "",
```

---

## 3. Save-project API — `src/app/api/admin/save-project/route.ts`

### 3a. Add to formValues type

```ts
scopeDescription: string;
```

### 3b. Add to project payload

```ts
scope_description: formValues.scopeDescription.trim() || null,
```

---

## 4. PM projects API — `src/app/api/pm/projects/route.ts`

In the `project:projects(...)` select block, add:
```
scope_description,
```

Update the TypeScript type for the project shape:
```ts
scope_description: string | null;
```

---

## 5. PM portal — `src/app/pm/page.tsx`

### 5a. Add to project interface

```ts
scope_description: string | null;
```

### 5b. Display on Overview tab (read-only)

In the Overview tab, after the stats grid and before the CO summary widget, add:

```tsx
{project.scope_description && (
  <div className="rounded-2xl border border-border-default bg-surface-raised px-4 py-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-1">
      Project Scope
    </p>
    <p className="text-sm text-text-secondary leading-relaxed">
      {project.scope_description}
    </p>
  </div>
)}
```

---

## 6. Customer data API — `src/app/api/customer/data/route.ts`

Add `scope_description` to the projects select:

```ts
.select("id, name, estimated_income, job_number, site_address, general_contractor, start_date, scheduled_completion, scope_description, customer:customers(name)")
```

---

## 7. Customer portal — `src/app/customer/page.tsx`

### 7a. Add to `CustomerProject` interface

```ts
scope_description: string | null;
```

### 7b. Map in `loadProjects`

```ts
scope_description: project.scope_description ?? null,
```

### 7c. Display in `ProjectDetail` header

After the `general_contractor` line and before the progress bar section, add:

```tsx
{project.scope_description && (
  <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-xl">
    {project.scope_description}
  </p>
)}
```

---

## Files to change

| File | What changes |
|------|-------------|
| `supabase/migrations/033_project_scope_description.sql` | New — adds scope_description column |
| `src/components/project-modal.tsx` | scopeDescription field in form |
| `src/app/api/admin/save-project/route.ts` | Add to payload |
| `src/app/api/pm/projects/route.ts` | Add to project select |
| `src/app/pm/page.tsx` | Interface + display on Overview |
| `src/app/api/customer/data/route.ts` | Add to projects select |
| `src/app/customer/page.tsx` | Interface + display in ProjectDetail |

---

## Acceptance criteria

- [ ] Migration runs clean
- [ ] Admin can set scope description in project modal (textarea, below notes)
- [ ] Scope description shows on PM Overview tab when set; hidden when blank
- [ ] Scope description shows in customer portal project header when set; hidden when blank
- [ ] Internal `notes` field is unchanged
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `Add scope description field to projects`
Push to main.
