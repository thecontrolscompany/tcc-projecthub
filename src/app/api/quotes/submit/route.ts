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

  const { data, error } = await supabase
    .from("quote_requests")
    .insert({
      ...parsed.data,
      contact_phone: parsed.data.contact_phone ?? null,
      site_address: parsed.data.site_address ?? null,
      estimated_value: parsed.data.estimated_value ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data.id });
}
