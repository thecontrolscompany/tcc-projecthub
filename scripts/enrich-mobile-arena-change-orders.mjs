import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const PROJECT_ID = "824b2a05-eb00-4634-977d-c9216627a7be";

const updates = [
  {
    co_number: "CO-001",
    requested_days: 120,
  },
  {
    co_number: "CO-002",
    description:
      "Existing schedule-compression overtime request: four installers working one 10-hour overtime day per week for 41 weeks, including travel and margin. No time extension included with this request.",
    reference_doc: "Schedule Impact Review dated 14 Apr 26",
    submitted_date: "2026-04-14",
    requested_days: 0,
  },
  {
    co_number: "CO-003",
    description:
      "Additional installer support: two installers working one 10-hour day per week for 41 weeks, including travel and margin. No time extension included with this request.",
    reference_doc: "Schedule Impact Review dated 14 Apr 26",
    submitted_date: "2026-04-14",
    requested_days: 0,
  },
  {
    co_number: "CO-004",
    description: "Rerun the underground PVC for the cooling towers.",
    reference_doc: "Cooling Tower Conduit being ripped up by plumbers",
    submitted_date: "2026-05-27",
  },
  {
    co_number: "CO-005",
    description:
      "Scrape up the old plate and tar. Reinstall new plates. Someone unscrewed our sleeves from the plates resulting in us not being able to reuse the plates.",
    reference_doc: "Rooftop Penetrations Missing",
    submitted_date: "2026-06-02",
  },
  {
    co_number: "CO-006",
    description:
      "Correct damaged pipe. TCC told Barts they could take down conduit in the soffit between Area A-B, 3rd floor. Before it could be put back together, someone took a box downstream off allthread and pulled it over with jetline, bending about 40 feet of conduit downstream outside the area Barts was cleared to take down. TCC does not believe this was caused by Barts.",
    reference_doc: "Electrical Conduit Damaged",
    submitted_date: "2026-06-02",
  },
  {
    co_number: "CO-007",
    reference_doc: "GC Schedule OPS 260528 — Activity A2330 Contractor Punch",
    submitted_date: "2026-06-03",
  },
  {
    co_number: "CO-008",
    description:
      "Scrape up the old plate and tar. Reinstall new plates. Someone unscrewed our sleeves from the plates resulting in us not being able to reuse the plates.",
    reference_doc: "Damages Across Jobsite",
    submitted_date: "2026-06-06",
  },
  {
    co_number: "CO-009",
    description:
      "Scrape up the old plate and tar. Reinstall new plates. Someone unscrewed our sleeves from the plates resulting in us not being able to reuse the plates.",
    reference_doc: "Damages Across Jobsite",
    submitted_date: "2026-06-24",
  },
];

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  for (const { co_number, ...fields } of updates) {
    const { error } = await supabase
      .from("change_orders")
      .update(fields)
      .eq("project_id", PROJECT_ID)
      .eq("co_number", co_number);

    if (error) {
      throw new Error(`Failed to update ${co_number}: ${error.message}`);
    }

    console.log(`Updated ${co_number}`);
  }
}

main().catch((error) => {
  console.error("Mobile Arena change order enrichment failed.");
  console.error(error);
  process.exitCode = 1;
});
