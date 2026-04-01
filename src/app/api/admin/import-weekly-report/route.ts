import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

type ParsedWeeklyUpdate = {
  sheetName: string;
  weekOf: string | null;
  pmName: string | null;
  crewLog: Array<{ day: string; men: number; hours: number; activities: string }>;
  materialDelivered: string | null;
  equipmentSet: string | null;
  safetyIncidents: string | null;
  inspectionsTests: string | null;
  totalMen: number;
  totalHours: number;
  alreadyExists: boolean;
  parseError: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const resolvedProfile = await resolveUserRole(user);
  if (!["admin", "ops_manager"].includes(resolvedProfile?.role ?? "")) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const filename = typeof body?.filename === "string" ? body.filename : "";
  const rows = Array.isArray(body?.rows) ? (body.rows as ParsedWeeklyUpdate[]) : [];
  const overwriteDates = new Set<string>(Array.isArray(body?.overwriteDates) ? body.overwriteDates : []);

  if (!projectId || !filename) {
    return NextResponse.json({ error: "Missing project ID or filename." }, { status: 400 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.weekOf || row.parseError) {
      skipped += 1;
      continue;
    }

    const shouldOverwrite = row.alreadyExists && overwriteDates.has(row.weekOf);

    if (row.alreadyExists && !shouldOverwrite) {
      skipped += 1;
      continue;
    }

    try {
      if (shouldOverwrite) {
        const { error: deleteError } = await adminClient
          .from("weekly_updates")
          .delete()
          .eq("project_id", projectId)
          .eq("week_of", row.weekOf);
        if (deleteError) throw deleteError;
      }

      const { error } = await adminClient
        .from("weekly_updates")
        .insert({
          project_id: projectId,
          pm_id: null,
          week_of: row.weekOf,
          crew_log: row.crewLog,
          material_delivered: row.materialDelivered,
          equipment_set: row.equipmentSet,
          safety_incidents: row.safetyIncidents,
          inspections_tests: row.inspectionsTests,
          notes: null,
          imported_from: filename,
          submitted_at: new Date().toISOString(),
        });

      if (error) {
        if (error.message.toLowerCase().includes("duplicate") || error.message.toLowerCase().includes("unique")) {
          skipped += 1;
          continue;
        }
        throw error;
      }

      imported += 1;
    } catch (error) {
      skipped += 1;
      errors.push(`${row.sheetName}: ${error instanceof Error ? error.message : "Import failed."}`);
    }
  }

  return NextResponse.json({ imported, skipped, errors });
}
