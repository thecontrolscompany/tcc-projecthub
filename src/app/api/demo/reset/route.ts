import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { wipeDemoData, seedDemoData, DEMO } from "@/lib/demo/seed";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  // Verify the reset secret — set DEMO_RESET_SECRET in Vercel env vars
  const auth = request.headers.get("authorization") ?? "";
  const secret = process.env.DEMO_RESET_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Resolve the demo org ID
    const { data: org, error: orgError } = await adminClient()
      .from("organizations")
      .select("id")
      .eq("slug", DEMO.ORG_SLUG)
      .maybeSingle();

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Demo org not found — run the migration first." },
        { status: 500 }
      );
    }

    await wipeDemoData(org.id);
    await seedDemoData(org.id);

    return NextResponse.json({
      ok: true,
      reset_at: new Date().toISOString(),
      org_id: org.id,
    });
  } catch (err) {
    console.error("[demo/reset] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Allow manual GET trigger from browser (protected by same secret via ?secret=)
export async function GET(request: NextRequest) {
  const secret = process.env.DEMO_RESET_SECRET;
  const param = request.nextUrl.searchParams.get("secret");
  if (!secret || param !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return POST(
    new NextRequest(request.url, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    })
  );
}
