import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const quoteSubmitSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required."),
  contact_name: z.string().trim().min(1, "Contact name is required."),
  contact_email: z.email("Contact email must be a valid email address."),
  contact_phone: z.string().trim().optional().transform((value) => value || undefined),
  project_description: z.string().trim().min(1, "Project description is required."),
  site_address: z.string().trim().optional().transform((value) => value || undefined),
  estimated_value: z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      const parsed = typeof value === "number" ? value : Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    },
    z.number().nonnegative("Estimated value must be 0 or greater.").optional()
  ),
});

export async function POST(request: Request) {
  const parsed = quoteSubmitSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Every opportunity must have a pursuit. Create one now so the
  // quote_request is never orphaned.
  const { data: pursuit, error: pursuitError } = await supabase
    .from("pursuits")
    .insert({
      project_name: parsed.data.project_description.slice(0, 120),
      owner_name: parsed.data.company_name,
      project_location: parsed.data.site_address ?? null,
      status: "active",
    })
    .select("id")
    .single();

  if (pursuitError || !pursuit) {
    return NextResponse.json({ error: pursuitError?.message ?? "Unable to create pursuit." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("quote_requests")
    .insert({
      ...parsed.data,
      contact_phone: parsed.data.contact_phone ?? null,
      site_address: parsed.data.site_address ?? null,
      estimated_value: parsed.data.estimated_value ?? null,
      pursuit_id: pursuit.id,
    })
    .select("id")
    .single();

  if (error) {
    await supabase.from("pursuits").delete().eq("id", pursuit.id);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data.id });
}
