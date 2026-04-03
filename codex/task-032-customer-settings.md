# Task 032 — Customer Portal Access & Email Digest Settings

## Context
TCC ProjectHub — Next.js 16 / Supabase / Tailwind app.

## Goal
1. Add "Email Digest" and "Portal Access" checkboxes per project in the project edit modal
2. Customer portal only shows projects where `customer_portal_access = true`
3. Make the "Add New Customer" option in the project modal's customer dropdown more obvious

The customer portal (`/customer`) already renders % complete and all weekly updates — no changes needed there.

---

## Database migration — `supabase/migrations/011_customer_project_settings.sql`

Create this file (Timothy runs it manually):

```sql
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS customer_portal_access boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS customer_email_digest  boolean NOT NULL DEFAULT false;
```

---

## Files to modify

### 1. `src/types/database.ts`
Add `customer_portal_access: boolean` and `customer_email_digest: boolean` to the `Project` type.

### 2. `src/components/project-modal.tsx`

**Add to `ProjectFormValues` type:**
```ts
customerPortalAccess: boolean;
customerEmailDigest: boolean;
```

**Add to `EMPTY_PROJECT_FORM`:**
```ts
customerPortalAccess: true,
customerEmailDigest: false,
```

**Add a "Customer Notifications" section** in the modal body (below the existing project fields, before the Team section). Render two checkboxes:

```
Customer Notifications
[ ] Portal Access   — Customer can log in and view this project in the customer portal
[ ] Email Digest    — Customer receives periodic email progress updates
```

Use the same checkbox styling pattern already used for `allConduitPlenum`, `certifiedPayroll`, etc. in the modal.

**Customer dropdown — make "Add New Customer" more visible:**

Currently the dropdown has a `__new__` option that activates an inline new-customer form. Change the dropdown option text from a plain "Add new customer..." option to a clearly labeled button below the dropdown:

- Keep the `<select>` for existing customers (remove the `__new__` option from the select)
- Below the select, add a small "+ Add new customer" text button that sets `useNewCustomer = true`
- When `useNewCustomer = true`, hide the select and show the new customer fields (name + email) with a "Cancel" link to go back to the select

This makes the add-new flow more discoverable.

### 3. `src/components/admin-projects-tab.tsx`
In the project save/update call, include the new fields:
```ts
customer_portal_access: formValues.customerPortalAccess,
customer_email_digest: formValues.customerEmailDigest,
```

When opening an existing project for edit, populate the form:
```ts
customerPortalAccess: project.customer_portal_access ?? true,
customerEmailDigest: project.customer_email_digest ?? false,
```

### 4. `src/components/ops-project-list.tsx`
Same as admin: include `customer_portal_access` and `customer_email_digest` in the project update call, and populate from the loaded project data.

The `ProjectEditorRow` type in ops-project-list.tsx needs:
```ts
customer_portal_access: boolean;
customer_email_digest: boolean;
```

And the project select fields constant (`PROJECT_SELECT_FIELDS`) needs both columns added.

### 5. `src/app/customer/page.tsx`
Add `.eq("customer_portal_access", true)` to the projects query (in addition to `.eq("is_active", true)`):

```ts
const { data: projectData } = await supabase
  .from("projects")
  .select("id, name, estimated_income")
  .eq("customer_id", customer.id)
  .eq("is_active", true)
  .eq("customer_portal_access", true)
  .order("name");
```

---

## Output checklist
- [ ] `supabase/migrations/011_customer_project_settings.sql` created (not run)
- [ ] `src/types/database.ts` updated
- [ ] `src/components/project-modal.tsx` — two new checkboxes + improved new-customer UX
- [ ] `src/components/admin-projects-tab.tsx` — save + load new fields
- [ ] `src/components/ops-project-list.tsx` — save + load new fields
- [ ] `src/app/customer/page.tsx` — filter by `customer_portal_access`
- [ ] `npm run build` passes clean
- [ ] Commit as `Add customer portal access and email digest settings (task-032)` and push to origin main
