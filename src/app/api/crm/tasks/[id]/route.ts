import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { z } from "zod";

const CRM_WRITE_ROLES = ["admin", "ops_manager"] as const;

const taskUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullish(),
  assigned_to_profile_id: z.string().uuid().nullish(),
  due_date: z.string().nullish(),
  priority: z.enum(["low","medium","high","urgent"]).optional(),
  status: z.enum(["open","in_progress","completed","cancelled"]).optional(),
  reminder_date: z.string().nullish(),
});

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
  const parsed = taskUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "completed") {
    updateData.completed_at = new Date().toISOString();
  } else if (parsed.data.status) {
    updateData.completed_at = null;
  }

  const { data, error } = await supabase
    .from("crm_tasks")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}
