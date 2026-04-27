import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { z } from "zod";

const CRM_WRITE_ROLES = ["admin", "ops_manager"] as const;
const CRM_READ_ROLES = ["admin", "ops_manager", "pm", "lead"] as const;

const contactUpdateSchema = z.object({
  account_id: z.string().uuid().optional(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  display_name: z.string().min(1).optional(),
  role_type: z.enum(["salesperson","sales_manager","estimator","project_manager","senior_project_manager","operations_manager","owner","cfo","cfo_estimator","unknown"]).optional(),
  title: z.string().nullish(),
  email: z.string().email().nullish().or(z.literal("")),
  phone: z.string().nullish(),
  mobile: z.string().nullish(),
  location: z.string().nullish(),
  preferred_contact_method: z.enum(["email","phone","mobile","in_person"]).optional(),
  influence_level: z.enum(["high","medium","low","unknown"]).optional(),
  buying_role: z.enum(["decision_maker","influencer","evaluator","user","gatekeeper","unknown"]).optional(),
  reports_to_contact_id: z.string().uuid().nullish(),
  issues_purchase_orders: z.boolean().optional(),
  involved_in_estimating: z.boolean().optional(),
  involved_in_project_execution: z.boolean().optional(),
  notes: z.string().nullish(),
  is_active: z.boolean().optional(),
  confidence_level: z.enum(["confirmed","partially_confirmed","needs_verification"]).optional(),
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

  const { data, error } = await supabase
    .from("crm_contacts")
    .select(`
      *,
      account:crm_accounts!crm_contacts_account_id_fkey(id, company_name, type, relationship_health)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contact: data });
}

export async function DELETE(
  _request: Request,
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

  const { error } = await supabase.from("crm_contacts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
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
  const parsed = contactUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updateData = { ...parsed.data };
  if (updateData.email === "") updateData.email = null;

  const { data, error } = await supabase
    .from("crm_contacts")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}
