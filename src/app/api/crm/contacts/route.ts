import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { z } from "zod";

const CRM_WRITE_ROLES = ["admin", "ops_manager"] as const;
const CRM_READ_ROLES = ["admin", "ops_manager", "pm", "lead"] as const;

const contactCreateSchema = z.object({
  account_id: z.string().uuid(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  display_name: z.string().min(1),
  role_type: z.enum(["salesperson","sales_manager","estimator","project_manager","senior_project_manager","operations_manager","owner","cfo","cfo_estimator","unknown"]).default("unknown"),
  title: z.string().nullish(),
  email: z.string().email().nullish().or(z.literal("")),
  phone: z.string().nullish(),
  mobile: z.string().nullish(),
  location: z.string().nullish(),
  preferred_contact_method: z.enum(["email","phone","mobile","in_person"]).default("email"),
  influence_level: z.enum(["high","medium","low","unknown"]).default("unknown"),
  buying_role: z.enum(["decision_maker","influencer","evaluator","user","gatekeeper","unknown"]).default("unknown"),
  reports_to_contact_id: z.string().uuid().nullish(),
  issues_purchase_orders: z.boolean().default(false),
  involved_in_estimating: z.boolean().default(false),
  involved_in_project_execution: z.boolean().default(false),
  notes: z.string().nullish(),
  is_active: z.boolean().default(true),
  confidence_level: z.enum(["confirmed","partially_confirmed","needs_verification"]).default("needs_verification"),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!(CRM_READ_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("account_id");
  const roleType = searchParams.get("role_type");
  const confidenceLevel = searchParams.get("confidence_level");
  const issuesPo = searchParams.get("issues_po");
  const involvedEstimating = searchParams.get("involved_estimating");
  const search = searchParams.get("search");

  let query = supabase
    .from("crm_contacts")
    .select(`
      *,
      account:crm_accounts!crm_contacts_account_id_fkey(id, company_name, type)
    `)
    .order("display_name", { ascending: true });

  if (accountId) query = query.eq("account_id", accountId);
  if (roleType) query = query.eq("role_type", roleType);
  if (confidenceLevel) query = query.eq("confidence_level", confidenceLevel);
  if (issuesPo === "true") query = query.eq("issues_purchase_orders", true);
  if (involvedEstimating === "true") query = query.eq("involved_in_estimating", true);
  if (search) query = query.ilike("display_name", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ contacts: data ?? [] });
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
  const parsed = contactCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const insertData = { ...parsed.data };
  if (insertData.email === "") insertData.email = null;

  const { data, error } = await supabase
    .from("crm_contacts")
    .insert(insertData)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data }, { status: 201 });
}
