import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { project_id, week_of, notes } = body;

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    if (!project_id || !week_of) {
      return NextResponse.json({
        error: 'Missing required fields: project_id, week_of'
      }, { status: 400 });
    }

    // Check if user is PM for this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, pm_id')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin' && project.pm_id !== user.id) {
      return NextResponse.json({ error: 'Only PMs can approve time for their projects' }, { status: 403 });
    }

    // Call the approval function
    const { data, error } = await supabase.rpc('approve_weekly_time', {
      project_uuid: project_id,
      week_start: week_of,
      approver_uuid: user.id
    });

    if (error) {
      console.error('Time approval error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update approval notes if provided
    if (notes) {
      await supabase
        .from('time_approvals')
        .update({ notes })
        .eq('project_id', project_id)
        .eq('week_of', week_of);
    }

    return NextResponse.json({ success: true, message: 'Time entries approved' });
  } catch (error) {
    console.error('Time approval API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
