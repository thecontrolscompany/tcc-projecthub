import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { format, startOfMonth } from "date-fns";

type ResolvedAssignment = {
  profile_id: string | null;
  pm_directory_id: string | null;
  role_on_project: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "ops_manager"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json();
  const {
    projectId,
    jobNumberPreview,
    prevContractPrice,
    formValues,
    resolvedAssignments,
  }: {
    projectId: string | null;
    jobNumberPreview: string;
    prevContractPrice: number | null;
    formValues: {
      projectName: string;
      customerId: string;
      useNewCustomer: boolean;
      newCustomerName: string;
      newCustomerEmail: string;
      contractPrice: string;
      customerPoc: string;
      customerPoNumber: string;
      siteAddress: string;
      generalContractor: string;
      mechanicalContractor: string;
      electricalContractor: string;
      notes: string;
      sourceEstimateId: string;
      specialRequirements: string;
      specialAccess: string;
      allConduitPlenum: boolean;
      certifiedPayroll: boolean;
      buyAmerican: boolean;
      bondRequired: boolean;
      billedInFull: boolean;
      paidInFull: boolean;
    };
    resolvedAssignments: ResolvedAssignment[];
  } = body;

  try {
    let customerId = formValues.customerId;

    if (formValues.useNewCustomer) {
      const { data: newCustomer, error: customerError } = await adminClient
        .from("customers")
        .insert({
          name: formValues.newCustomerName.trim(),
          contact_email: formValues.newCustomerEmail.trim() || null,
        })
        .select("id")
        .single();
      if (customerError) throw customerError;
      customerId = newCustomer.id;
    }

    const contractPrice = Number(formValues.contractPrice);
    const billedAndPaid = formValues.billedInFull && formValues.paidInFull;
    const projectName = `${jobNumberPreview} - ${formValues.projectName.trim()}`;
    const primaryPm = resolvedAssignments.find((a) => a.role_on_project === "pm") ?? null;

    const payload = {
      customer_id: customerId || null,
      pm_directory_id: primaryPm?.pm_directory_id ?? null,
      pm_id: primaryPm?.profile_id ?? null,
      name: projectName,
      estimated_income: contractPrice,
      contract_price: contractPrice,
      customer_poc: formValues.customerPoc.trim() || null,
      customer_po_number: formValues.customerPoNumber.trim() || null,
      site_address: formValues.siteAddress.trim() || null,
      general_contractor: formValues.generalContractor.trim() || null,
      mechanical_contractor: formValues.mechanicalContractor.trim() || null,
      electrical_contractor: formValues.electricalContractor.trim() || null,
      all_conduit_plenum: formValues.allConduitPlenum,
      certified_payroll: formValues.certifiedPayroll,
      buy_american: formValues.buyAmerican,
      bond_required: formValues.bondRequired,
      source_estimate_id: formValues.sourceEstimateId.trim() || null,
      special_requirements: formValues.specialRequirements.trim() || null,
      special_access: formValues.specialAccess.trim() || null,
      notes: formValues.notes.trim() || null,
      billed_in_full: formValues.billedInFull,
      paid_in_full: formValues.paidInFull,
      is_active: !billedAndPaid,
      completed_at: billedAndPaid ? new Date().toISOString() : null,
    };

    let savedProjectId: string;
    let savedJobNumber: string | null = jobNumberPreview;

    if (projectId) {
      // Edit existing project
      const { error } = await adminClient.from("projects").update(payload).eq("id", projectId);
      if (error) throw error;

      savedProjectId = projectId;

      if (prevContractPrice !== null && prevContractPrice !== contractPrice) {
        await adminClient
          .from("billing_periods")
          .update({ estimated_income_snapshot: contractPrice })
          .eq("project_id", projectId)
          .is("actual_billed", null);
      }
    } else {
      // Create new project
      const { data: inserted, error } = await adminClient
        .from("projects")
        .insert({ ...payload, job_number: jobNumberPreview })
        .select("id, job_number")
        .single();
      if (error) throw error;

      savedProjectId = inserted.id;
      savedJobNumber = inserted.job_number;

      await adminClient.from("billing_periods").insert({
        project_id: inserted.id,
        period_month: format(startOfMonth(new Date()), "yyyy-MM-dd"),
        estimated_income_snapshot: contractPrice,
        pct_complete: 0,
        prev_billed: 0,
      });
    }

    // Sync assignments — delete all then re-insert
    await adminClient.from("project_assignments").delete().eq("project_id", savedProjectId);
    if (resolvedAssignments.length > 0) {
      const rows = resolvedAssignments.map((a) => ({
        project_id: savedProjectId,
        profile_id: a.profile_id,
        pm_directory_id: a.pm_directory_id,
        role_on_project: a.role_on_project,
      }));
      const { error } = await adminClient.from("project_assignments").insert(rows);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, projectId: savedProjectId, jobNumber: savedJobNumber });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
