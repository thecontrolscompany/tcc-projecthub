import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const PROJECT_ID = "824b2a05-eb00-4634-977d-c9216627a7be";

const newChangeOrders = [
  {
    project_id: PROJECT_ID,
    co_number: "CO-004",
    title: "Cooling Tower Underground",
    amount: 5331,
    requested_amount: 5331,
    requested_days: 2,
    status: "submitted",
  },
  {
    project_id: PROJECT_ID,
    co_number: "CO-005",
    title: "Rooftop Penetrations",
    amount: 2211,
    requested_amount: 2211,
    requested_days: 1,
    status: "submitted",
  },
  {
    project_id: PROJECT_ID,
    co_number: "CO-006",
    title: "3rd Floor Conduit A-B",
    amount: 1366,
    requested_amount: 1366,
    requested_days: 1,
    status: "submitted",
  },
  {
    project_id: PROJECT_ID,
    co_number: "CO-007",
    title: "Extended Mobilization",
    amount: 45080,
    requested_amount: 45080,
    requested_days: 34,
    status: "submitted",
    description:
      "34-calendar-day extension of GC punch list activity A2330 (Nov 12, 2026 → Dec 16, 2026) per GC schedule OPS 260528. Additive mobilization claim — does not supersede or modify CO-001 through CO-006.",
  },
  {
    project_id: PROJECT_ID,
    co_number: "CO-008",
    title: "Rooftop Penetrations",
    amount: 3055,
    requested_amount: 3055,
    requested_days: 1,
    status: "submitted",
  },
  {
    project_id: PROJECT_ID,
    co_number: "CO-009",
    title: "Rooftop Penetrations",
    amount: 6039,
    requested_amount: 6039,
    requested_days: 1,
    status: "submitted",
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

  const { data: existing, error: existingError } = await supabase
    .from("change_orders")
    .select("co_number")
    .eq("project_id", PROJECT_ID)
    .in("co_number", newChangeOrders.map((co) => co.co_number));

  if (existingError) {
    throw existingError;
  }

  const existingCoNumbers = new Set((existing ?? []).map((co) => co.co_number));
  const missing = newChangeOrders.filter((co) => !existingCoNumbers.has(co.co_number));

  if (missing.length > 0) {
    const { error: insertError } = await supabase.from("change_orders").insert(missing);
    if (insertError) {
      throw insertError;
    }
  }

  console.log(`Change orders inserted: ${missing.map((co) => co.co_number).join(", ") || "none"}`);
  console.log(`Change orders already present: ${[...existingCoNumbers].join(", ") || "none"}`);

  const { data: revisedCo, error: revisedError } = await supabase
    .from("change_orders")
    .select("id")
    .eq("project_id", PROJECT_ID)
    .eq("co_number", "CO-002/003 Rev")
    .single();

  if (revisedError) {
    throw revisedError;
  }

  const { error: supersedeError } = await supabase
    .from("change_orders")
    .update({
      status: "superseded",
      status_reason: "Superseded by combined revised submission CO-002/003 Rev",
      superseded_by_change_order_id: revisedCo.id,
    })
    .eq("project_id", PROJECT_ID)
    .in("co_number", ["CO-002", "CO-003"]);

  if (supersedeError) {
    throw supersedeError;
  }

  console.log("CO-002 and CO-003 marked superseded by CO-002/003 Rev.");
}

main().catch((error) => {
  console.error("Mobile Arena change order reconciliation failed.");
  console.error(error);
  process.exitCode = 1;
});
