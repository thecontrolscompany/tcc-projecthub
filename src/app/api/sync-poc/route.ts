import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readOneDriveCell } from "@/lib/graph/client";

/**
 * POST /api/sync-poc
 * Body: { periodMonth: "2026-03-01" }
 *
 * Reads % complete (cell C5) from each active project's OneDrive POC Sheet.xlsx
 * and updates billing_periods.pct_complete.
 *
 * Mirrors legacy sync_poc.py with fuzzy project name matching.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const providerToken = session.provider_token;
  if (!providerToken) {
    return NextResponse.json(
      {
        message:
          "Microsoft access token not available. Please sign out and sign back in with Microsoft to enable OneDrive sync.",
      },
      { status: 400 }
    );
  }

  const { periodMonth } = await request.json();
  if (!periodMonth) {
    return NextResponse.json({ message: "periodMonth is required." }, { status: 400 });
  }

  // Fetch active projects that have an OneDrive path configured
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, onedrive_path")
    .eq("is_active", true)
    .not("onedrive_path", "is", null);

  if (!projects?.length) {
    return NextResponse.json({
      message: "No projects with OneDrive paths configured. Add onedrive_path to projects first.",
    });
  }

  const results = {
    synced: 0,
    skipped: 0,
    errors: 0,
    details: [] as string[],
  };

  for (const project of projects) {
    if (!project.onedrive_path) continue;

    const pct = await readOneDriveCell(providerToken, project.onedrive_path);

    if (pct === null) {
      results.errors++;
      results.details.push(`${project.name}: could not read POC sheet`);
      continue;
    }

    const { error } = await supabase
      .from("billing_periods")
      .update({ pct_complete: pct, synced_from_onedrive: true })
      .eq("project_id", project.id)
      .eq("period_month", periodMonth);

    if (error) {
      results.errors++;
      results.details.push(`${project.name}: DB update failed`);
    } else {
      results.synced++;
      results.details.push(`${project.name}: synced ${(pct * 100).toFixed(1)}%`);
    }
  }

  return NextResponse.json({
    message: `Sync complete. ${results.synced} synced, ${results.skipped} skipped, ${results.errors} errors.`,
    details: results.details,
  });
}
