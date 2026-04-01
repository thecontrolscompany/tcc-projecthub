"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
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

type ProjectRow = {
  id: string;
  name: string;
  job_number: string | null;
  estimated_income: number;
  contract_price: number | null;
  migration_status?: "legacy" | "migrated" | "clean" | null;
  is_active: boolean;
  billed_in_full: boolean;
  paid_in_full: boolean;
  completed_at: string | null;
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
  pm_directory?: { id: string; first_name: string | null; last_name: string | null; email: string; profile_id: string | null } | null;
  project_assignments: AssignmentRow[];
};

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

const PROJECT_SELECT_FIELDS = `
  id,
  name,
  job_number,
  estimated_income,
  contract_price,
  migration_status,
  is_active,
  billed_in_full,
  paid_in_full,
  completed_at,
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
  created_at,
  customer:customers(name),
  pm_directory:pm_directory(id, first_name, last_name, email, profile_id),
  project_assignments(
    id,
    profile_id,
    pm_directory_id,
    role_on_project,
    profile:profiles(id, full_name, email, role),
    pm_directory:pm_directory(id, first_name, last_name, email, profile_id)
  )
`;

type SortKey = "job_number" | "name" | "customer" | "contract_price";
type SortDir = "asc" | "desc";
type StatusFilter = "active" | "completed" | "all";

function normalizeSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeProject(item: Record<string, unknown>): ProjectRow {
  return {
    ...(item as ProjectRow),
    customer: normalizeSingle(item.customer as ProjectRow["customer"]),
    pm_directory: normalizeSingle(item.pm_directory as ProjectRow["pm_directory"]),
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

function buildAssignmentDrafts(project: ProjectRow, teamOptions: TeamMemberOption[]): ProjectAssignmentDraft[] {
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

  if (drafts.length > 0) {
    return drafts;
  }

  const fallbackPm = project.pm_id
    ? `profile:${project.pm_id}`
    : project.pm_directory_id
      ? `directory:${project.pm_directory_id}`
      : "";

  if (fallbackPm && teamOptions.some((option) => option.id === fallbackPm)) {
    return [{ personId: fallbackPm, roleOnProject: "pm" }];
  }

  return [];
}

function getPrimaryPmLabel(project: ProjectRow) {
  const primaryAssignment = project.project_assignments.find((assignment) => assignment.role_on_project === "pm");
  if (primaryAssignment?.profile?.full_name) return primaryAssignment.profile.full_name;
  if (primaryAssignment?.pm_directory) {
    return [primaryAssignment.pm_directory.first_name, primaryAssignment.pm_directory.last_name].filter(Boolean).join(" ").trim()
      || primaryAssignment.pm_directory.email;
  }
  return project.pm_directory?.first_name ?? project.pm_directory?.email ?? "-";
}

export function AdminProjectsTab() {
  const supabase = createClient();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [customers, setCustomers] = useState<ProjectCustomerOption[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [contacts, setContacts] = useState<ProjectContactOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRow | null>(null);
  const [isNewProjectFlow, setIsNewProjectFlow] = useState(false);
  const [isWaitingForSharePointFolder, setIsWaitingForSharePointFolder] = useState(false);
  const [jobNumberPreview, setJobNumberPreview] = useState("");
  const [formValues, setFormValues] = useState<ProjectFormValues>(EMPTY_PROJECT_FORM);
  const [validationErrors, setValidationErrors] = useState<ProjectFormErrors>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("job_number");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [assignments, setAssignments] = useState<ProjectAssignmentDraft[]>([]);
  const [pendingTeamMemberId, setPendingTeamMemberId] = useState("");
  const [pendingRoleOnProject, setPendingRoleOnProject] = useState<ProjectAssignmentRole>("pm");
  const [primaryPersonId, setPrimaryPersonId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const teamMemberOptions = useMemo(() => buildTeamMemberOptions(profiles, contacts), [contacts, profiles]);
  const externalContactOptions = useMemo(
    () => contacts.filter((contact) => !contact.email.toLowerCase().endsWith("@controlsco.net")),
    [contacts]
  );
  const siteAddresses = useMemo(() => {
    const seen = new Set<string>();
    return projects
      .map((p) => p.site_address)
      .filter((addr): addr is string => Boolean(addr?.trim()))
      .filter((addr) => { if (seen.has(addr)) return false; seen.add(addr); return true; })
      .sort();
  }, [projects]);
  const contractorNames = useMemo(() => {
    const seen = new Set<string>();
    return projects
      .flatMap((p) => [p.general_contractor, p.mechanical_contractor, p.electrical_contractor])
      .filter((name): name is string => Boolean(name?.trim()))
      .filter((name) => { if (seen.has(name)) return false; seen.add(name); return true; })
      .sort();
  }, [projects]);

  useEffect(() => {
    void loadProjects();
    void loadFormLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/data?section=projects", {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to load projects.");
      }
      setProjects(((json?.projects as Array<Record<string, unknown>> | null) ?? []).map((item) => normalizeProject(item)));
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadFormLookups() {
    const res = await fetch("/api/admin/data?section=project-lookups", {
      credentials: "include",
    });
    const json = await res.json();

    if (!res.ok) {
      setCustomers([]);
      setProfiles([]);
      setContacts([]);
      return;
    }

    setCustomers((json?.customers as ProjectCustomerOption[]) ?? []);
    setProfiles((json?.profiles as ProfileOption[]) ?? []);
    setContacts((json?.contacts as ProjectContactOption[]) ?? []);
  }

  async function fetchProjectById(projectId: string) {
    const res = await fetch(`/api/admin/data?section=project&id=${encodeURIComponent(projectId)}`, {
      credentials: "include",
    });
    const json = await res.json();
    if (!res.ok || !json?.project) return null;
    return normalizeProject(json.project as Record<string, unknown>);
  }

  async function pollForSharePointFolder(projectId: string) {
    setIsWaitingForSharePointFolder(true);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      const refreshedProject = await fetchProjectById(projectId);

      if (refreshedProject?.sharepoint_folder) {
        setEditingProject((current) => (!current || current.id === projectId ? refreshedProject : current));
        await loadProjects();
        setIsWaitingForSharePointFolder(false);
        return;
      }
    }

    setIsWaitingForSharePointFolder(false);
  }

  async function getNextJobNumber() {
    const year = new Date().getFullYear();
    const { data } = await supabase
      .from("projects")
      .select("job_number")
      .like("job_number", `${year}-%`)
      .order("job_number", { ascending: false })
      .limit(1);

    const last = data?.[0]?.job_number ?? `${year}-000`;
    const sequence = Number(last.split("-")[1] ?? "0") + 1;
    return `${year}-${String(sequence).padStart(3, "0")}`;
  }

  function resetEditorState() {
    setShowModal(false);
    setEditingProject(null);
    setIsNewProjectFlow(false);
    setIsWaitingForSharePointFolder(false);
    setFormValues(EMPTY_PROJECT_FORM);
    setValidationErrors({});
    setAssignments([]);
    setPendingTeamMemberId("");
    setPendingRoleOnProject("pm");
    setPrimaryPersonId(null);
  }

  async function openNewProjectModal() {
    const nextJobNumber = await getNextJobNumber();
    setEditingProject(null);
    setIsNewProjectFlow(true);
    setIsWaitingForSharePointFolder(false);
    setFormValues(EMPTY_PROJECT_FORM);
    setAssignments([]);
    setPendingTeamMemberId("");
    setPendingRoleOnProject("pm");
    setPrimaryPersonId(null);
    setValidationErrors({});
    setJobNumberPreview(nextJobNumber);
    setShowModal(true);
  }

  function openEditProjectModal(project: ProjectRow) {
    setEditingProject(project);
    setIsNewProjectFlow(false);
    setIsWaitingForSharePointFolder(false);
    setJobNumberPreview(project.job_number ?? "");
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
    const matchingPrimaryOption = project.pm_id
      ? teamMemberOptions.find((option) => option.profileId === project.pm_id)
      : project.pm_directory_id
        ? teamMemberOptions.find((option) => option.pmDirectoryId === project.pm_directory_id)
        : undefined;
    console.log("[open-edit] project.pm_id:", project.pm_id, "pm_directory_id:", project.pm_directory_id, "matched:", matchingPrimaryOption?.id ?? null);
    setPrimaryPersonId(matchingPrimaryOption?.id ?? null);
    setPendingTeamMemberId("");
    setPendingRoleOnProject("pm");
    setValidationErrors({});
    setSaveError(null);
    setShowModal(true);
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

  async function handleSaveProject() {
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

    setValidationErrors({});
    setSaveError(null);
    setSaving(true);

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

      console.log("[save-project] primaryPersonId:", primaryPersonId);
      console.log("[save-project] resolvedAssignments:", JSON.stringify(resolvedAssignments));

      const prevContractPrice = editingProject
        ? (editingProject.contract_price ?? editingProject.estimated_income ?? null)
        : null;

      const res = await fetch("/api/admin/save-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId: editingProject?.id ?? null,
          jobNumberPreview,
          prevContractPrice,
          formValues,
          resolvedAssignments,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Save failed.");

      if (editingProject) {
        resetEditorState();
      } else {
        const newProjectId: string = json.projectId;
        const newJobNumber: string = json.jobNumber ?? jobNumberPreview;

        fetch("/api/admin/provision-project-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: newProjectId,
            jobNumber: newJobNumber,
            projectName: formValues.projectName.trim(),
          }),
        }).catch((err) => console.error("Project folder provisioning failed", err));

        const createdProject = await fetchProjectById(newProjectId);
        setEditingProject(createdProject);
        setJobNumberPreview(newJobNumber);
        void pollForSharePointFolder(newProjectId);
      }

      await loadProjects();
    } catch (err) {
      console.error("Failed to save project from admin modal:", err);
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const visibleProjects = projects
    .filter((project) => {
      if (statusFilter === "active" && !project.is_active) return false;
      if (statusFilter === "completed" && project.is_active) return false;
      if (search) {
        const query = search.toLowerCase();
        return (
          project.name.toLowerCase().includes(query) ||
          (project.customer?.name ?? "").toLowerCase().includes(query) ||
          getPrimaryPmLabel(project).toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let av = "";
      let bv = "";
      if (sortKey === "job_number") { av = a.job_number ?? ""; bv = b.job_number ?? ""; }
      else if (sortKey === "name") {
        // Sort by the project description only, stripping the "YYYY-NNN - " prefix
        av = a.job_number && a.name.startsWith(`${a.job_number} - `) ? a.name.slice(a.job_number.length + 3).toLowerCase() : a.name.toLowerCase();
        bv = b.job_number && b.name.startsWith(`${b.job_number} - `) ? b.name.slice(b.job_number.length + 3).toLowerCase() : b.name.toLowerCase();
      }
      else if (sortKey === "customer") { av = a.customer?.name ?? ""; bv = b.customer?.name ?? ""; }
      else {
        const an = a.contract_price ?? a.estimated_income ?? 0;
        const bn = b.contract_price ?? b.estimated_income ?? 0;
        return sortDir === "asc" ? an - bn : bn - an;
      }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey !== col ? <span className="ml-1 opacity-30">↕</span> : sortDir === "asc" ? <span className="ml-1">↑</span> : <span className="ml-1">↓</span>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Projects</h2>
        <button
          onClick={() => void openNewProjectModal()}
          className="rounded-xl bg-brand-primary px-4 py-1.5 text-sm font-semibold text-text-inverse hover:bg-brand-hover"
        >
          + New Project
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-xl border border-border-default text-sm">
          {(["active", "completed", "all"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={[
                "px-3 py-1.5 capitalize",
                statusFilter === status
                  ? "bg-brand-primary text-text-inverse font-semibold"
                  : "text-text-secondary hover:bg-surface-overlay",
              ].join(" ")}
            >
              {status}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search projects, customer, PM..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-xl border border-border-default bg-surface-overlay px-3 py-1.5 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
        />
        <span className="text-xs text-text-tertiary">{visibleProjects.length} project{visibleProjects.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <div className="py-10 text-center text-text-tertiary">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-default">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-raised/80">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  <span className="cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("job_number")}># <SortIcon col="job_number" /></span>
                  <span className="mx-1 text-text-tertiary">/</span>
                  <span className="cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("name")}>Name <SortIcon col="name" /></span>
                </th>
                <th className="cursor-pointer select-none px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hover:text-text-primary" onClick={() => toggleSort("customer")}>Customer <SortIcon col="customer" /></th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Primary PM</th>
                <th className="cursor-pointer select-none px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary hover:text-text-primary" onClick={() => toggleSort("contract_price")}>Contract <SortIcon col="contract_price" /></th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">B / P</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary"></th>
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((project) => (
                <tr key={project.id} className="border-b border-border-default hover:bg-surface-raised">
                  <td className="px-3 py-2 font-medium text-text-primary">
                    {project.name}
                    {project.source_estimate_id && (
                      <span className="ml-2 inline-flex items-center rounded border border-brand-primary/20 bg-brand-primary/10 px-1.5 py-0.5 text-xs font-medium text-brand-primary">
                        EST
                      </span>
                    )}
                    {project.migration_status === "legacy" && (
                      <span className="ml-2 inline-flex items-center rounded border border-status-warning/20 bg-status-warning/10 px-1.5 py-0.5 text-xs font-medium text-status-warning">
                        Legacy
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    <div>{project.customer?.name ?? "-"}</div>
                    {project.customer_poc && <div className="text-xs text-text-tertiary">{project.customer_poc}</div>}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{getPrimaryPmLabel(project)}</td>
                  <td className="px-3 py-2 text-right text-text-secondary">{fmt(project.contract_price ?? project.estimated_income ?? 0)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={["rounded-full px-2 py-0.5 text-xs font-medium", project.is_active ? "bg-status-success/10 text-status-success" : "bg-surface-overlay text-text-secondary"].join(" ")}>
                      {project.is_active ? "Active" : "Completed"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-text-secondary">
                    {project.billed_in_full ? "B" : "·"} / {project.paid_in_full ? "P" : "·"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => openEditProjectModal(project)}
                      className="rounded-lg border border-border-default px-3 py-1 text-xs text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ProjectModal
          editingProject={editingProject}
          jobNumberPreview={jobNumberPreview}
          customers={customers}
          teamMemberOptions={teamMemberOptions}
          externalContacts={externalContactOptions}
          assignments={assignments}
          pendingTeamMemberId={pendingTeamMemberId}
          pendingRoleOnProject={pendingRoleOnProject}
          primaryPersonId={primaryPersonId}
          values={formValues}
          saving={saving}
          errors={validationErrors}
          saveError={saveError}
          siteAddresses={siteAddresses}
          contractorNames={contractorNames}
          onClose={resetEditorState}
          onChange={updateFormValue}
          onPendingTeamMemberChange={setPendingTeamMemberId}
          onPendingRoleChange={setPendingRoleOnProject}
          onSetPrimary={setPrimaryPersonId}
          onAddAssignment={addAssignment}
          onRemoveAssignment={removeAssignment}
          onSave={handleSaveProject}
          isNewProjectFlow={isNewProjectFlow}
          isWaitingForSharePointFolder={isWaitingForSharePointFolder}
        />
      )}
    </div>
  );
}
