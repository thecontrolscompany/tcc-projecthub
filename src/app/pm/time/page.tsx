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

export default async function TimeTrackingPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get user's profile and projects
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  let projects: TimeTrackingProject[] = [];
  if (profile?.role === 'pm' || profile?.role === 'lead' || profile?.role === 'ops_manager' || profile?.role === 'admin') {
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Step 1: find pm_directory entries linked to this profile
    const { data: pmDirRows } = await adminClient
      .from('pm_directory')
      .select('id')
      .eq('profile_id', user.id);

    const pmDirIds = (pmDirRows ?? []).map((r: { id: string }) => r.id);

    // Step 2: find assigned project IDs via project_assignments
    let assignmentQuery = adminClient
      .from('project_assignments')
      .select('project_id')
      .eq('profile_id', user.id);

    // Also include assignments via pm_directory linkage
    // Use a union approach: fetch both and merge
    const { data: directAssignments } = await assignmentQuery;
    const directIds = (directAssignments ?? []).map((a: { project_id: string }) => a.project_id);

    let dirIds: string[] = [];
    if (pmDirIds.length > 0) {
      const { data: dirAssignments } = await adminClient
        .from('project_assignments')
        .select('project_id')
        .in('pm_directory_id', pmDirIds);
      dirIds = (dirAssignments ?? []).map((a: { project_id: string }) => a.project_id);
    }

    const allProjectIds = [...new Set([...directIds, ...dirIds])];

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
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Time Tracking</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Time Entry Form */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Enter Time</h2>
            <TimeEntryForm projects={projects} userRole={profile?.role} />
          </div>

          {/* Weekly Report */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Weekly Report</h2>
            <WeeklyTimeReport projects={projects} userRole={profile?.role} />
          </div>
        </div>
      </div>
    </div>
  );
}
