import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const projectId = searchParams.get('projectId');
    const weekOf = searchParams.get('weekOf');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Use the function to get weekly time entries
    const weekStart = weekOf ? new Date(weekOf) : new Date();
    if (!weekOf) {
      // Set to current week Monday
      const day = weekStart.getDay();
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
      weekStart.setDate(diff);
    }

    const { data: timeEntries, error: entriesError } = await supabase.rpc('get_weekly_time_entries', {
      project_uuid: projectId,
      week_start: weekStart.toISOString().split('T')[0]
    });

    if (entriesError) {
      console.error('Weekly time entries error:', entriesError);
      return NextResponse.json({ error: entriesError.message }, { status: 500 });
    }

    // Get project summary
    const { data: summary, error: summaryError } = await supabase
      .from('weekly_time_summary')
      .select('*')
      .eq('project_id', projectId)
      .eq('week_of', weekStart.toISOString().split('T')[0])
      .single();

    if (summaryError && summaryError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Weekly summary error:', summaryError);
      return NextResponse.json({ error: summaryError.message }, { status: 500 });
    }

    // Get approval status
    const { data: approval, error: approvalError } = await supabase
      .from('time_approvals')
      .select('*')
      .eq('project_id', projectId)
      .eq('week_of', weekStart.toISOString().split('T')[0])
      .single();

    if (approvalError && approvalError.code !== 'PGRST116') {
      console.error('Approval check error:', approvalError);
      return NextResponse.json({ error: approvalError.message }, { status: 500 });
    }

    return NextResponse.json({
      week_of: weekStart.toISOString().split('T')[0],
      project_id: projectId,
      summary: summary || null,
      time_entries: timeEntries || [],
      approval: approval || null
    });
  } catch (error) {
    console.error('Weekly report API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
