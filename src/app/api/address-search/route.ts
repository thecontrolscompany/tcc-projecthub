import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 4) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "us");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "tcc-projecthub/1.0 (timothy@thecontrolsco.com)",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Address lookup failed." }, { status: 502 });
    }

    const json = (await response.json()) as Array<{ display_name?: string }>;
    return NextResponse.json({
      results: json
        .map((item) => item.display_name?.trim() ?? "")
        .filter(Boolean),
    });
  } catch {
    return NextResponse.json({ error: "Address lookup failed." }, { status: 502 });
  }
}
