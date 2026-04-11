# Task 073 — Format Nominatim Address Results

## Problem

`src/app/api/address-search/route.ts` returns the raw Nominatim `display_name`
string which includes county and country:

> 630, Kelly Street, Destin, Okaloosa County, Florida, 32541, United States

The user only wants: `630 Kelly Street, Destin, FL 32541`

## Fix

The route already passes `addressdetails=1`, so each result contains a
structured `address` object alongside `display_name`. Use those fields to
build a clean string and drop county/country.

Replace the type annotation and mapping in `src/app/api/address-search/route.ts`:

### Before
```ts
    const json = (await response.json()) as Array<{ display_name?: string }>;
    return NextResponse.json({
      results: json
        .map((item) => item.display_name?.trim() ?? "")
        .filter(Boolean),
    });
```

### After
```ts
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
      // Prefer the ISO code (e.g. "US-FL" → "FL"), fall back to abbreviation map
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
      return formatted || item.display_name?.trim() ?? "";
    }

    const json = (await response.json()) as NominatimResult[];
    return NextResponse.json({
      results: json.map(formatAddress).filter(Boolean),
    });
```

## When done

Run `npm run build` to confirm no type errors, then commit all changes and push to `main`.
