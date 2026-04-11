"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ViewReportLink } from "@/components/view-report-link";
import type { ProjectAssignmentRole } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { normalizeSingle } from "@/lib/utils/normalize";
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
import {
  buildTeamMemberOptions,
  buildAssignmentDrafts,
  type ProfileOption,
} from "@/lib/project/assignments";
import { PROJECT_SELECT_FIELDS } from "@/lib/project/select-fields";

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
  start_date: string | null;
  scheduled_completion: string | null;
  scope_description: string | null;
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

type WeeklyUpdateSummary = {
  id: string;
  week_of: string;
  pct_complete: number | null;
  status: "draft" | "submitted";
  blockers: string | null;
};

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

export function OpsProjectList({ projects, portalCustomerIds }: { projects: OpsProjectListItem[]; portalCustomerIds: Set<string> }) {
  const supabase = createClient();
  const [showCompleted, setShowCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<"grouped" | "all" | "by-customer" | "customer-access">("grouped");
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [projectUpdates, setProjectUpdates] = useState<Record<string, WeeklyUpdateSummary[]>>({});
  const [loadingUpdatesFor, setLoadingUpdatesFor] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectEditorRow | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<ProjectCustomerOption[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [contacts, setContacts] = useState<ProjectContactOption[]>([]);
  const [formValues, setFormValues] = useState<ProjectFormValues>(EMPTY_PROJECT_FORM);
  const [assignments, setAssignments] = useState<ProjectAssignmentDraft[]>([]);
  const [pendingTeamMemberId, setPendingTeamMemberId] = useState("");
  const [pendingRoleOnProject, setPendingRoleOnProject] = useState<ProjectAssignmentRole>("pm");
  const [primaryPersonId, setPrimaryPersonId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ProjectFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  type CustomerAccessEntry = {
    profile_id: string;
    full_name: string | null;
    email: string;
    projects: Array<{ project_id: string; project_name: string; portal_access: boolean; email_digest: boolean }>;
  };
  const [customerAccess, setCustomerAccess] = useState<CustomerAccessEntry[] | null>(null);
  const [loadingCustomerAccess, setLoadingCustomerAccess] = useState(false);

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

  const groupedByCustomer = useMemo(() => {
    return visibleProjects.reduce((acc, project) => {
      const key = project.customerName?.trim() || "No Customer";
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key)?.push(project);
      return acc;
    }, new Map<string, OpsProjectListItem[]>());
  }, [visibleProjects]);

  const sortedCustomerGroups = useMemo(() => {
    return Array.from(groupedByCustomer.entries()).sort(([aName, aProjects], [bName, bProjects]) => {
      if (aName === "No Customer") return 1;
      if (bName === "No Customer") return -1;
      const aHasPortal = aProjects.some((p) => p.customerId && portalCustomerIds.has(p.customerId));
      const bHasPortal = bProjects.some((p) => p.customerId && portalCustomerIds.has(p.customerId));
      if (aHasPortal && !bHasPortal) return -1;
      if (!aHasPortal && bHasPortal) return 1;
      return aName.localeCompare(bName);
    });
  }, [groupedByCustomer, portalCustomerIds]);

  useEffect(() => {
    async function loadLookups() {
      try {
        const response = await fetch("/api/admin/data?section=project-lookups", {
          credentials: "include",
        });
        const json = await response.json();
        if (!response.ok) {
          setModalError(json?.error ?? "Failed to load project lookups.");
          return;
        }

        setCustomers((json?.customers as ProjectCustomerOption[]) ?? []);
        setProfiles((json?.profiles as ProfileOption[]) ?? []);
        setContacts((json?.contacts as ProjectContactOption[]) ?? []);
      } catch {
        setModalError("Failed to load project lookups.");
      }
    }

    void loadLookups();
  }, []);

  useEffect(() => {
    if (viewMode !== "customer-access" || customerAccess !== null) return;
    setLoadingCustomerAccess(true);
    fetch("/api/admin/data?section=customer-access", { credentials: "include" })
      .then((res) => res.json())
      .then((json) => setCustomerAccess((json?.contacts as CustomerAccessEntry[]) ?? []))
      .catch(() => setCustomerAccess([]))
      .finally(() => setLoadingCustomerAccess(false));
  }, [viewMode, customerAccess]);

  function resetModal() {
    setShowModal(false);
    setSelectedProject(null);
    setLoadingProjectId(null);
    setModalError(null);
    setSaveError(null);
    setFormValues(EMPTY_PROJECT_FORM);
    setAssignments([]);
    setPendingTeamMemberId("");
    setPendingRoleOnProject("pm");
    setPrimaryPersonId(null);
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
    const nextPersonId = pendingTeamMemberId;
    const nextRole = pendingRoleOnProject;
    setAssignments((current) => {
      if (current.some((assignment) => assignment.personId === nextPersonId && assignment.roleOnProject === nextRole)) {
        return current;
      }
      return [...current, { personId: nextPersonId, roleOnProject: nextRole }];
    });
    if (nextRole === "pm" && !primaryPersonId) {
      setPrimaryPersonId(nextPersonId);
    }
    setPendingTeamMemberId("");
    setPendingRoleOnProject("pm");
  }

  function removeAssignment(personId: string, roleOnProject: ProjectAssignmentRole) {
    const nextAssignments = assignments.filter((assignment) => !(assignment.personId === personId && assignment.roleOnProject === roleOnProject));
    setAssignments(nextAssignments);
    if (personId === primaryPersonId && roleOnProject === "pm") {
      setPrimaryPersonId(nextAssignments.find((assignment) => assignment.roleOnProject === "pm")?.personId ?? null);
    }
  }

  async function toggleProjectUpdates(projectId: string) {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
      return;
    }

    setExpandedProjectId(projectId);
    if (projectUpdates[projectId]) return;

    setLoadingUpdatesFor(projectId);
    try {
      const res = await fetch(
        `/api/admin/data?section=project-weekly-updates&projectId=${encodeURIComponent(projectId)}`,
        { credentials: "include" }
      );
      const json = await res.json();
      setProjectUpdates((prev) => ({
        ...prev,
        [projectId]: (json?.updates as WeeklyUpdateSummary[]) ?? [],
      }));
    } catch {
      setProjectUpdates((prev) => ({ ...prev, [projectId]: [] }));
    } finally {
      setLoadingUpdatesFor(null);
    }
  }

  async function openProject(projectId: string) {
    setLoadingProjectId(projectId);
    setModalError(null);

    try {
      const response = await fetch(`/api/admin/data?section=project&id=${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      const json = await response.json();

      if (!response.ok || !json?.project) {
        setModalError(json?.error ?? "Failed to load project details.");
        return;
      }

      const project = normalizeProject(json.project as Record<string, unknown>);
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
        startDate: project.start_date ?? "",
        scheduledCompletion: project.scheduled_completion ?? "",
        generalContractor: project.general_contractor ?? "",
        mechanicalContractor: project.mechanical_contractor ?? "",
        electricalContractor: project.electrical_contractor ?? "",
        notes: project.notes ?? "",
        scopeDescription: project.scope_description ?? "",
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
      const matchingPrimaryOption = project.pm_id
        ? teamMemberOptions.find((option) => option.profileId === project.pm_id)
        : project.pm_directory_id
          ? teamMemberOptions.find((option) => option.pmDirectoryId === project.pm_directory_id)
          : undefined;
      setPrimaryPersonId(matchingPrimaryOption?.id ?? null);
      setShowModal(true);
    } catch {
      setModalError("Failed to load project details.");
    } finally {
      setLoadingProjectId(null);
    }
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
    setSaveError(null);

    try {
      const resolvedAssignments = assignments
        .map((assignment) => {
          const option = teamMemberOptions.find((item) => item.id === assignment.personId);
          if (!option) return null;
          return {
            profile_id: option.profileId,
            pm_directory_id: option.pmDirectoryId,
            role_on_project: assignment.roleOnProject,
            is_primary: assignment.personId === primaryPersonId,
          };
        })
        .filter(Boolean);

      const prevContractPrice = selectedProject.contract_price ?? selectedProject.estimated_income ?? null;

      const response = await fetch("/api/admin/save-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId: selectedProject.id,
          jobNumberPreview: selectedProject.job_number ?? "",
          prevContractPrice,
          formValues,
          resolvedAssignments,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Save failed.");
      }

      resetModal();
      window.location.reload();
    } catch (err) {
      console.error("Failed to save project from ops modal:", err);
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function renderProjectNameCell(project: OpsProjectListItem) {
    return (
      <div className="flex items-center gap-2">
        <span>{project.name}</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void openProject(project.id);
          }}
          className="shrink-0 rounded border border-border-default bg-surface-overlay px-2 py-0.5 text-xs font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary"
        >
          Edit
        </button>
        {loadingProjectId === project.id && (
          <span className="text-xs text-text-tertiary">Loading...</span>
        )}
        {project.sharepointFolder && (
          <a
            href={`https://controlsco.sharepoint.com/sites/TCCProjects/Shared%20Documents/${project.sharepointFolder.split("/").filter(Boolean).map(encodeURIComponent).join("/")}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="shrink-0 rounded border border-brand-primary/20 bg-brand-primary/10 px-1.5 py-0.5 text-xs font-medium text-brand-primary hover:bg-brand-primary/20"
          >
            SP
          </a>
        )}
      </div>
    );
  }

  function renderExpandedUpdates(projectId: string) {
    if (loadingUpdatesFor === projectId) {
      return <p className="text-xs text-text-tertiary">Loading updates...</p>;
    }

    const updates = projectUpdates[projectId] ?? [];
    if (updates.length === 0) {
      return <p className="text-xs text-text-tertiary">No weekly updates on file.</p>;
    }

    return (
      <div className="space-y-1.5">
        {updates.slice(0, 8).map((update) => (
          <div
            key={update.id}
            className="flex items-center justify-between rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-xs"
          >
            <span className="text-text-secondary">Week of {update.week_of}</span>
            <div className="flex items-center gap-3">
              {update.pct_complete !== null && (
                <span className="font-semibold text-status-success">
                  {(update.pct_complete * 100).toFixed(1)}%
                </span>
              )}
              <span
                className={[
                  "rounded-full px-2 py-0.5 font-medium capitalize",
                  update.status === "draft"
                    ? "bg-status-warning/10 text-status-warning"
                    : "bg-status-success/10 text-status-success",
                ].join(" ")}
              >
                {update.status}
              </span>
              {update.status === "submitted" && <ViewReportLink updateId={update.id} />}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {modalError && (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {modalError}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("grouped")}
            className={[
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              viewMode === "grouped"
                ? "bg-surface-overlay text-text-primary shadow-sm"
                : "text-text-secondary hover:bg-surface-overlay/70 hover:text-text-primary",
            ].join(" ")}
          >
            By PM
          </button>
          <button
            onClick={() => setViewMode("all")}
            className={[
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              viewMode === "all"
                ? "bg-surface-overlay text-text-primary shadow-sm"
                : "text-text-secondary hover:bg-surface-overlay/70 hover:text-text-primary",
            ].join(" ")}
          >
            By Project
          </button>
          <button
            onClick={() => setViewMode("by-customer")}
            className={[
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              viewMode === "by-customer"
                ? "bg-surface-overlay text-text-primary shadow-sm"
                : "text-text-secondary hover:bg-surface-overlay/70 hover:text-text-primary",
            ].join(" ")}
          >
            By Customer
          </button>
          <button
            onClick={() => setViewMode("customer-access")}
            className={[
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              viewMode === "customer-access"
                ? "bg-surface-overlay text-text-primary shadow-sm"
                : "text-text-secondary hover:bg-surface-overlay/70 hover:text-text-primary",
            ].join(" ")}
          >
            Customer Access
          </button>
        </div>
        {viewMode !== "customer-access" && (
          <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(event) => setShowCompleted(event.target.checked)}
              className="h-4 w-4 accent-[var(--color-brand-primary)]"
            />
            Show completed
          </label>
        )}
      </div>

      {viewMode === "customer-access" ? (
        loadingCustomerAccess ? (
          <div className="py-16 text-center text-text-tertiary">Loading customer access...</div>
        ) : !customerAccess || customerAccess.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-default px-6 py-12 text-center text-sm text-text-secondary">
            No customer portal access has been configured. Open a project, go to Team, and add contacts under Customer Portal Access.
          </div>
        ) : (
          <div className="space-y-4">
            {customerAccess.map((person) => (
              <section key={person.profile_id} className="overflow-hidden rounded-2xl border border-border-default">
                <div className="border-b border-border-default bg-surface-raised px-4 py-3">
                  <p className="font-semibold text-text-primary">{person.full_name ?? person.email}</p>
                  <p className="text-xs text-text-tertiary">{person.email}</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-raised/50">
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Project</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">Portal</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {person.projects.map((proj) => (
                      <tr key={proj.project_id} className="border-b border-border-default last:border-0 hover:bg-surface-raised">
                        <td className="px-4 py-2.5 text-text-primary">
                          <div className="flex items-center gap-2">
                            <span>{proj.project_name}</span>
                            <button
                              type="button"
                              onClick={() => void openProject(proj.project_id)}
                              className="shrink-0 rounded border border-border-default bg-surface-overlay px-2 py-0.5 text-xs font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                            >
                              {loadingProjectId === proj.project_id ? "Loading..." : "Edit"}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {proj.portal_access ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-status-success/15 text-status-success">
                              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>
                            </span>
                          ) : (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border-default text-text-tertiary">
                              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {proj.email_digest ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-status-success/15 text-status-success">
                              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>
                            </span>
                          ) : (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border-default text-text-tertiary">
                              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )
      ) : viewMode === "by-customer" ? (
        sortedCustomerGroups.length === 0 ? (
          <div className="rounded-2xl border border-border-default bg-surface-raised px-4 py-6 text-sm text-text-secondary">
            No projects match the current filter.
          </div>
        ) : (
          <div className="space-y-6">
            {sortedCustomerGroups.map(([customerName, customerProjects]) => {
              const hasPortal = customerProjects.some((p) => p.customerId && portalCustomerIds.has(p.customerId));
              return (
              <section key={customerName} className="overflow-hidden rounded-2xl border border-border-default">
                <div className="flex items-center justify-between border-b border-border-default bg-surface-raised px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-text-primary">{customerName}</h2>
                      <p className="text-xs text-text-secondary">
                        {customerProjects.length} project{customerProjects.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    {hasPortal && (
                      <span className="rounded-full border border-brand-primary/30 bg-brand-primary/10 px-2 py-0.5 text-xs font-medium text-brand-primary">
                        Portal
                      </span>
                    )}
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
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">PM</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">% Complete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerProjects.map((project) => (
                        <Fragment key={project.id}>
                          <tr
                            onClick={() => void toggleProjectUpdates(project.id)}
                            className="cursor-pointer border-b border-border-default hover:bg-surface-raised"
                          >
                            <td className="px-4 py-2.5 font-medium text-text-primary">{renderProjectNameCell(project)}</td>
                            <td className="px-4 py-2.5 text-text-secondary">{project.pmGroupName !== "Unassigned" ? project.pmGroupName : "-"}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={["rounded-full px-2 py-0.5 text-xs font-medium", project.is_active ? "bg-status-success/10 text-status-success" : "bg-surface-overlay text-text-secondary"].join(" ")}>
                                {project.is_active ? "Active" : "Completed"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-text-primary">{project.pctComplete.toFixed(1)}%</td>
                          </tr>
                          {expandedProjectId === project.id && (
                            <tr className="border-b border-border-default bg-surface-raised/40">
                              <td colSpan={4} className="px-6 py-3">
                                {renderExpandedUpdates(project.id)}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
            })}
          </div>
        )
      ) : viewMode === "all" ? (
        <div className="overflow-hidden rounded-2xl border border-border-default">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-raised/80">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Project</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Customer</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">PM</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">% Complete</th>
              </tr>
            </thead>
            <tbody>
              {(showCompleted ? projects : projects.filter((project) => project.is_active))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((project) => (
                  <Fragment key={project.id}>
                    <tr
                      onClick={() => void toggleProjectUpdates(project.id)}
                      className="cursor-pointer border-b border-border-default hover:bg-surface-raised"
                    >
                      <td className="px-4 py-2.5 font-medium text-text-primary">{renderProjectNameCell(project)}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{project.customerName ?? "-"}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{project.pmGroupName !== "Unassigned" ? project.pmGroupName : "-"}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={["rounded-full px-2 py-0.5 text-xs font-medium", project.is_active ? "bg-status-success/10 text-status-success" : "bg-surface-overlay text-text-secondary"].join(" ")}>
                          {project.is_active ? "Active" : "Completed"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-text-primary">{project.pctComplete.toFixed(1)}%</td>
                    </tr>
                    {expandedProjectId === project.id && (
                      <tr className="border-b border-border-default bg-surface-raised/40">
                        <td colSpan={5} className="px-6 py-3">
                          {renderExpandedUpdates(project.id)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
            </tbody>
          </table>
        </div>
      ) : sortedGroups.length === 0 ? (
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
                      <Fragment key={project.id}>
                        <tr
                          onClick={() => void toggleProjectUpdates(project.id)}
                          className="cursor-pointer border-b border-border-default hover:bg-surface-raised"
                        >
                          <td className="px-4 py-2.5 font-medium text-text-primary">{renderProjectNameCell(project)}</td>
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
                        {expandedProjectId === project.id && (
                          <tr className="border-b border-border-default bg-surface-raised/40">
                            <td colSpan={4} className="px-6 py-3">
                              {renderExpandedUpdates(project.id)}
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
          primaryPersonId={primaryPersonId}
          values={formValues}
          saving={saving}
          errors={validationErrors}
          saveError={saveError}
          onClose={resetModal}
          onChange={updateFormValue}
          onPendingTeamMemberChange={setPendingTeamMemberId}
          onPendingRoleChange={setPendingRoleOnProject}
          onSetPrimary={setPrimaryPersonId}
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
