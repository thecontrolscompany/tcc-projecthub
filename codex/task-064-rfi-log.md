# Task 064 — RFI Log

## Context

The PM portal has an RFI tab that currently shows "Coming Soon". This task replaces
the stub with a functional RFI log. PMs can log field questions (RFIs) directed to
the GC, architect, engineer, or owner, track whether they've been answered, and
close them out when resolved.

RFIs are internal project management records — not shown on the customer portal.

---

## 1. Migration — `supabase/migrations/034_project_rfis.sql`

```sql
CREATE TABLE IF NOT EXISTS project_rfis (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rfi_number          integer     NOT NULL,
  subject             text        NOT NULL,
  question            text,
  directed_to         text,
  date_submitted      date        NOT NULL DEFAULT CURRENT_DATE,
  date_responded      date,
  response            text,
  status              text        NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open', 'pending_response', 'closed')),
  created_by_profile_id uuid      REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, rfi_number)
);

CREATE INDEX IF NOT EXISTS idx_project_rfis_project_id
  ON project_rfis(project_id);

CREATE OR REPLACE FUNCTION update_project_rfis_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_rfis_updated_at ON project_rfis;
CREATE TRIGGER trg_project_rfis_updated_at
  BEFORE UPDATE ON project_rfis
  FOR EACH ROW EXECUTE FUNCTION update_project_rfis_updated_at();
```

Run with:
```bash
npx supabase db push
```

---

## 2. New API route — `src/app/api/pm/rfis/route.ts`

Handle GET (list), POST (create), and PATCH (update) in one file.

```ts
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function verifyProjectAccess(projectId: string, userId: string, role: string): Promise<boolean> {
  if (role === "admin" || role === "ops_manager") return true;
  const admin = adminClient();
  const { data: pmRows } = await admin.from("pm_directory").select("id").eq("profile_id", userId);
  const pmDirIds = (pmRows ?? []).map((r: { id: string }) => r.id);
  const { data: direct } = await admin
    .from("project_assignments")
    .select("id")
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .limit(1);
  if ((direct ?? []).length > 0) return true;
  if (pmDirIds.length > 0) {
    const { data: dir } = await admin
      .from("project_assignments")
      .select("id")
      .eq("project_id", projectId)
      .in("pm_directory_id", pmDirIds)
      .limit(1);
    if ((dir ?? []).length > 0) return true;
  }
  return false;
}

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const resolvedProfile = await resolveUserRole(user);
  const role = resolvedProfile?.role ?? "customer";
  if (!["admin", "ops_manager", "pm", "lead"].includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "Missing projectId." }, { status: 400 });

  const hasAccess = await verifyProjectAccess(projectId, user.id, role);
  if (!hasAccess) return NextResponse.json({ error: "Not assigned to this project." }, { status: 403 });

  const { data, error } = await adminClient()
    .from("project_rfis")
    .select("*")
    .eq("project_id", projectId)
    .order("rfi_number", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rfis: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const resolvedProfile = await resolveUserRole(user);
  const role = resolvedProfile?.role ?? "customer";
  if (!["admin", "ops_manager", "pm", "lead"].includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.projectId) return NextResponse.json({ error: "Missing projectId." }, { status: 400 });
  if (!body?.subject?.trim()) return NextResponse.json({ error: "Subject is required." }, { status: 400 });

  const hasAccess = await verifyProjectAccess(body.projectId, user.id, role);
  if (!hasAccess) return NextResponse.json({ error: "Not assigned to this project." }, { status: 403 });

  const admin = adminClient();

  // Compute next rfi_number for this project
  const { data: existing } = await admin
    .from("project_rfis")
    .select("rfi_number")
    .eq("project_id", body.projectId)
    .order("rfi_number", { ascending: false })
    .limit(1);

  const nextNumber = ((existing?.[0]?.rfi_number ?? 0) as number) + 1;

  const { data, error } = await admin
    .from("project_rfis")
    .insert({
      project_id: body.projectId,
      rfi_number: nextNumber,
      subject: body.subject.trim(),
      question: body.question?.trim() || null,
      directed_to: body.directedTo?.trim() || null,
      date_submitted: body.dateSubmitted || new Date().toISOString().slice(0, 10),
      status: "open",
      created_by_profile_id: user.id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rfi: data });
}

export async function PATCH(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const resolvedProfile = await resolveUserRole(user);
  const role = resolvedProfile?.role ?? "customer";
  if (!["admin", "ops_manager", "pm", "lead"].includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing RFI id." }, { status: 400 });

  const admin = adminClient();
  const { data: existing } = await admin.from("project_rfis").select("project_id").eq("id", body.id).single();
  if (!existing) return NextResponse.json({ error: "RFI not found." }, { status: 404 });

  const hasAccess = await verifyProjectAccess(existing.project_id, user.id, role);
  if (!hasAccess) return NextResponse.json({ error: "Not assigned to this project." }, { status: 403 });

  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.response !== undefined) updates.response = body.response?.trim() || null;
  if (body.dateResponded !== undefined) updates.date_responded = body.dateResponded || null;
  if (body.subject !== undefined) updates.subject = body.subject.trim();
  if (body.question !== undefined) updates.question = body.question?.trim() || null;
  if (body.directedTo !== undefined) updates.directed_to = body.directedTo?.trim() || null;

  const { data, error } = await admin
    .from("project_rfis")
    .update(updates)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rfi: data });
}
```

---

## 3. PM portal — `src/app/pm/page.tsx`

### 3a. Add RFI interface and state

Add near the other interfaces at the top of the file:

```ts
interface ProjectRfi {
  id: string;
  project_id: string;
  rfi_number: number;
  subject: string;
  question: string | null;
  directed_to: string | null;
  date_submitted: string;
  date_responded: string | null;
  response: string | null;
  status: "open" | "pending_response" | "closed";
  created_at: string;
}
```

Add state near other state declarations in the project detail section:

```ts
const [rfis, setRfis] = useState<ProjectRfi[]>([]);
const [rfisLoading, setRfisLoading] = useState(false);
```

### 3b. Load RFIs when RFI tab becomes active

In the `loadData` function (or wherever project data is loaded when a project is
selected), RFIs are loaded lazily when the tab is first opened. In the tab click
handler for `"rfis"`, trigger a load if not yet loaded:

Add a helper:

```ts
async function loadRfis(projectId: string) {
  if (rfisLoading) return;
  setRfisLoading(true);
  try {
    const res = await fetch(`/api/pm/rfis?projectId=${encodeURIComponent(projectId)}`, {
      credentials: "include",
    });
    const json = await res.json();
    if (res.ok) setRfis(json.rfis ?? []);
  } catch {
    // silently ignore
  } finally {
    setRfisLoading(false);
  }
}
```

When `setActiveTab("rfis")` is called and rfis.length === 0 and !rfisLoading, call
`void loadRfis(project.id)`.

Also reset rfis when a new project is selected:
In the project selection handler (where other state like `changeOrders` is reset),
add `setRfis([])`.

### 3c. Replace RFI tab content

Find and replace the existing `{activeTab === "rfis" && (...)}` block:

```tsx
{activeTab === "rfis" && (
  <RfiTab
    projectId={project.id}
    rfis={rfis}
    loading={rfisLoading}
    onCreated={(rfi) => setRfis((prev) => [rfi, ...prev])}
    onUpdated={(rfi) => setRfis((prev) => prev.map((r) => (r.id === rfi.id ? rfi : r)))}
  />
)}
```

---

## 4. New `RfiTab` component (add at bottom of `src/app/pm/page.tsx`)

Add before `PmTabButton`:

```tsx
const RFI_DIRECTED_TO_OPTIONS = [
  "General Contractor",
  "Architect",
  "Engineer",
  "Owner / Owner's Rep",
  "Other",
];

function RfiTab({
  projectId,
  rfis,
  loading,
  onCreated,
  onUpdated,
}: {
  projectId: string;
  rfis: ProjectRfi[];
  loading: boolean;
  onCreated: (rfi: ProjectRfi) => void;
  onUpdated: (rfi: ProjectRfi) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New RFI form state
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [directedTo, setDirectedTo] = useState("");
  const [dateSubmitted, setDateSubmitted] = useState(() => new Date().toISOString().slice(0, 10));

  // Close-out state per RFI
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeResponse, setCloseResponse] = useState("");
  const [closeDate, setCloseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [closeStatus, setCloseStatus] = useState<"pending_response" | "closed">("closed");

  function resetForm() {
    setSubject("");
    setQuestion("");
    setDirectedTo("");
    setDateSubmitted(new Date().toISOString().slice(0, 10));
    setFormError(null);
  }

  async function submitRfi() {
    if (!subject.trim()) { setFormError("Subject is required."); return; }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/pm/rfis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId, subject, question, directedTo, dateSubmitted }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save.");
      onCreated(json.rfi as ProjectRfi);
      resetForm();
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function updateRfi(id: string, updates: Partial<{ status: string; response: string; dateResponded: string }>) {
    setSaving(true);
    try {
      const res = await fetch("/api/pm/rfis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, ...updates }),
      });
      const json = await res.json();
      if (res.ok) {
        onUpdated(json.rfi as ProjectRfi);
        setClosingId(null);
        setCloseResponse("");
      }
    } finally {
      setSaving(false);
    }
  }

  const statusConfig = {
    open: { label: "Open", className: "bg-status-danger/10 text-status-danger" },
    pending_response: { label: "Pending Response", className: "bg-status-warning/10 text-status-warning" },
    closed: { label: "Closed", className: "bg-status-success/10 text-status-success" },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">RFI Log</h3>
          <p className="mt-0.5 text-sm text-text-tertiary">
            Request for Information tracking.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => { resetForm(); setShowForm(true); }}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            + New RFI
          </button>
        )}
      </div>

      {showForm && (
        <div className="rounded-2xl border border-border-default bg-surface-raised p-4 space-y-3">
          <p className="text-sm font-semibold text-text-primary">New RFI</p>
          {formError && <p className="text-sm text-status-danger">{formError}</p>}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Subject *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
              placeholder="Brief subject line"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Question</label>
            <textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
              placeholder="Full RFI question text"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Directed To</label>
              <select
                value={directedTo}
                onChange={(e) => setDirectedTo(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:outline-none"
              >
                <option value="">— Select —</option>
                {RFI_DIRECTED_TO_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Date Submitted</label>
              <input
                type="date"
                value={dateSubmitted}
                onChange={(e) => setDateSubmitted(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => void submitRfi()}
              disabled={saving}
              className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Log RFI"}
            </button>
            <button
              type="button"
              onClick={() => { resetForm(); setShowForm(false); }}
              className="rounded-lg border border-border-default px-4 py-2 text-sm font-semibold text-text-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-tertiary">Loading RFIs...</p>
      ) : rfis.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-default px-6 py-10 text-center">
          <p className="text-sm font-medium text-text-secondary">No RFIs logged yet.</p>
          <p className="mt-1 text-xs text-text-tertiary">
            Use the New RFI button to log a field question.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rfis.map((rfi) => {
            const cfg = statusConfig[rfi.status];
            const isExpanded = expandedId === rfi.id;
            const isClosing = closingId === rfi.id;
            return (
              <div key={rfi.id} className="rounded-xl border border-border-default bg-surface-raised overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : rfi.id)}
                  className="flex w-full items-start justify-between px-4 py-3 text-left gap-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-text-tertiary">
                        RFI-{String(rfi.rfi_number).padStart(3, "0")}
                      </span>
                      <span className="font-medium text-text-primary text-sm">{rfi.subject}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
                      {rfi.directed_to && <span>→ {rfi.directed_to}</span>}
                      <span>{new Date(rfi.date_submitted).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</span>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}>
                    {cfg.label}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-border-default px-4 py-3 space-y-3">
                    {rfi.question && (
                      <div>
                        <p className="text-xs font-semibold text-text-tertiary mb-0.5">Question</p>
                        <p className="text-sm text-text-secondary whitespace-pre-wrap">{rfi.question}</p>
                      </div>
                    )}
                    {rfi.response && (
                      <div>
                        <p className="text-xs font-semibold text-text-tertiary mb-0.5">Response</p>
                        <p className="text-sm text-text-secondary whitespace-pre-wrap">{rfi.response}</p>
                        {rfi.date_responded && (
                          <p className="mt-0.5 text-xs text-text-tertiary">
                            Received {new Date(rfi.date_responded).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                          </p>
                        )}
                      </div>
                    )}

                    {rfi.status !== "closed" && !isClosing && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setClosingId(rfi.id);
                            setCloseResponse(rfi.response ?? "");
                            setCloseDate(new Date().toISOString().slice(0, 10));
                            setCloseStatus("closed");
                          }}
                          className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-base"
                        >
                          Log Response / Close
                        </button>
                        {rfi.status === "open" && (
                          <button
                            type="button"
                            onClick={() => void updateRfi(rfi.id, { status: "pending_response" })}
                            disabled={saving}
                            className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-base disabled:opacity-50"
                          >
                            Mark Pending Response
                          </button>
                        )}
                      </div>
                    )}

                    {isClosing && (
                      <div className="space-y-3 rounded-xl border border-border-default bg-surface-base p-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text-secondary">Response Text</label>
                          <textarea
                            rows={2}
                            value={closeResponse}
                            onChange={(e) => setCloseResponse(e.target.value)}
                            className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-text-secondary">Date Responded</label>
                            <input
                              type="date"
                              value={closeDate}
                              onChange={(e) => setCloseDate(e.target.value)}
                              className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-text-secondary">Mark As</label>
                            <select
                              value={closeStatus}
                              onChange={(e) => setCloseStatus(e.target.value as "pending_response" | "closed")}
                              className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:outline-none"
                            >
                              <option value="closed">Closed</option>
                              <option value="pending_response">Pending Response</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void updateRfi(rfi.id, { status: closeStatus, response: closeResponse, dateResponded: closeDate })}
                            disabled={saving}
                            className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setClosingId(null)}
                            className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
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

---

## Files to change

| File | What changes |
|------|-------------|
| `supabase/migrations/034_project_rfis.sql` | New — project_rfis table |
| `src/app/api/pm/rfis/route.ts` | New — GET/POST/PATCH handlers |
| `src/app/pm/page.tsx` | ProjectRfi interface, rfis state, loadRfis helper, RfiTab component, replace stub block |

---

## Acceptance criteria

- [ ] Migration runs clean
- [ ] PM can log a new RFI with subject, question, directed_to, date
- [ ] RFI numbers auto-increment per project (RFI-001, RFI-002...)
- [ ] RFIs show in the tab as an expandable list with status badges
- [ ] PM can mark an RFI as "Pending Response" from Open
- [ ] PM can log a response and close an RFI
- [ ] Closed RFIs show in the list (no archive/delete)
- [ ] Empty state shows when no RFIs exist
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `Add RFI log to PM portal`
Push to main.
