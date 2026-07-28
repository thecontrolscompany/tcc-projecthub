import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import type { WalkthroughWaypoint } from "@/types/database";

function canManage(role: string | undefined) {
  return Boolean(role && ["admin", "ops_manager"].includes(role));
}

function isWalkthroughWaypoint(point: unknown): point is WalkthroughWaypoint {
  if (typeof point !== "object" || point === null) return false;
  const candidate = point as Partial<WalkthroughWaypoint>;
  return (
    typeof candidate.t === "number" &&
    Number.isFinite(candidate.t) &&
    typeof candidate.x === "number" &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === "number" &&
    Number.isFinite(candidate.y)
  );
}

function isInsta360ShareUrl(value: string) {
  try {
    const url = new URL(value);
    return /(^|\.)insta360\.com$/i.test(url.hostname) && url.pathname.includes("/share/");
  } catch {
    return false;
  }
}

function parseMediaId(value: string): string | null {
  try {
    return new URL(value).searchParams.get("mediaId");
  } catch {
    return null;
  }
}

function matchMeta(html: string, property: string): string | null {
  // Matches <meta property="og:title" content="..."> and name="..." variants,
  // in either attribute order.
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/");
}

type ScrapedMeta = {
  title: string | null;
  duration: string | null;
  coverImageUrl: string | null;
};

async function scrapeShareMeta(shareUrl: string): Promise<ScrapedMeta> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(shareUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TCC-ProjectHub/1.0)" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) return { title: null, duration: null, coverImageUrl: null };
    const html = await res.text();

    const rawTitle = matchMeta(html, "og:title") ?? matchMeta(html, "twitter:title");
    const rawDescription = matchMeta(html, "og:description") ?? matchMeta(html, "description");
    const rawCover = matchMeta(html, "og:image") ?? matchMeta(html, "twitter:image");

    const title = rawTitle ? decodeHtmlEntities(rawTitle) : null;
    const duration = rawDescription
      ? decodeHtmlEntities(rawDescription).replace(/^Video duration:\s*/i, "").trim() || null
      : null;
    const coverImageUrl = rawCover ? decodeHtmlEntities(rawCover) : null;

    return { title, duration, coverImageUrl };
  } catch {
    return { title: null, duration: null, coverImageUrl: null };
  }
}

async function authenticate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }
  const resolvedProfile = await resolveUserRole(user);
  if (!canManage(resolvedProfile?.role)) {
    return { error: NextResponse.json({ error: "Access denied." }, { status: 403 }) };
  }
  const adminClient: SupabaseClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  return { adminClient };
}

export async function GET(request: Request) {
  const auth = await authenticate();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "";
  if (!projectId) {
    return NextResponse.json({ error: "Missing project ID." }, { status: 400 });
  }

  const { data, error } = await auth.adminClient
    .from("project_walkthroughs")
    .select("*")
    .eq("project_id", projectId)
    .order("recorded_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ walkthroughs: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authenticate();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const playerType = body?.playerType === "psv" ? "psv" : "insta360";
  const shareUrl = typeof body?.shareUrl === "string" ? body.shareUrl.trim() : "";
  const videoUrl = typeof body?.videoUrl === "string" ? body.videoUrl.trim() : "";
  const planUrl = typeof body?.planUrl === "string" ? body.planUrl.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const area = typeof body?.area === "string" ? body.area.trim() : "";
  const recordedDate =
    typeof body?.recordedDate === "string" && body.recordedDate
      ? body.recordedDate
      : new Date().toISOString().slice(0, 10);

  if (!projectId) {
    return NextResponse.json({ error: "Missing project ID." }, { status: 400 });
  }

  if (playerType === "psv") {
    const waypoints = Array.isArray(body?.waypoints)
      ? body.waypoints
          .filter(isWalkthroughWaypoint)
          .map((point: WalkthroughWaypoint) => ({
            t: point.t,
            x: point.x,
            y: point.y,
          }))
      : [];

    if (!videoUrl || waypoints.length === 0) {
      return NextResponse.json(
        { error: "A video URL and at least one waypoint are required for a self-hosted walkthrough." },
        { status: 400 }
      );
    }

    const { data, error } = await auth.adminClient
      .from("project_walkthroughs")
      .insert({
        project_id: projectId,
        player_type: "psv",
        share_url: null,
        video_url: videoUrl,
        plan_url: planUrl || null,
        waypoints,
        title: title || area || "360 Walkthrough",
        recorded_date: recordedDate,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, walkthrough: data });
  }

  if (!shareUrl) {
    return NextResponse.json({ error: "Missing Insta360 share URL." }, { status: 400 });
  }
  if (!isInsta360ShareUrl(shareUrl)) {
    return NextResponse.json({ error: "Enter a valid Insta360 cloud share URL." }, { status: 400 });
  }

  const meta = await scrapeShareMeta(shareUrl);

  const { data, error } = await auth.adminClient
    .from("project_walkthroughs")
    .insert({
      project_id: projectId,
      player_type: "insta360",
      share_url: shareUrl,
      media_id: parseMediaId(shareUrl),
      title: meta.title ?? shareUrl,
      duration: meta.duration,
      cover_image_url: meta.coverImageUrl,
      recorded_date: recordedDate,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, walkthrough: data });
}

export async function DELETE(request: Request) {
  const auth = await authenticate();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "Missing walkthrough ID." }, { status: 400 });
  }

  const { error } = await auth.adminClient.from("project_walkthroughs").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
