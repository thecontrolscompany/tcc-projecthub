import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const quoteUpdateSchema = z.object({
  id: z.string().uuid("Quote request id is required."),
  status: z.enum(["new", "reviewing", "quoted", "won", "lost"]).optional(),
  notes: z.string().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const parsed = quoteUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const payload = {
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes?.trim() || null } : {}),
    ...(parsed.data.project_id !== undefined ? { project_id: parsed.data.project_id } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("quote_requests")
    .update(payload)
    .eq("id", parsed.data.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
