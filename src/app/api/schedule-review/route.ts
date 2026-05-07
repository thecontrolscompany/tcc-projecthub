import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function canAccess(userId: string, role: string, projectId: string) {
  const admin = adminClient();
  if (role === "admin" || role === "ops_manager") return true;

  if (role === "customer") {
    const { data } = await admin
      .from("project_customer_contacts")
      .select("id")
      .eq("project_id", projectId)
      .eq("profile_id", userId)
      .eq("portal_access", true)
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  }

  const { data } = await admin
    .from("project_assignments")
    .select("id")
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "";
  const packetDate = searchParams.get("packetDate") ?? "";

  if (!projectId || !packetDate) {
    return new Response("Missing projectId or packetDate", { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Not authenticated", { status: 401 });

  const resolvedProfile = await resolveUserRole(user);
  const role = resolvedProfile?.role ?? "";
  if (!["admin", "ops_manager", "pm", "lead", "customer"].includes(role)) {
    return new Response("Access denied", { status: 403 });
  }

  const allowed = await canAccess(user.id, role, projectId);
  if (!allowed) return new Response("Access denied", { status: 403 });

  const { data, error } = await adminClient()
    .from("project_report_packets")
    .select("body")
    .eq("project_id", projectId)
    .eq("report_type", "mobile_arena_schedule_review")
    .eq("packet_date", packetDate)
    .single();

  if (error || !data?.body?.html_content) {
    return new Response("Report not found", { status: 404 });
  }

  return new Response(data.body.html_content as string, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
