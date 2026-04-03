# Task 036 — Fix Project Save

## Problem

The Edit Project modal is not saving. The save was just moved to a server-side API route
at `src/app/api/admin/save-project/route.ts` in commit `656577c`, but it is still not working.

## What to do

1. Open `src/app/api/admin/save-project/route.ts` and verify:
   - Session verification works (same pattern as `/api/admin/data`)
   - The service-role client is constructed correctly
   - The payload destructuring matches what the client sends
   - Errors are returned with useful messages

2. Open `src/components/admin-projects-tab.tsx` and find `handleSaveProject`:
   - Confirm `saveError` state is set on failure and displayed in the modal
   - Add `console.error` logging so errors appear in the browser console
   - Confirm the fetch call includes `credentials: "include"`

3. Open `src/components/ops-project-list.tsx` and find its `handleSaveProject`:
   - It still uses the browser Supabase client for writes (same broken pattern)
   - Migrate it to use `POST /api/admin/save-project` the same way admin-projects-tab does
   - Add error display the same way

4. Test by checking the browser Network tab for the `/api/admin/save-project` request:
   - What HTTP status is returned?
   - What is the response body?
   - Fix the root cause based on what the response says

5. Run `npm run build` — must pass clean.

6. Commit and push each fix to `origin/main` as you go.

## Reference: working server route pattern

```ts
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
if (!["admin", "ops_manager"].includes(profile?.role ?? "")) {
  return NextResponse.json({ error: "Access denied." }, { status: 403 });
}

const adminClient = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

## Output

Create `codex/task-036-output.md` with:
- What the actual error was
- What files were changed
- Final build status
