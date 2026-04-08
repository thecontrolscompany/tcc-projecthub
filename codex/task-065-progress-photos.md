# Task 065 — Progress Photos (SharePoint Storage)

## Context

PMs take site progress photos on their phones/devices but have nowhere to log them
against a project in the portal. This task adds a Photos tab to the PM portal where
PMs can upload photos that are stored in the project's existing SharePoint folder
under a `Site Photos` subfolder.

Photos are stored in SharePoint. The database stores metadata + the SharePoint item
ID and web URL. The PM portal displays photos via a server-side proxy endpoint
(using the PM's Graph API token) so no anonymous sharing configuration is required.

The customer portal shows a count badge only. Full customer photo gallery is a
future task pending SharePoint sharing configuration.

---

## Prerequisites

The following already exist and should be used as-is:
- `src/lib/graph/client.ts` — `graphFetch`, `getSharePointSiteId`, `getSharePointDriveId`
- Provider token pattern: `const session = await supabase.auth.getSession(); const providerToken = session.data.session?.provider_token;`
- SharePoint site: `controlsco.sharepoint.com/sites/TCCProjects`
- Projects have `sharepoint_folder` (string | null) — the folder path within the SharePoint drive

---

## 1. Migration — `supabase/migrations/035_project_photos.sql`

```sql
CREATE TABLE IF NOT EXISTS project_photos (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  weekly_update_id      uuid        REFERENCES weekly_updates(id) ON DELETE SET NULL,
  caption               text,
  filename              text        NOT NULL,
  content_type          text        NOT NULL DEFAULT 'image/jpeg',
  sharepoint_item_id    text        NOT NULL,
  sharepoint_drive_id   text        NOT NULL,
  sharepoint_web_url    text,
  taken_date            date,
  uploaded_by_profile_id uuid       REFERENCES profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_photos_project_id
  ON project_photos(project_id);
CREATE INDEX IF NOT EXISTS idx_project_photos_created_at
  ON project_photos(project_id, created_at DESC);
```

Run with:
```bash
npx supabase db push
```

---

## 2. Graph API helper additions — `src/lib/graph/client.ts`

Add these two functions at the bottom of the file:

```ts
/**
 * Upload a photo/file to a SharePoint drive folder.
 * Returns the created item's id and webUrl.
 */
export async function uploadFileToSharePointDrive(
  providerToken: string,
  driveId: string,
  folderPath: string,
  filename: string,
  fileBuffer: ArrayBuffer,
  contentType: string
): Promise<{ id: string; webUrl: string }> {
  const encodedFolder = folderPath
    .split("/")
    .filter(Boolean)
    .map((p) => encodeURIComponent(p))
    .join("/");
  const encodedName = encodeURIComponent(filename);

  const url = `/drives/${driveId}/root:/${encodedFolder}/${encodedName}:/content`;

  const res = await fetch(`https://graph.microsoft.com/v1.0${url}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${providerToken}`,
      "Content-Type": contentType,
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SharePoint upload failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return {
    id: data.id as string,
    webUrl: data.webUrl as string,
  };
}

/**
 * Fetch a file's raw bytes from SharePoint for proxy serving.
 * Returns Response so the caller can stream it directly.
 */
export async function fetchSharePointItemContent(
  providerToken: string,
  driveId: string,
  itemId: string
): Promise<Response> {
  return fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${encodeURIComponent(itemId)}/content`,
    {
      headers: { Authorization: `Bearer ${providerToken}` },
      redirect: "follow",
    }
  );
}
```

---

## 3. Photo upload API — `src/app/api/pm/photos/route.ts`

Handles GET (list project photos) and POST (upload new photo).

```ts
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import {
  getSharePointSiteId,
  getSharePointDriveId,
  uploadFileToSharePointDrive,
} from "@/lib/graph/client";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function verifyProjectAccess(projectId: string, userId: string, role: string) {
  if (role === "admin" || role === "ops_manager") return true;
  const admin = adminClient();
  const { data: pmRows } = await admin.from("pm_directory").select("id").eq("profile_id", userId);
  const pmDirIds = (pmRows ?? []).map((r: { id: string }) => r.id);
  const { data: direct } = await admin
    .from("project_assignments").select("id")
    .eq("project_id", projectId).eq("profile_id", userId).limit(1);
  if ((direct ?? []).length > 0) return true;
  if (pmDirIds.length > 0) {
    const { data: dir } = await admin
      .from("project_assignments").select("id")
      .eq("project_id", projectId).in("pm_directory_id", pmDirIds).limit(1);
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
    .from("project_photos")
    .select("id, caption, filename, content_type, sharepoint_web_url, taken_date, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ photos: data ?? [] });
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

  // Get Microsoft provider token (required for SharePoint upload)
  const { data: sessionData } = await supabase.auth.getSession();
  const providerToken = sessionData.session?.provider_token;
  if (!providerToken) {
    return NextResponse.json(
      { error: "Microsoft sign-in required to upload photos. Please sign out and sign back in." },
      { status: 401 }
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });

  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string | null;
  const caption = (formData.get("caption") as string | null)?.trim() || null;
  const takenDate = (formData.get("takenDate") as string | null) || null;

  if (!file || !projectId) {
    return NextResponse.json({ error: "Missing file or projectId." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are supported." }, { status: 400 });
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 20 MB per photo)." }, { status: 400 });
  }

  const hasAccess = await verifyProjectAccess(projectId, user.id, role);
  if (!hasAccess) return NextResponse.json({ error: "Not assigned to this project." }, { status: 403 });

  const admin = adminClient();

  // Get project's sharepoint_folder
  const { data: project } = await admin
    .from("projects")
    .select("sharepoint_folder, name")
    .eq("id", projectId)
    .single();

  if (!project?.sharepoint_folder) {
    return NextResponse.json(
      { error: "This project has no SharePoint folder configured. Contact admin." },
      { status: 400 }
    );
  }

  // Upload to SharePoint
  const siteId = await getSharePointSiteId(providerToken);
  const driveId = await getSharePointDriveId(providerToken, siteId);

  // Unique filename to avoid collisions: {timestamp}-{original}
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const ext = file.name.split(".").pop() ?? "jpg";
  const safeOriginal = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  const uniqueFilename = `${timestamp}-${safeOriginal}`;

  const folderPath = `${project.sharepoint_folder}/Site Photos`;
  const fileBuffer = await file.arrayBuffer();

  const { id: itemId, webUrl } = await uploadFileToSharePointDrive(
    providerToken,
    driveId,
    folderPath,
    uniqueFilename,
    fileBuffer,
    file.type
  );

  // Save metadata to DB
  const { data: photo, error: insertError } = await admin
    .from("project_photos")
    .insert({
      project_id: projectId,
      caption,
      filename: file.name,
      content_type: file.type,
      sharepoint_item_id: itemId,
      sharepoint_drive_id: driveId,
      sharepoint_web_url: webUrl,
      taken_date: takenDate || null,
      uploaded_by_profile_id: user.id,
    })
    .select("id, caption, filename, content_type, sharepoint_web_url, taken_date, created_at")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ photo });
}
```

---

## 4. Photo proxy endpoint — `src/app/api/pm/photos/[id]/content/route.ts`

Serves the raw photo bytes from SharePoint using the PM's session token.

```ts
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { fetchSharePointItemContent } from "@/lib/graph/client";
import { NextResponse } from "next/server";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Not authenticated", { status: 401 });

  const resolvedProfile = await resolveUserRole(user);
  const role = resolvedProfile?.role ?? "customer";
  if (!["admin", "ops_manager", "pm", "lead"].includes(role)) {
    return new Response("Access denied", { status: 403 });
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const providerToken = sessionData.session?.provider_token;
  if (!providerToken) {
    return new Response("Microsoft session required", { status: 401 });
  }

  const admin = adminClient();
  const { data: photo } = await admin
    .from("project_photos")
    .select("sharepoint_item_id, sharepoint_drive_id, content_type")
    .eq("id", params.id)
    .single();

  if (!photo) return new Response("Not found", { status: 404 });

  const spRes = await fetchSharePointItemContent(
    providerToken,
    photo.sharepoint_drive_id,
    photo.sharepoint_item_id
  );

  if (!spRes.ok) {
    return new Response("Failed to fetch from SharePoint", { status: 502 });
  }

  return new Response(spRes.body, {
    status: 200,
    headers: {
      "Content-Type": photo.content_type || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
```

---

## 5. PM portal — `src/app/pm/page.tsx`

### 5a. Add Photos tab to ProjectTab type (line ~20)

```ts
type ProjectTab = "overview" | "contacts" | "update" | "poc" | "change-orders" | "rfis" | "photos" | "bom";
```

### 5b. Add Photos tab button

In the tab bar, add after the RFIs button and before BOM:

```tsx
<PmTabButton active={activeTab === "photos"} onClick={() => setActiveTab("photos")}>
  Photos
</PmTabButton>
```

### 5c. Add Photos tab content block

After the RFIs block and before the BOM block:

```tsx
{activeTab === "photos" && (
  <PhotosTab projectId={project.id} />
)}
```

### 5d. Reset on project change

In the project selection handler where other state is reset, no additional state
reset is needed since PhotosTab manages its own state internally.

---

## 6. `PhotosTab` component (add at bottom of `src/app/pm/page.tsx`)

```tsx
function PhotosTab({ projectId }: { projectId: string }) {
  const [photos, setPhotos] = useState<Array<{
    id: string;
    caption: string | null;
    filename: string;
    content_type: string;
    sharepoint_web_url: string | null;
    taken_date: string | null;
    created_at: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingCaption, setPendingCaption] = useState("");
  const [pendingDate, setPendingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function loadPhotos() {
    setLoading(true);
    try {
      const res = await fetch(`/api/pm/photos?projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok) setPhotos(json.photos ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("projectId", projectId);
      if (pendingCaption.trim()) fd.append("caption", pendingCaption.trim());
      if (pendingDate) fd.append("takenDate", pendingDate);

      const res = await fetch("/api/pm/photos", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Upload failed.");
      setPhotos((prev) => [json.photo, ...prev]);
      setPendingCaption("");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Process sequentially
    for (const file of files) {
      await uploadFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Site Photos</h3>
          <p className="mt-0.5 text-sm text-text-tertiary">
            Photos are stored in the project&apos;s SharePoint folder.
          </p>
        </div>
      </div>

      {/* Upload area */}
      <div className="rounded-2xl border border-border-default bg-surface-raised p-4 space-y-3">
        <p className="text-sm font-semibold text-text-primary">Upload Photos</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Caption (applies to all selected)</label>
            <input
              type="text"
              value={pendingCaption}
              onChange={(e) => setPendingCaption(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
              placeholder="Optional caption"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Date Taken</label>
            <input
              type="date"
              value={pendingDate}
              onChange={(e) => setPendingDate(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:outline-none"
            />
          </div>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void handleFileChange(e)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-border-default bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-base disabled:opacity-60"
          >
            {uploading ? "Uploading..." : "Choose Photos"}
          </button>
          <span className="ml-3 text-xs text-text-tertiary">Images only, max 20 MB each</span>
        </div>
        {uploadError && (
          <p className="text-sm text-status-danger">{uploadError}</p>
        )}
      </div>

      {/* Gallery */}
      {loading ? (
        <p className="text-sm text-text-tertiary">Loading photos...</p>
      ) : photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-default px-6 py-10 text-center">
          <p className="text-sm font-medium text-text-secondary">No photos uploaded yet.</p>
          <p className="mt-1 text-xs text-text-tertiary">
            Use the upload area above to add site photos.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/pm/photos/${photo.id}/content`}
                alt={photo.caption ?? photo.filename}
                className="h-44 w-full object-cover"
                loading="lazy"
              />
              <div className="px-3 py-2 space-y-0.5">
                {photo.caption && (
                  <p className="text-sm font-medium text-text-primary">{photo.caption}</p>
                )}
                <p className="text-xs text-text-tertiary">
                  {photo.taken_date
                    ? new Date(photo.taken_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
                    : new Date(photo.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
                {photo.sharepoint_web_url && (
                  <a
                    href={photo.sharepoint_web_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-primary hover:underline"
                  >
                    View in SharePoint →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Make sure `useRef` is imported from React at the top of the file. It should already
be imported — if not, add it to the existing React import.

---

## 6. Customer portal — `src/app/customer/page.tsx`

Add a simple photo count badge to the `ProjectDetail` header. This requires fetching
the photo count from a new customer-accessible endpoint.

### 6a. Update customer data API — `src/app/api/customer/data/route.ts`

Add a 6th parallel fetch to get photo count per project:

```ts
adminClient
  .from("project_photos")
  .select("project_id")
  .in("project_id", projectIds),
```

Destructure as `photosResult`. Add to `readError` check. Return in response:

```ts
photosByProject: (photosResult.data ?? []).reduce((acc: Record<string, number>, row: { project_id: string }) => {
  acc[row.project_id] = (acc[row.project_id] ?? 0) + 1;
  return acc;
}, {}),
```

### 6b. Customer portal — map photo count into project

In `loadProjects`, after reading `changeOrders`:
```ts
const photosByProject = (json?.photosByProject ?? {}) as Record<string, number>;
```

In the `combined` map:
```ts
photo_count: photosByProject[project.id] ?? 0,
```

Add `photo_count: number` to `CustomerProject` interface.

### 6c. Display in ProjectDetail

In the `ProjectDetail` header, below the scheduled completion line, add:

```tsx
{project.photo_count > 0 && (
  <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
    <PhotoIcon />
    <span>
      {project.photo_count} site photo{project.photo_count !== 1 ? "s" : ""} on file
    </span>
  </div>
)}
```

Add a `PhotoIcon` component near the other SVG icons in the file:

```tsx
function PhotoIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}
```

---

## Files to change

| File | What changes |
|------|-------------|
| `supabase/migrations/035_project_photos.sql` | New — project_photos table |
| `src/lib/graph/client.ts` | Add uploadFileToSharePointDrive + fetchSharePointItemContent |
| `src/app/api/pm/photos/route.ts` | New — GET list + POST upload |
| `src/app/api/pm/photos/[id]/content/route.ts` | New — proxy image fetch via Graph API |
| `src/app/pm/page.tsx` | Photos tab in type + tab bar + content block + PhotosTab component |
| `src/app/api/customer/data/route.ts` | Add photo count fetch |
| `src/app/customer/page.tsx` | photo_count in interface, map, and display in ProjectDetail |

---

## Acceptance criteria

- [ ] Migration runs clean
- [ ] PM can upload images from the Photos tab (file picker, multiple)
- [ ] Uploaded photos appear in SharePoint under `{project.sharepoint_folder}/Site Photos/`
- [ ] Photos display in PM portal gallery using the proxy endpoint
- [ ] "View in SharePoint →" link opens the photo in SharePoint
- [ ] If project has no sharepoint_folder, upload shows a clear error
- [ ] If PM is email/password auth (no provider_token), upload shows a clear error
- [ ] Customer portal shows photo count badge when photos exist; hidden when none
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `Add site photos tab to PM portal (SharePoint storage)`
Push to main.
