import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const PROJECT_ID = "824b2a05-eb00-4634-977d-c9216627a7be";
const REPORT_TYPE = "mobile_arena_schedule_review";
const REPORT_ROOT =
  "C:\\Users\\TimothyCollins\\OneDrive - The Controls Company, LLC\\Projects\\Mobile Arena\\Schedule\\reports";

const reportDates = ["2026-03-09", "2026-04-06", "2026-04-27", "2026-06-15"];

const changeOrders = [
  {
    project_id: PROJECT_ID,
    co_number: "CO-002",
    title: "Acceleration / Overtime — Controls Install",
    amount: 99174.9,
    status: "pending",
    submitted_date: "2026-04-14",
  },
  {
    project_id: PROJECT_ID,
    co_number: "CO-003",
    title: "Additional Installers — Acceleration",
    amount: 49587.45,
    status: "pending",
    submitted_date: "2026-04-14",
  },
  {
    project_id: PROJECT_ID,
    co_number: "CO-011",
    title: "Schedule Delay & Compression — Predecessor Access Delays — Part-Time Scheduler Cost",
    amount: 21560.55,
    status: "pending",
    submitted_date: "2026-07-03",
    reference_doc: "/co-docs/CO-011.html",
  },
];

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function readReportPacket(packetDate) {
  const folder = path.join(REPORT_ROOT, `${packetDate}-review`);
  const [htmlContent, summaryMarkdown] = await Promise.all([
    readFile(path.join(folder, "report.html"), "utf8"),
    readFile(path.join(folder, "summary.md"), "utf8"),
  ]);

  return {
    project_id: PROJECT_ID,
    report_type: REPORT_TYPE,
    packet_date: packetDate,
    title: `Schedule Impact Review — Mobile Arena ${packetDate}`,
    body: { html_content: htmlContent },
    summary_markdown: summaryMarkdown,
    updated_at: new Date().toISOString(),
  };
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

  const packets = await Promise.all(reportDates.map(readReportPacket));

  const { error: packetError } = await supabase
    .from("project_report_packets")
    .upsert(packets, { onConflict: "project_id,report_type,packet_date" });

  if (packetError) {
    throw packetError;
  }

  const { data: existingChangeOrders, error: existingCoError } = await supabase
    .from("change_orders")
    .select("id, co_number")
    .eq("project_id", PROJECT_ID)
    .in("co_number", changeOrders.map((co) => co.co_number));

  if (existingCoError) {
    throw existingCoError;
  }

  const existingById = new Map((existingChangeOrders ?? []).map((co) => [co.co_number, co.id]));
  const toInsert = changeOrders.filter((co) => !existingById.has(co.co_number));
  const toUpdate = changeOrders.filter((co) => existingById.has(co.co_number));

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from("change_orders").insert(toInsert);
    if (insertError) throw insertError;
  }

  for (const co of toUpdate) {
    const rowId = existingById.get(co.co_number);
    const { error: updateError } = await supabase
      .from("change_orders")
      .update({ reference_doc: co.reference_doc ?? null, title: co.title, amount: co.amount, status: co.status })
      .eq("id", rowId);
    if (updateError) throw updateError;
  }

  console.log("Mobile Arena ProjectHub seed complete.");
  console.log(`- Schedule review packets upserted: ${packets.length}`);
  console.log(`- Change orders inserted: ${toInsert.map((co) => co.co_number).join(", ") || "none"}`);
  console.log(`- Change orders updated: ${toUpdate.map((co) => co.co_number).join(", ") || "none"}`);
}

main().catch((error) => {
  console.error("Mobile Arena ProjectHub seed failed.");
  console.error(error);
  process.exitCode = 1;
});
