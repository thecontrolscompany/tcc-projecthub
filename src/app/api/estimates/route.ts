import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import {
  ESTIMATE_SELECT,
  canReadEstimates,
  canWriteEstimates,
  deriveEstimateLifecycleFields,
  estimateCreateSchema,
} from "@/lib/estimates/api";

async function getDefaultOrganizationId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.rpc("current_user_default_organization_id");
  return typeof data === "string" ? data : null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!canReadEstimates(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organization_id") || (await getDefaultOrganizationId(supabase));
  if (!organizationId) return NextResponse.json({ error: "No organization selected." }, { status: 400 });

  let query = supabase
    .from("estimates")
    .select(ESTIMATE_SELECT)
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  const opportunityId = searchParams.get("opportunity_id");
  const projectId = searchParams.get("project_id");
  const status = searchParams.get("status");
  const includeArchived = searchParams.get("include_archived") === "true";

  if (opportunityId) query = query.eq("linked_opportunity_id", opportunityId);
  if (projectId) query = query.eq("linked_project_id", projectId);
  if (status) query = query.eq("status", status);
  if (!includeArchived) query = query.eq("archived", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ estimates: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!canWriteEstimates(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = estimateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const organizationId = parsed.data.organization_id || (await getDefaultOrganizationId(supabase));
  if (!organizationId) return NextResponse.json({ error: "No organization selected." }, { status: 400 });

  const estimateId = parsed.data.id ?? crypto.randomUUID();
  const lifecycleFields = deriveEstimateLifecycleFields(parsed.data);
  const payload = {
    ...parsed.data,
    ...lifecycleFields,
    id: estimateId,
    organization_id: organizationId,
    owner_id: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("estimates")
    .insert(payload)
    .select(ESTIMATE_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ estimate: data }, { status: 201 });
}
