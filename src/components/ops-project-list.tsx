"use client";

import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth } from "date-fns";
import type { ProjectAssignmentRole } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import {
  EMPTY_PROJECT_FORM,
  ProjectModal,
  type ProjectAssignmentDraft,
  type ProjectContactOption,
  type ProjectCustomerOption,
  type ProjectFormErrors,
  type ProjectFormValues,
  type TeamMemberOption,
} from "@/components/project-modal";
import type { OpsProjectListItem } from "@/app/ops/page";

type ProfileOption = {
  id: string;
  full_name: string | null;
  email: string;
  role: ProjectAssignmentRole;
};

type AssignmentRow = {
  id: string;
  profile_id: string | null;
  pm_directory_id: string | null;
  role_on_project: ProjectAssignmentRole;
  profile?: { id: string; full_name: string | null; email: string; role: ProjectAssignmentRole } | null;
  pm_directory?: { id: string; first_name: string | null; last_name: string | null; email: string; profile_id: string | null } | null;
};

type ProjectEditorRow = {
  id: string;
  name: string;
  job_number: string | null;
  estimated_income: number;
  contract_price: number | null;
  is_active: boolean;
  billed_in_full: boolean;
  paid_in_full: boolean;
  customer_id: string | null;
  customer_poc: string | null;
  customer_po_number: string | null;
  site_address: string | null;
  general_contractor: string | null;
  mechanical_contractor: string | null;
  electrical_contractor: string | null;
  all_conduit_plenum: boolean;
  certified_payroll: boolean;
  buy_american: boolean;
  bond_required: boolean;
  source_estimate_id: string | null;
  special_requirements: string | null;
  special_access: string | null;
  notes: string | null;
  pm_directory_id: string | null;
  pm_id: string | null;
  sharepoint_folder: string | null;
  customer?: { name: string } | null;
  project_assignments: AssignmentRow[];
};

const PROJECT_SELECT_FIELDS = `
  id,
  name,
  job_number,
  estimated_income,
  contract_price,
  is_active,
  billed_in_full,
  paid_in_full,
  customer_id,
  customer_poc,
  customer_po_number,
  site_address,
  general_contractor,
  mechanical_contractor,
  electrical_contractor,
  all_conduit_plenum,
  certified_payroll,
  buy_american,
  bond_required,
  source_estimate_id,
  special_requirements,
  special_access,
  notes,
  pm_directory_id,
  pm_id,
  sharepoint_folder,
  customer:customers(name),
  project_assignments(
    id,
    profile_id,
    pm_directory_id,
    role_on_project,
    profile:profiles(id, full_name, email, role),
    pm_directory:pm_directory(id, first_name, last_name, email, profile_id)
  )
`;

function normalizeSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeProject(item: Record<string, unknown>): ProjectEditorRow {
  return {
    ...(item as ProjectEditorRow),
    customer: normalizeSingle(item.customer as ProjectEditorRow["customer"]),
    project_assignments: Array.isArray(item.project_assignments)
      ? item.project_assignments.map((assignment) => ({
          ...(assignment as AssignmentRow),
          profile: normalizeSingle((assignment as AssignmentRow).profile),
          pm_directory: normalizeSingle((assignment as AssignmentRow).pm_directory),
        }))
      : [],
  };
}

function buildTeamMemberOptions(profiles: ProfileOption[], contacts: ProjectContactOption[]) {
  const byEmail = new Map<string, TeamMemberOption>();

  for (const profile of profiles) {
    const email = profile.email.trim().toLowerCase();
    if (!email) continue;
    byEmail.set(email, {
      id: `profile:${profile.id}`,
      email: profile.email,
      displayLabel: `${profile.full_name?.trim() || profile.email} (${profile.email})`,
      source: "profile",
      profileId: profile.id,
      pmDirectoryId: contacts.find((contact) => contact.email.toLowerCase() === email)?.id ?? null,
    });
  }

  for (const contact of contacts) {
    const email = contact.email.trim().toLowerCase();
    if (!email || !email.endsWith("@controlsco.net") || contact.profile_id) continue;
    if (byEmail.has(email)) continue;
    const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
    byEmail.set(email, {
      id: `directory:${contact.id}`,
      email: contact.email,
      displayLabel: `${fullName || contact.email} (${contact.email}) - not yet signed in`,
      source: "directory",
      profileId: null,
      pmDirectoryId: contact.id,
    });
  }

  return Array.from(byEmail.values()).sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));
}

function buildAssignmentDrafts(project: ProjectEditorRow, teamOptions: TeamMemberOption[]): ProjectAssignmentDraft[] {
  const drafts = project.project_assignments.map((assignment): ProjectAssignmentDraft | null => {
    const personId = assignment.profile_id
      ? `profile:${assignment.profile_id}`
      : assignment.pm_directory_id
        ? `directory:${assignment.pm_directory_id}`
        : "";

    return {
      personId,
      roleOnProject: assignment.role_on_project as ProjectAssignmentRole,
    };
  }).filter((assignment): assignment is ProjectAssignmentDraft => Boolean(assignment?.personId));

  if (drafts.length > 0) return drafts;

  const fallbackPm = project.pm_id ? `profile:${project.pm_id}` : project.pm_directory_id ? `directory:${project.pm_directory_id}` : "";
  if (fallbackPm && teamOptions.some((option) => option.id === fallbackPm)) {
    return [{ personId: fallbackPm, roleOnProject: "pm" as const }];
  }

  return [];
}

export function OpsProjectList({ projects }: { projects: OpsProjectListItem[] }) {
  const supabase = createClient();
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectEditorRow | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<ProjectCustomerOption[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [contacts, setContacts] = useState<ProjectContactOption[]>([]);
  const [formValues, setFormValues] = useState<ProjectFormValues>(EMPTY_PROJECT_FORM);
  const [assignments, setAssignments] = useState<ProjectAssignmentDraft[]>([]);
  const [pendingTeamMemberId, setPendingTeamMemberId] = useState("");
  const [pendingRoleOnProject, setPendingRoleOnProject] = useState<ProjectAssignmentRole>("pm");
  const [validationErrors, setValidationErrors] = useState<ProjectFormErrors>({});

  const teamMemberOptions = useMemo(() => buildTeamMemberOptions(profiles, contacts), [contacts, profiles]);
  const externalContacts = useMemo(
    () => contacts.filter((contact) => !contact.email.toLowerCase().endsWith("@controlsco.net")),
    [contacts]
  );

  const visibleProjects = useMemo(
    () => (showCompleted ? projects : projects.filter((project) => project.is_active)),
    [projects, showCompleted]
  );

  const groupedProjects = useMemo(() => {
    return visibleProjects.reduce((acc, project) => {
      if (!acc.has(project.pmGroupName)) acc.set(project.pmGroupName, []);
      acc.get(project.pmGroupName)?.push(project);
      return acc;
    }, new Map<string, OpsProjectListItem[]>());
  }, [visibleProjects]);

  const sortedGroups = useMemo(() => {
    return Array.from(groupedProjects.entries()).sort(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });
  }, [groupedProjects]);

  useEffect(() => {
    async function loadLookups() {
      const [{ data: customerData }, { data: profileData }, { data: contactData }] = await Promise.all([
        supabase.from("customers").select("id, name, contact_email").order("name"),
        supabase.from("profiles").select("id, full_name, email, role").in("role", ["pm", "lead", "installer", "ops_manager"]).order("full_name"),
        supabase.from("pm_directory").select("id, first_name, last_name, email, profile_id").order("email"),
      ]);

      setCustomers((customerData as ProjectCustomerOption[]) ?? []);
      setProfiles((profileData as ProfileOption[]) ?? []);
      setContacts((contactData as ProjectContactOption[]) ?? []);
    }

    void loadLookups();
  }, [supabase]);

  function resetModal() {
    setShowModal(false);
    setSelectedProject(null);
    setFormValues(EMPTY_PROJECT_FORM);
    setAssignments([]);
    setPendingTeamMemberId("");
    setPendingRoleOnProject("pm");
    setValidationErrors({});
  }

  function updateFormValue<K extends keyof ProjectFormValues>(field: K, value: ProjectFormValues[K]) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setValidationErrors((current) => {
      const next = { ...current };
      delete next.form;
      if (field === "projectName") delete next.projectName;
      if (field === "contractPrice") delete next.contractPrice;
      if (field === "customerId" || field === "useNewCustomer") delete next.customerId;
      if (field === "newCustomerName" || field === "useNewCustomer") delete next.newCustomerName;
      return next;
    });
  }

  function addAssignment() {
    if (!pendingTeamMemberId) return;
    setAssignments((current) => {
      if (current.some((assignment) => assignment.personId === pendingTeamMemberId && assignment.roleOnProject === pendingRoleOnProject)) {
        return current;
      }
      return [...current, { personId: pendingTeamMemberId, roleOnProject: pendingRoleOnProject }];
    });
    setPendingTeamMemberId("");
    setPendingRoleOnProject("pm");
  }

  function removeAssignment(personId: string, roleOnProject: ProjectAssignmentRole) {
    setAssignments((current) => current.filter((assignment) => !(assignment.personId === personId && assignment.roleOnProject === roleOnProject)));
  }

  async function openProject(projectId: string) {
    const { data, error } = await supabase.from("projects").select(PROJECT_SELECT_FIELDS).eq("id", projectId).single();
    if (error || !data) return;

    const project = normalizeProject(data as Record<string, unknown>);
    setSelectedProject(project);
    setFormValues({
      projectName: project.name.startsWith(`${project.job_number} - `) && project.job_number
        ? project.name.slice(project.job_number.length + 3)
        : project.name,
      customerId: project.customer_id ?? "",
      useNewCustomer: false,
      newCustomerName: "",
      newCustomerEmail: "",
      contractPrice: String(project.contract_price ?? project.estimated_income ?? ""),
      customerPoc: project.customer_poc ?? "",
      customerPoNumber: project.customer_po_number ?? "",
      siteAddress: project.site_address ?? "",
      generalContractor: project.general_contractor ?? "",
      mechanicalContractor: project.mechanical_contractor ?? "",
      electricalContractor: project.electrical_contractor ?? "",
      notes: project.notes ?? "",
      sourceEstimateId: project.source_estimate_id ?? "",
      specialRequirements: project.special_requirements ?? "",
      specialAccess: project.special_access ?? "",
      allConduitPlenum: project.all_conduit_plenum ?? false,
      certifiedPayroll: project.certified_payroll ?? false,
      buyAmerican: project.buy_american ?? false,
      bondRequired: project.bond_required ?? false,
      billedInFull: project.billed_in_full ?? false,
      paidInFull: project.paid_in_full ?? false,
    });
    setAssignments(buildAssignmentDrafts(project, teamMemberOptions));
    setShowModal(true);
  }

  async function syncAssignments(projectId: string, nextAssignments: ProjectAssignmentDraft[]) {
    const rows = nextAssignments
      .map((assignment) => {
        const option = teamMemberOptions.find((item) => item.id === assignment.personId);
        if (!option) return null;
        return {
          project_id: projectId,
          profile_id: option.profileId,
          pm_directory_id: option.pmDirectoryId,
          role_on_project: assignment.roleOnProject,
        };
      })
      .filter(Boolean);

    const { error: deleteError } = await supabase.from("project_assignments").delete().eq("project_id", projectId);
    if (deleteError) throw deleteError;

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("project_assignments").insert(rows);
      if (insertError) throw insertError;
    }
  }

  async function handleSaveProject() {
    if (!selectedProject) return;

    const errors: ProjectFormErrors = {};
    if (!formValues.projectName.trim()) errors.projectName = "Project name is required";
    if (formValues.useNewCustomer) {
      if (!formValues.newCustomerName.trim()) errors.newCustomerName = "New customer name is required";
    } else if (!formValues.customerId) {
      errors.customerId = "Customer is required";
    }
    if (!formValues.contractPrice.trim()) errors.contractPrice = "Contract price is required";

    if (Object.keys(errors).length > 0) {
      setValidationErrors({ ...errors, form: "Please fill in all required fields before saving." });
      return;
    }

    setSaving(true);
    setValidationErrors({});

    try {
      let customerId = formValues.customerId;
      if (formValues.useNewCustomer) {
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({ name: formValues.newCustomerName.trim(), contact_email: formValues.newCustomerEmail.trim() || null })
          .select("id")
          .single();
        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      const contractPrice = Number(formValues.contractPrice);
      const billedAndPaid = formValues.billedInFull && formValues.paidInFull;
      const projectName = `${selectedProject.job_number} - ${formValues.projectName.trim()}`;
      const primaryPm = assignments.find((assignment) => assignment.roleOnProject === "pm");
      const primaryPmOption = primaryPm ? teamMemberOptions.find((option) => option.id === primaryPm.personId) ?? null : null;

      const { error } = await supabase
        .from("projects")
        .update({
          customer_id: customerId || null,
          pm_directory_id: primaryPmOption?.pmDirectoryId ?? null,
          pm_id: primaryPmOption?.profileId ?? null,
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
        })
        .eq("id", selectedProject.id);

      if (error) throw error;

      await syncAssignments(selectedProject.id, assignments);

      if ((selectedProject.contract_price ?? selectedProject.estimated_income) !== contractPrice) {
        await supabase
          .from("billing_periods")
          .update({ estimated_income_snapshot: contractPrice })
          .eq("project_id", selectedProject.id)
          .is("actual_billed", null);
      }

      resetModal();
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <label className="inline-flex items-center gap-3 rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-primary">
        <input
          type="checkbox"
          checked={showCompleted}
          onChange={(event) => setShowCompleted(event.target.checked)}
          className="h-4 w-4 accent-[var(--color-brand-primary)]"
        />
        Show completed projects
      </label>

      {sortedGroups.length === 0 ? (
        <div className="rounded-2xl border border-border-default bg-surface-raised px-4 py-6 text-sm text-text-secondary">
          No projects match the current filter.
        </div>
      ) : (
        <div className="space-y-6">
          {sortedGroups.map(([groupName, groupProjects]) => (
            <section key={groupName} className="overflow-hidden rounded-2xl border border-border-default">
              <div className="flex items-center justify-between border-b border-border-default bg-surface-raised px-4 py-3">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">{groupName}</h2>
                  <p className="text-xs text-text-secondary">
                    {groupProjects.length} project{groupProjects.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col style={{ width: "42%" }} />
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "12%" }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-border-default bg-surface-raised/60">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Project</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Customer</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">% Complete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupProjects.map((project) => (
                      <tr
                        key={project.id}
                        onClick={() => void openProject(project.id)}
                        className="cursor-pointer border-b border-border-default hover:bg-surface-raised"
                      >
                        <td className="px-4 py-2.5 font-medium text-text-primary">
                          <div className="flex items-center gap-2">
                            <span>{project.name}</span>
                            {project.sharepointFolder && (
                              <a
                                href={`https://controlsco.sharepoint.com/sites/TCCProjects/Shared%20Documents/${project.sharepointFolder.split("/").filter(Boolean).map(encodeURIComponent).join("/")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="shrink-0 rounded border border-brand-primary/20 bg-brand-primary/10 px-1.5 py-0.5 text-xs font-medium text-brand-primary hover:bg-brand-primary/20"
                              >
                                SP
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-text-secondary">{project.customerName ?? "-"}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              project.is_active ? "bg-status-success/10 text-status-success" : "bg-surface-overlay text-text-secondary",
                            ].join(" ")}
                          >
                            {project.is_active ? "Active" : "Completed"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-text-primary">{project.pctComplete.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {showModal && selectedProject && (
        <ProjectModal
          editingProject={selectedProject}
          jobNumberPreview={selectedProject.job_number ?? ""}
          customers={customers}
          teamMemberOptions={teamMemberOptions}
          externalContacts={externalContacts}
          assignments={assignments}
          pendingTeamMemberId={pendingTeamMemberId}
          pendingRoleOnProject={pendingRoleOnProject}
          values={formValues}
          saving={saving}
          errors={validationErrors}
          onClose={resetModal}
          onChange={updateFormValue}
          onPendingTeamMemberChange={setPendingTeamMemberId}
          onPendingRoleChange={setPendingRoleOnProject}
          onAddAssignment={addAssignment}
          onRemoveAssignment={removeAssignment}
          onSave={handleSaveProject}
          isNewProjectFlow={false}
          isWaitingForSharePointFolder={false}
        />
      )}
    </div>
  );
}
