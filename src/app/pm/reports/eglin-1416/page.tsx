import { redirect } from "next/navigation";
import { Eglin1416ReportBuilder } from "@/components/eglin-1416-report-builder";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

type PageProps = {
  searchParams: Promise<{ projectId?: string }>;
};

export default async function Eglin1416ReportBuilderPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedProfile = await resolveUserRole(user);
  if (!resolvedProfile || !["admin", "pm", "lead", "ops_manager"].includes(resolvedProfile.role)) {
    redirect("/login");
  }

  const { projectId } = await searchParams;
  if (!projectId) {
    redirect("/pm");
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (!["admin", "ops_manager"].includes(resolvedProfile.role)) {
    const { data: assignment } = await admin
      .from("project_assignments")
      .select("id")
      .eq("project_id", projectId)
      .eq("profile_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!assignment) {
      redirect("/pm");
    }
  }

  const { data: project } = await admin
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    redirect("/pm");
  }

  return (
    <main className="min-h-screen bg-surface-base px-6 py-6 text-text-primary">
      <div className="mx-auto max-w-7xl">
        <Eglin1416ReportBuilder projectId={project.id} projectName={project.name} />
      </div>
    </main>
  );
}
