import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import TimeEntryForm from '@/components/TimeEntryForm';
import WeeklyTimeReport from '@/components/WeeklyTimeReport';

type TimeTrackingProject = {
  id: string;
  name: string;
  customer_id: string;
  customers: {
    name: string;
  } | null;
};

export const dynamic = "force-dynamic";

export default async function TimeHubPage() {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  let projects: TimeTrackingProject[] = [];

  if (profile?.role === 'pm' || profile?.role === 'lead' || profile?.role === 'installer' || profile?.role === 'ops_manager' || profile?.role === 'admin') {
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: pmDirRows } = await adminClient
      .from('pm_directory')
      .select('id')
      .eq('profile_id', user.id);

    const pmDirIds = (pmDirRows ?? []).map((row: { id: string }) => row.id);

    const { data: directAssignments } = await adminClient
      .from('project_assignments')
      .select('project_id')
      .eq('profile_id', user.id);

    const directIds = (directAssignments ?? []).map((assignment: { project_id: string }) => assignment.project_id);

    let directoryLinkedIds: string[] = [];
    if (pmDirIds.length > 0) {
      const { data: directoryAssignments } = await adminClient
        .from('project_assignments')
        .select('project_id')
        .in('pm_directory_id', pmDirIds);

      directoryLinkedIds = (directoryAssignments ?? []).map(
        (assignment: { project_id: string }) => assignment.project_id
      );
    }

    const allProjectIds = [...new Set([...directIds, ...directoryLinkedIds])];

    if (allProjectIds.length > 0) {
      const { data } = await adminClient
        .from('projects')
        .select('id, name, customer_id, customers(name)')
        .in('id', allProjectIds)
        .eq('is_active', true)
        .order('name');

      projects = (data ?? []).map((project: {
        id: string;
        name: string;
        customer_id: string;
        customers: { name: string } | { name: string }[] | null;
      }) => ({
        id: project.id,
        name: project.name,
        customer_id: project.customer_id,
        customers: Array.isArray(project.customers) ? project.customers[0] ?? null : project.customers,
      }));
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">TimeHub</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-text-primary">Enter and review time</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
          Log hours against your assigned projects and review weekly approvals.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <TimeEntryForm projects={projects} userRole={profile?.role} />
        <WeeklyTimeReport projects={projects} userRole={profile?.role} />
      </div>
    </div>
  );
}
