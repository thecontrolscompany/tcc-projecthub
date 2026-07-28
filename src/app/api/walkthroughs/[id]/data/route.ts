import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_walkthroughs")
    .select("player_type, title, video_url, plan_url, waypoints")
    .eq("id", id)
    .maybeSingle();

  if (error || !data || data.player_type !== "psv") {
    return NextResponse.json({ error: "Walkthrough not found." }, { status: 404 });
  }

  return NextResponse.json(
    {
      area: data.title,
      video_url: data.video_url,
      plan_url: data.plan_url,
      points: data.waypoints ?? [],
      time_offset_sec: 0,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    }
  );
}
