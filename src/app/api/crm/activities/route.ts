import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { z } from "zod";

const CRM_WRITE_ROLES = ["admin", "ops_manager"] as const;

const activityCreateSchema = z.object({
  activity_type: z.enum(["meeting","call","email","site_visit","lunch","estimate_request","proposal_followup","pm_handoff","other"]).default("other"),
  activity_date: z.string().default(() => new Date().toISOString().slice(0, 10)),
  summary: z.string().min(1),
  key_decisions: z.string().nullish(),
  follow_up_actions: z.string().nullish(),
  follow_up_due_date: z.string().nullish(),
  attendees_text: z.string().nullish(),
  account_id: z.string().uuid().nullish(),
  contact_id: z.string().uuid().nullish(),
  opportunity_id: z.string().uuid().nullish(),
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
  const accountId = searchParams.get("account_id");
  const contactId = searchParams.get("contact_id");
  const opportunityId = searchParams.get("opportunity_id");
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  let query = supabase
    .from("crm_activities")
    .select(`
      *,
      logged_by:profiles!crm_activities_logged_by_profile_id_fkey(id, full_name, email),
      account:crm_accounts!crm_activities_account_id_fkey(id, company_name),
      contact:crm_contacts!crm_activities_contact_id_fkey(id, display_name),
      opportunity:crm_opportunities!crm_activities_opportunity_id_fkey(id, project_name, opportunity_number)
    `)
    .order("activity_date", { ascending: false })
    .limit(limit);

  if (accountId) query = query.eq("account_id", accountId);
  if (contactId) query = query.eq("contact_id", contactId);
  if (opportunityId) query = query.eq("opportunity_id", opportunityId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ activities: data ?? [] });
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
  const parsed = activityCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("crm_activities")
    .insert({ ...parsed.data, logged_by_profile_id: user.id })
    .select(`
      *,
      logged_by:profiles!crm_activities_logged_by_profile_id_fkey(id, full_name, email),
      account:crm_accounts!crm_activities_account_id_fkey(id, company_name),
      contact:crm_contacts!crm_activities_contact_id_fkey(id, display_name),
      opportunity:crm_opportunities!crm_activities_opportunity_id_fkey(id, project_name, opportunity_number)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activity: data }, { status: 201 });
}
