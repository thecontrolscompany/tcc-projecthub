import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { z } from "zod";

const CRM_WRITE_ROLES = ["admin", "ops_manager"] as const;
const CRM_READ_ROLES = ["admin", "ops_manager", "pm", "lead"] as const;

const accountUpdateSchema = z.object({
  company_name: z.string().min(1).optional(),
  type: z.enum(["general_contractor","mechanical_contractor","controls_contractor","hvac_oem","controls_oem","owner","other"]).optional(),
  territory: z.string().nullish(),
  status: z.enum(["active","inactive","prospect"]).optional(),
  notes: z.string().nullish(),
  relationship_owner_profile_id: z.string().uuid().nullish(),
  tags: z.array(z.string()).optional(),
  website: z.string().nullish(),
  address: z.string().nullish(),
  relationship_health: z.enum(["strong","good","at_risk","dormant","unknown"]).optional(),
  last_meaningful_contact_date: z.string().nullish(),
  next_scheduled_followup_date: z.string().nullish(),
  who_buys: z.string().nullish(),
  who_issues_po: z.string().nullish(),
  who_influences_spec: z.string().nullish(),
  who_owns_estimating_relationship: z.string().nullish(),
  handoff_notes: z.string().nullish(),
  linked_customer_id: z.string().uuid().nullish(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!(CRM_READ_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const [accountResult, activitiesResult] = await Promise.all([
    supabase
      .from("crm_accounts")
      .select(`
        *,
        relationship_owner:profiles!crm_accounts_relationship_owner_profile_id_fkey(id, full_name, email),
        contacts:crm_contacts(
          id, display_name, first_name, last_name, role_type, email, phone,
          influence_level, confidence_level, is_active,
          issues_purchase_orders, involved_in_estimating, involved_in_project_execution
        ),
        opportunities:crm_opportunities(
          id, opportunity_number, project_name, stage,
          estimated_value, bid_due_date, last_activity_date, probability
        )
      `)
      .eq("id", id)
      .single(),
    supabase
      .from("crm_activities")
      .select(`
        id, activity_type, activity_date, summary, key_decisions,
        follow_up_actions, follow_up_due_date, attendees_text,
        account_id, contact_id, opportunity_id, created_at,
        logged_by:profiles!crm_activities_logged_by_profile_id_fkey(id, full_name, email),
        contact:crm_contacts!crm_activities_contact_id_fkey(id, display_name),
        opportunity:crm_opportunities!crm_activities_opportunity_id_fkey(id, project_name, opportunity_number)
      `)
      .eq("account_id", id)
      .order("activity_date", { ascending: false })
      .limit(30),
  ]);

  if (accountResult.error) {
    if (accountResult.error.code === "PGRST116") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ error: accountResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    account: accountResult.data,
    activities: activitiesResult.data ?? [],
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!(CRM_WRITE_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = accountUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("crm_accounts")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: data });
}
