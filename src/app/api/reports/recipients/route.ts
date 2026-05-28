import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { loadWeeklyUpdateRecipients } from "@/lib/reports/weekly-update-email";
import type { UserRole } from "@/types/database";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function canAccessProject(
  admin: ReturnType<typeof adminClient>,
  role: UserRole,
  userId: string,
  projectId: string
) {
  if (role === "admin" || role === "ops_manager") return true;

  if (role === "pm" || role === "lead") {
    const { data } = await admin
      .from("project_assignments")
      .select("id")
      .eq("project_id", projectId)
      .eq("profile_id", userId)
      .in("role_on_project", ["pm", "lead"])
      .maybeSingle();

    return Boolean(data);
  }

  return false;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "";

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const resolvedProfile = await resolveUserRole(user);
  const role = (resolvedProfile?.role ?? "customer") as UserRole;
  const admin = adminClient();

  const allowed = await canAccessProject(admin, role, user.id, projectId);
  if (!allowed) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const recipients = await loadWeeklyUpdateRecipients(admin, projectId);

  return NextResponse.json({ recipients });
}
