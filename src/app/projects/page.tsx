import { createClient } from "@/lib/supabase/server";
import { ProjectsList } from "./projects-list";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, job_number, is_active, migration_status, sharepoint_folder, created_at")
    .not("name", "ilike", "z%")
    .order("name", { ascending: true });

  return <ProjectsList projects={projects ?? []} />;
}
