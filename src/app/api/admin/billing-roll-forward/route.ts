import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { calcToBill, filterNewBillingPeriods, rollForwardRows } from "@/lib/billing/calculations";
import type { BillingPeriod } from "@/types/database";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const profile = await resolveUserRole(user);
  if (!profile || !["admin", "ops_manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Admin or operations manager access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    periodMonth?: unknown;
    allowBlankActuals?: unknown;
  } | null;
  const periodMonth = typeof body?.periodMonth === "string" ? body.periodMonth : "";
  const allowBlankActuals = body?.allowBlankActuals === true;
  if (!/^\d{4}-\d{2}-01$/.test(periodMonth)) {
    return NextResponse.json({ error: "periodMonth must be the first day of a month." }, { status: 400 });
  }

  const admin = adminClient();
  const { data: currentPeriods, error: currentError } = await admin
    .from("billing_periods")
    .select("id, period_month, project_id, prior_pct, pct_complete, prev_billed, actual_billed, invoice_number, estimated_income_snapshot, notes, synced_from_onedrive, organization_id, project:projects!inner(is_active, name, job_number)")
    .eq("period_month", periodMonth);

  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 500 });
  }

  const activeCurrentPeriods = (currentPeriods ?? []).filter((period) => {
    const project = Array.isArray(period.project) ? period.project[0] : period.project;
    return project?.is_active !== false;
  });
  const activePeriods = activeCurrentPeriods as unknown as BillingPeriod[];
  const organizationByProjectId = new Map(
    (currentPeriods ?? []).map((period) => [period.project_id, period.organization_id])
  );
  const projectNameById = new Map(
    activeCurrentPeriods.map((period) => {
      const project = Array.isArray(period.project) ? period.project[0] : period.project;
      const label = project?.job_number ? `${project.job_number} - ${project.name}` : project?.name;
      return [period.project_id, label ?? period.project_id];
    })
  );

  if (activePeriods.length === 0) {
    return NextResponse.json({ error: "No active-project billing periods were found for this month." }, { status: 404 });
  }

  const blankActualWarnings = activePeriods.flatMap((period) => {
    const projectedAmount = calcToBill(
      period.estimated_income_snapshot,
      period.pct_complete,
      period.prev_billed
    );
    return period.actual_billed === null && projectedAmount > 0.005
      ? [{
          projectId: period.project_id,
          projectName: projectNameById.get(period.project_id) ?? period.project_id,
          projectedAmount,
        }]
      : [];
  });

  if (blankActualWarnings.length > 0 && !allowBlankActuals) {
    return NextResponse.json(
      {
        error: "Some projects have projected billing but no recorded actual billing.",
        requiresBlankActualConfirmation: true,
        blankActualWarnings,
      },
      { status: 409 }
    );
  }

  const nextRows = rollForwardRows(activePeriods);
  const nextMonth = nextRows[0].period_month;
  const { data: existingRows, error: existingError } = await admin
    .from("billing_periods")
    .select("project_id, estimated_income_snapshot, prior_pct, pct_complete, prev_billed")
    .eq("period_month", nextMonth)
    .in("project_id", nextRows.map((row) => row.project_id));

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const expectedByProjectId = new Map(nextRows.map((row) => [row.project_id, row]));
  const mismatches = (existingRows ?? []).flatMap((existing) => {
    const expected = expectedByProjectId.get(existing.project_id);
    if (!expected) return [];

    const differingFields = [
      Math.abs(Number(existing.estimated_income_snapshot) - expected.estimated_income_snapshot) > 0.005
        ? "estimated_income_snapshot"
        : null,
      Math.abs(Number(existing.prior_pct) - expected.prior_pct) > 1e-10 ? "prior_pct" : null,
      Math.abs(Number(existing.prev_billed) - expected.prev_billed) > 0.005 ? "prev_billed" : null,
    ].filter((field): field is string => field !== null);

    return differingFields.length > 0
      ? [{
          projectId: existing.project_id,
          projectName: projectNameById.get(existing.project_id) ?? existing.project_id,
          differingFields,
        }]
      : [];
  });

  const rowsToInsert = filterNewBillingPeriods(
    nextRows,
    (existingRows ?? []).map((row) => row.project_id)
  ).map((row) => ({
    period_month: row.period_month,
    project_id: row.project_id,
    estimated_income_snapshot: row.estimated_income_snapshot,
    prior_pct: row.prior_pct,
    pct_complete: row.pct_complete,
    prev_billed: row.prev_billed,
    actual_billed: row.actual_billed,
    invoice_number: row.invoice_number,
    notes: row.notes,
    synced_from_onedrive: false,
    organization_id: organizationByProjectId.get(row.project_id) ?? null,
  }));

  let created = 0;
  if (rowsToInsert.length > 0) {
    const { data: insertedRows, error: insertError } = await admin
      .from("billing_periods")
      .upsert(rowsToInsert, {
        onConflict: "project_id,period_month",
        ignoreDuplicates: true,
      })
      .select("project_id");
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    created = insertedRows?.length ?? 0;
  }

  return NextResponse.json({
    periodMonth: nextMonth,
    created,
    skipped: nextRows.length - created,
    mismatches,
  });
}
