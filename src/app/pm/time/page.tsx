import { createClient } from '@/lib/supabase/server';
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
  if (profile?.role === 'pm') {
    const { data } = await supabase
      .from('projects')
      .select('id, name, customer_id, customers(name)')
      .eq('pm_id', user.id)
      .eq('is_active', true);
    projects = (data ?? []).map((project) => ({
      id: project.id,
      name: project.name,
      customer_id: project.customer_id,
      customers: Array.isArray(project.customers) ? project.customers[0] ?? null : project.customers,
    }));
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
