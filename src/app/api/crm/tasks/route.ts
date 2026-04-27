import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { z } from "zod";

const CRM_WRITE_ROLES = ["admin", "ops_manager"] as const;

const taskCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullish(),
  assigned_to_profile_id: z.string().uuid().nullish(),
  due_date: z.string().nullish(),
  priority: z.enum(["low","medium","high","urgent"]).default("medium"),
  account_id: z.string().uuid().nullish(),
  contact_id: z.string().uuid().nullish(),
  opportunity_id: z.string().uuid().nullish(),
  reminder_date: z.string().nullish(),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!(CRM_WRITE_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const assignedTo = searchParams.get("assigned_to");
  const accountId = searchParams.get("account_id");
  const opportunityId = searchParams.get("opportunity_id");
  const dueThisWeek = searchParams.get("due_this_week");

  let query = supabase
    .from("crm_tasks")
    .select(`
      *,
      assigned_to:profiles!crm_tasks_assigned_to_profile_id_fkey(id, full_name, email),
      account:crm_accounts!crm_tasks_account_id_fkey(id, company_name),
      opportunity:crm_opportunities!crm_tasks_opportunity_id_fkey(id, project_name, opportunity_number)
    `)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (status) query = query.eq("status", status);
  else query = query.neq("status", "completed").neq("status", "cancelled");

  if (assignedTo) query = query.eq("assigned_to_profile_id", assignedTo);
  if (accountId) query = query.eq("account_id", accountId);
  if (opportunityId) query = query.eq("opportunity_id", opportunityId);

  if (dueThisWeek === "true") {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    query = query
      .gte("due_date", monday.toISOString().slice(0, 10))
      .lte("due_date", sunday.toISOString().slice(0, 10));
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!(CRM_WRITE_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = taskCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("crm_tasks")
    .insert({ ...parsed.data, status: "open", created_by_profile_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data }, { status: 201 });
}
