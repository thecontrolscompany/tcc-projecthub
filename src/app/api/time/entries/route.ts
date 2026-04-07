import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const projectId = searchParams.get('projectId');
    const employeeId = searchParams.get('employeeId');
    const weekOf = searchParams.get('weekOf');

    let query = supabase
      .from('time_entries_detailed')
      .select('*')
      .order('work_date', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    if (weekOf) {
      const weekStart = new Date(weekOf);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      query = query
        .gte('work_date', weekStart.toISOString().split('T')[0])
        .lte('work_date', weekEnd.toISOString().split('T')[0]);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Time entries fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Time entries API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      project_id,
      work_date,
      hours,
      notes,
      system_category,
      billable = true
    } = body;

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    if (!project_id || !work_date || !hours) {
      return NextResponse.json({
        error: 'Missing required fields: project_id, work_date, hours'
      }, { status: 400 });
    }

    // Check if user can create time entries for this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, pm_id')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only allow employees to create their own entries, PMs for their projects
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const canCreate = profile?.role === 'admin' ||
                      profile?.role === 'pm' && project.pm_id === user.id ||
                      profile?.role === 'pm'; // Allow PMs to enter time for their projects

    if (!canCreate) {
      return NextResponse.json({ error: 'Unauthorized to create time entries for this project' }, { status: 403 });
    }

    // Create or update time entry
    const { data, error } = await supabase
      .from('time_entries')
      .upsert({
        employee_id: user.id,
        project_id,
        work_date,
        hours,
        notes,
        system_category,
        billable,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'employee_id,project_id,work_date'
      })
      .select()
      .single();

    if (error) {
      console.error('Time entry upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Time entry creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
