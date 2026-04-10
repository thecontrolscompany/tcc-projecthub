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

    type NominatimResult = {
      display_name?: string;
      address?: {
        house_number?: string;
        road?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        "ISO3166-2-lvl4"?: string; // e.g. "US-FL"
        postcode?: string;
      };
    };

    const STATE_ABBR: Record<string, string> = {
      Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR",
      California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
      Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID",
      Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS",
      Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
      Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
      Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
      "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
      "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
      Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA",
      "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
      Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
      Virginia: "VA", Washington: "WA", "West Virginia": "WV",
      Wisconsin: "WI", Wyoming: "WY", "District of Columbia": "DC",
    };

    function formatAddress(item: NominatimResult): string {
      const a = item.address;
      if (!a) return item.display_name?.trim() ?? "";

      const streetNum = a.house_number ?? "";
      const street = a.road ?? "";
      const city = a.city ?? a.town ?? a.village ?? "";
      const stateFull = a.state ?? "";
      // Prefer the ISO code (e.g. "US-FL" -> "FL"), fall back to abbreviation map
      const isoCode = a["ISO3166-2-lvl4"];
      const stateAbbr = isoCode
        ? isoCode.replace(/^[A-Z]+-/, "")
        : STATE_ABBR[stateFull] ?? stateFull;
      const zip = a.postcode ?? "";

      const streetPart = [streetNum, street].filter(Boolean).join(" ");
      const cityStatePart = [city, stateAbbr ? `${stateAbbr} ${zip}` : zip]
        .filter(Boolean)
        .join(", ");

      const formatted = [streetPart, cityStatePart].filter(Boolean).join(", ");
      return formatted || (item.display_name?.trim() ?? "");
    }

    const json = (await response.json()) as NominatimResult[];
    return NextResponse.json({
      results: json.map(formatAddress).filter(Boolean),
    });
  } catch {
    return NextResponse.json({ error: "Address lookup failed." }, { status: 502 });
  }
}
