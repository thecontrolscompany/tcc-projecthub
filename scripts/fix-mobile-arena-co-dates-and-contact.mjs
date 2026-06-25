import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const PROJECT_ID = "824b2a05-eb00-4634-977d-c9216627a7be";

const submittedAtFixes = [
  { co_number: "CO-004", submitted_at: "2026-05-27T00:00:00Z" },
  { co_number: "CO-005", submitted_at: "2026-06-02T00:00:00Z" },
  { co_number: "CO-006", submitted_at: "2026-06-02T00:00:00Z" },
  { co_number: "CO-007", submitted_at: "2026-06-03T00:00:00Z" },
  { co_number: "CO-008", submitted_at: "2026-06-06T00:00:00Z" },
  { co_number: "CO-009", submitted_at: "2026-06-24T00:00:00Z" },
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

  for (const { co_number, submitted_at } of submittedAtFixes) {
    const { data: co, error: fetchError } = await supabase
      .from("change_orders")
      .select("id")
      .eq("project_id", PROJECT_ID)
      .eq("co_number", co_number)
      .single();

    if (fetchError) {
      throw new Error(`Failed to find ${co_number}: ${fetchError.message}`);
    }

    const { error: updateError } = await supabase
      .from("change_orders")
      .update({ submitted_at })
      .eq("id", co.id);

    if (updateError) {
      throw new Error(`Failed to update submitted_at for ${co_number}: ${updateError.message}`);
    }

    const { error: historyError } = await supabase
      .from("change_order_status_history")
      .update({ changed_at: submitted_at })
      .eq("change_order_id", co.id)
      .eq("new_status", "submitted")
      .is("previous_status", null);

    if (historyError) {
      throw new Error(`Failed to update status history for ${co_number}: ${historyError.message}`);
    }

    console.log(`Fixed submitted_at + status history for ${co_number} -> ${submitted_at}`);
  }

  const { error: contactError } = await supabase
    .from("change_orders")
    .update({ customer_contact_name: "Blane Ivey" })
    .eq("project_id", PROJECT_ID);

  if (contactError) {
    throw new Error(`Failed to set customer contact: ${contactError.message}`);
  }

  console.log("Set customer_contact_name = Blane Ivey for all Mobile Arena change orders.");
}

main().catch((error) => {
  console.error("Mobile Arena change order date/contact fix failed.");
  console.error(error);
  process.exitCode = 1;
});
