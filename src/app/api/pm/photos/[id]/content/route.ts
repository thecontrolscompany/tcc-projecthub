import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { fetchSharePointItemContent } from "@/lib/graph/client";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  const { id } = await params;

  const admin = adminClient();
  const { data: photo } = await admin
    .from("project_photos")
    .select("sharepoint_item_id, sharepoint_drive_id, content_type")
    .eq("id", id)
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
