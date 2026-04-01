"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { ViewReportLink } from "@/components/view-report-link";
import type { PocLineItem, Profile, ProjectAssignmentRole, ProjectCustomerContact } from "@/types/database";

export type ProjectCustomerOption = {
  id: string;
  name: string;
  contact_email: string | null;
};

export type ProjectContactOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  profile_id: string | null;
};

export type TeamMemberOption = {
  id: string;
  email: string;
  displayLabel: string;
  source: "profile" | "directory";
  profileId: string | null;
  pmDirectoryId: string | null;
};

export type ProjectAssignmentDraft = {
  personId: string;
  roleOnProject: ProjectAssignmentRole;
};

export type ProjectFormErrors = Partial<Record<"form" | "projectName" | "customerId" | "newCustomerName" | "contractPrice", string>>;

export type ProjectFormValues = {
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

export type ProjectModalProject = {
  id: string;
  sharepoint_folder: string | null;
};

export const EMPTY_PROJECT_FORM: ProjectFormValues = {
  projectName: "",
  customerId: "",
  useNewCustomer: false,
  newCustomerName: "",
  newCustomerEmail: "",
  contractPrice: "",
  customerPoc: "",
  customerPoNumber: "",
  siteAddress: "",
  generalContractor: "",
  mechanicalContractor: "",
  electricalContractor: "",
  notes: "",
  sourceEstimateId: "",
  specialRequirements: "",
  specialAccess: "",
  allConduitPlenum: false,
  certifiedPayroll: false,
  buyAmerican: false,
  bondRequired: false,
  billedInFull: false,
  paidInFull: false,
};

const inputClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

const textareaClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

type DocumentType = "contract" | "scope" | "estimate";
type UploadState = "idle" | "uploading" | "success" | "error";

type UploadStatus = {
  state: UploadState;
  message: string;
  webUrl?: string | null;
};

const DOCUMENT_OPTIONS: Array<{ type: DocumentType; label: string }> = [
  { type: "contract", label: "Contract" },
  { type: "scope", label: "Scope" },
  { type: "estimate", label: "Estimate" },
];

const ROLE_LABELS: Record<ProjectAssignmentRole, string> = {
  pm: "PM",
  lead: "Lead",
  installer: "Installer",
  ops_manager: "Ops Manager",
};

const ROLE_BADGE_STYLES: Record<ProjectAssignmentRole, string> = {
  pm: "bg-status-info/10 text-status-info",
  lead: "bg-status-warning/10 text-status-warning",
  installer: "bg-brand-primary/10 text-brand-primary",
  ops_manager: "bg-surface-overlay text-text-primary",
};

export function ProjectModal({
  editingProject,
  jobNumberPreview,
  customers,
  teamMemberOptions,
  externalContacts,
  assignments,
  pendingTeamMemberId,
  pendingRoleOnProject,
  values,
  saving,
  errors,
  isNewProjectFlow,
  isWaitingForSharePointFolder,
  onClose,
  onChange,
  onPendingTeamMemberChange,
  onPendingRoleChange,
  onAddAssignment,
  onRemoveAssignment,
  onSave,
}: {
  editingProject: ProjectModalProject | null;
  jobNumberPreview: string;
  customers: ProjectCustomerOption[];
  teamMemberOptions: TeamMemberOption[];
  externalContacts: ProjectContactOption[];
  assignments: ProjectAssignmentDraft[];
  pendingTeamMemberId: string;
  pendingRoleOnProject: ProjectAssignmentRole;
  values: ProjectFormValues;
  saving: boolean;
  errors: ProjectFormErrors;
  isNewProjectFlow: boolean;
  isWaitingForSharePointFolder: boolean;
  onClose: () => void;
  onChange: <K extends keyof ProjectFormValues>(field: K, value: ProjectFormValues[K]) => void;
  onPendingTeamMemberChange: (value: string) => void;
  onPendingRoleChange: (value: ProjectAssignmentRole) => void;
  onAddAssignment: () => void;
  onRemoveAssignment: (personId: string, roleOnProject: ProjectAssignmentRole) => void;
  onSave: () => void;
}) {
  const customerOptions = useMemo(() => customers, [customers]);
  const customerPocOptions = useMemo(() => {
    const options = [...externalContacts];
    const currentValue = values.customerPoc.trim();

    if (currentValue && !options.some((contact) => formatContactLabel(contact) === currentValue)) {
      options.unshift({
        id: "__current__",
        first_name: currentValue,
        last_name: null,
        email: currentValue,
        profile_id: null,
      });
    }

    return options;
  }, [externalContacts, values.customerPoc]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border-default bg-surface-base shadow-xl">
        <div className="flex items-start justify-between border-b border-border-default px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
              {editingProject ? "Edit Project" : "New Project"}
            </p>
            <div className="flex items-center gap-3">
              <h3 className="font-heading text-xl font-bold text-text-primary">
                {jobNumberPreview || "Pending Job Number"}
              </h3>
              {editingProject?.sharepoint_folder && (
                <a
                  href={`https://controlsco.sharepoint.com/sites/TCCProjects/Shared%20Documents/${editingProject.sharepoint_folder.split("/").filter(Boolean).map(encodeURIComponent).join("/")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-primary/20 bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-primary hover:bg-brand-primary/20"
                >
                  Open SharePoint
                </a>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            x
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          {errors.form && (
            <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
              {errors.form}
            </div>
          )}

          <section className="space-y-4">
            <h4 className="font-heading text-lg font-semibold text-text-primary">Project Info</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Project Name *" error={errors.projectName}>
                <input value={values.projectName} onChange={(e) => onChange("projectName", e.target.value)} className={inputClassName} />
              </FormField>

              <FormField label="Customer *" error={values.useNewCustomer ? errors.newCustomerName : errors.customerId}>
                <div className="space-y-2">
                  {!values.useNewCustomer ? (
                    <>
                      <select
                        value={values.customerId}
                        onChange={(e) => onChange("customerId", e.target.value)}
                        className={inputClassName}
                      >
                        <option value="">Select customer</option>
                        {customerOptions.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          onChange("useNewCustomer", true);
                          onChange("customerId", "");
                        }}
                        className="text-sm font-medium text-brand-primary transition hover:text-brand-hover"
                      >
                        + Add new customer
                      </button>
                    </>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="md:col-span-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-text-secondary">New customer</span>
                        <button
                          type="button"
                          onClick={() => {
                            onChange("useNewCustomer", false);
                            onChange("newCustomerName", "");
                            onChange("newCustomerEmail", "");
                          }}
                          className="text-sm font-medium text-text-tertiary transition hover:text-text-primary"
                        >
                          Cancel
                        </button>
                      </div>
                      <input placeholder="New customer name" value={values.newCustomerName} onChange={(e) => onChange("newCustomerName", e.target.value)} className={inputClassName} />
                      <input placeholder="Customer email" value={values.newCustomerEmail} onChange={(e) => onChange("newCustomerEmail", e.target.value)} className={inputClassName} />
                    </div>
                  )}
                </div>
              </FormField>

              <FormField label="Contract Price *" error={errors.contractPrice}>
                <input type="number" min="0" step="0.01" value={values.contractPrice} onChange={(e) => onChange("contractPrice", e.target.value)} className={inputClassName} />
              </FormField>

              <FormField label="Customer POC">
                <select
                  value={values.customerPoc}
                  onChange={(e) => onChange("customerPoc", e.target.value)}
                  className={inputClassName}
                >
                  <option value="">Select customer contact</option>
                  {customerPocOptions.map((contact) => {
                    const label = formatContactLabel(contact);
                    return (
                      <option key={contact.id} value={label}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </FormField>

              <FormField label="Customer PO Number">
                <input value={values.customerPoNumber} onChange={(e) => onChange("customerPoNumber", e.target.value)} className={inputClassName} />
              </FormField>
              <FormField label="Site Address">
                <input value={values.siteAddress} onChange={(e) => onChange("siteAddress", e.target.value)} className={inputClassName} />
              </FormField>
              <FormField label="General Contractor">
                <input value={values.generalContractor} onChange={(e) => onChange("generalContractor", e.target.value)} className={inputClassName} />
              </FormField>
              <FormField label="Mechanical Contractor">
                <input value={values.mechanicalContractor} onChange={(e) => onChange("mechanicalContractor", e.target.value)} className={inputClassName} />
              </FormField>
              <FormField label="Electrical Contractor">
                <input value={values.electricalContractor} onChange={(e) => onChange("electricalContractor", e.target.value)} className={inputClassName} />
              </FormField>
            </div>

            <FormField label="Notes">
              <textarea rows={3} value={values.notes} onChange={(e) => onChange("notes", e.target.value)} className={textareaClassName} />
            </FormField>
            <FormField label="Estimator Reference ID">
              <div className="space-y-1.5">
                <input
                  value={values.sourceEstimateId}
                  onChange={(e) => onChange("sourceEstimateId", e.target.value)}
                  className={inputClassName}
                />
                <p className="text-xs text-text-tertiary">
                  Paste the estimate ID from estimates.thecontrolscompany.com - used to link POC categories to the original estimate.
                </p>
              </div>
            </FormField>
            <FormField label="Special Requirements">
              <textarea rows={3} value={values.specialRequirements} onChange={(e) => onChange("specialRequirements", e.target.value)} className={textareaClassName} />
            </FormField>
            <FormField label="Special Access">
              <input value={values.specialAccess} onChange={(e) => onChange("specialAccess", e.target.value)} className={inputClassName} />
            </FormField>
          </section>

          {editingProject && (
            <CustomerContactsSection projectId={editingProject.id} />
          )}

          <section className="space-y-4">
            <div>
              <h4 className="font-heading text-lg font-semibold text-text-primary">Team</h4>
              <p className="mt-1 text-sm text-text-secondary">
                Assign PMs, leads, installers, and ops managers to this project.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-border-default bg-surface-raised p-4">
              {assignments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border-default px-4 py-5 text-sm text-text-secondary">
                  No team members assigned yet.
                </div>
              ) : (
                assignments.map((assignment) => {
                  const option = teamMemberOptions.find((item) => item.id === assignment.personId);
                  const label = option?.displayLabel ?? "Unknown team member";
                  const initials = label
                    .replace(/\(.*$/, "")
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((segment) => segment[0]?.toUpperCase() ?? "")
                    .join("") || "?";

                  return (
                    <div key={`${assignment.personId}:${assignment.roleOnProject}`} className="flex items-center justify-between gap-3 rounded-xl border border-border-default bg-surface-base px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-sm font-semibold text-brand-primary">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary">{label}</p>
                          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_STYLES[assignment.roleOnProject]}`}>
                            {ROLE_LABELS[assignment.roleOnProject]}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveAssignment(assignment.personId, assignment.roleOnProject)}
                        className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-raised hover:text-text-primary"
                      >
                        x
                      </button>
                    </div>
                  );
                })
              )}

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),180px,120px]">
                <select
                  value={pendingTeamMemberId}
                  onChange={(e) => onPendingTeamMemberChange(e.target.value)}
                  className={inputClassName}
                >
                  <option value="">Select team member</option>
                  {teamMemberOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.displayLabel}
                    </option>
                  ))}
                </select>
                <select
                  value={pendingRoleOnProject}
                  onChange={(e) => onPendingRoleChange(e.target.value as ProjectAssignmentRole)}
                  className={inputClassName}
                >
                  <option value="pm">pm</option>
                  <option value="lead">lead</option>
                  <option value="installer">installer</option>
                  <option value="ops_manager">ops_manager</option>
                </select>
                <button
                  type="button"
                  onClick={onAddAssignment}
                  className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover"
                >
                  Add
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="font-heading text-lg font-semibold text-text-primary">Compliance</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <CheckboxField label="All Conduit" checked={values.allConduitPlenum} onChange={(checked) => onChange("allConduitPlenum", checked)} />
              <CheckboxField label="Certified Payroll" checked={values.certifiedPayroll} onChange={(checked) => onChange("certifiedPayroll", checked)} />
              <CheckboxField label="Buy American" checked={values.buyAmerican} onChange={(checked) => onChange("buyAmerican", checked)} />
              <CheckboxField label="Bond Required" checked={values.bondRequired} onChange={(checked) => onChange("bondRequired", checked)} />
            </div>
          </section>

          {editingProject && (
            <section className="space-y-4">
              <h4 className="font-heading text-lg font-semibold text-text-primary">Completion Status</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <CheckboxField label="Billed in Full" checked={values.billedInFull} onChange={(checked) => onChange("billedInFull", checked)} />
                <CheckboxField label="Paid in Full" checked={values.paidInFull} onChange={(checked) => onChange("paidInFull", checked)} />
              </div>
            </section>
          )}

          {editingProject && (
            <ProjectDocumentUploads
              project={editingProject}
              isNewProjectFlow={isNewProjectFlow}
              isWaitingForSharePointFolder={isWaitingForSharePointFolder}
            />
          )}

          {editingProject && (
            <PocSetupSection projectId={editingProject.id} />
          )}

          {editingProject && (
            <WeeklyUpdatesSection projectId={editingProject.id} />
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border-default px-6 py-4">
          <button onClick={onClose} className="rounded-xl bg-surface-overlay px-4 py-2 text-sm text-text-secondary hover:bg-surface-overlay">Cancel</button>
          <button onClick={onSave} disabled={saving} className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-brand-hover disabled:opacity-50">
            {saving ? "Saving..." : editingProject ? "Save Changes" : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectDocumentUploads({
  project,
  isNewProjectFlow,
  isWaitingForSharePointFolder,
}: {
  project: ProjectModalProject;
  isNewProjectFlow: boolean;
  isWaitingForSharePointFolder: boolean;
}) {
  const [selectedFiles, setSelectedFiles] = useState<Record<DocumentType, File | null>>({
    contract: null,
    scope: null,
    estimate: null,
  });
  const [statuses, setStatuses] = useState<Record<DocumentType, UploadStatus>>({
    contract: { state: "idle", message: "No file selected" },
    scope: { state: "idle", message: "No file selected" },
    estimate: { state: "idle", message: "No file selected" },
  });

  useEffect(() => {
    setSelectedFiles({
      contract: null,
      scope: null,
      estimate: null,
    });
    setStatuses({
      contract: { state: "idle", message: "No file selected" },
      scope: { state: "idle", message: "No file selected" },
      estimate: { state: "idle", message: "No file selected" },
    });
  }, [project.id]);

  async function handleUpload(documentType: DocumentType) {
    const file = selectedFiles[documentType];

    if (!file) {
      setStatuses((current) => ({
        ...current,
        [documentType]: { state: "error", message: "Choose a file before uploading." },
      }));
      return;
    }

    setStatuses((current) => ({
      ...current,
      [documentType]: { state: "uploading", message: `Uploading ${file.name}...` },
    }));

    try {
      const formData = new FormData();
      formData.append("projectId", project.id);
      formData.append("documentType", documentType);
      formData.append("file", file);

      const res = await fetch("/api/admin/upload-project-document", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Upload failed.");
      }

      setStatuses((current) => ({
        ...current,
        [documentType]: {
          state: "success",
          message: `Uploaded: ${file.name}`,
          webUrl: typeof json?.webUrl === "string" ? json.webUrl : null,
        },
      }));
      setSelectedFiles((current) => ({ ...current, [documentType]: null }));
    } catch (error) {
      setStatuses((current) => ({
        ...current,
        [documentType]: {
          state: "error",
          message: error instanceof Error ? error.message : "Upload failed.",
        },
      }));
    }
  }

  const uploadsEnabled = Boolean(project.sharepoint_folder);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h4 className="font-heading text-lg font-semibold text-text-primary">Uploads</h4>
        <p className="text-sm text-text-secondary">
          Upload contract, scope, or estimate files directly into the project SharePoint folder.
        </p>
        {isNewProjectFlow && (
          <p className="text-sm text-text-tertiary">
            SharePoint folder is being provisioned - uploads available shortly after saving.
          </p>
        )}
        {!uploadsEnabled && !isNewProjectFlow && (
          <p className="text-sm text-status-warning">
            SharePoint folder not yet provisioned for this project.
          </p>
        )}
        {isWaitingForSharePointFolder && (
          <p className="text-sm text-brand-primary">Checking SharePoint folder availability...</p>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-border-default bg-surface-raised p-4">
        {DOCUMENT_OPTIONS.map((document) => {
          const selectedFile = selectedFiles[document.type];
          const status = statuses[document.type];

          return (
            <div key={document.type} className="grid gap-3 rounded-xl border border-border-default bg-surface-base px-4 py-3 md:grid-cols-[140px,1fr,120px,1fr] md:items-center">
              <div className="text-sm font-medium text-text-primary">{document.label}</div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-secondary transition hover:bg-surface-base hover:text-text-primary">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setSelectedFiles((current) => ({ ...current, [document.type]: file }));
                      setStatuses((current) => ({
                        ...current,
                        [document.type]: {
                          state: "idle",
                          message: file ? `Ready: ${file.name}` : "No file selected",
                        },
                      }));
                    }}
                  />
                  Choose File
                </label>
                <span className="text-xs text-text-tertiary">
                  {selectedFile?.name ?? "PDF, DOCX, XLSX, or other file"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void handleUpload(document.type)}
                disabled={!uploadsEnabled || !selectedFile || status.state === "uploading"}
                className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status.state === "uploading" ? "Uploading..." : "Upload"}
              </button>

              <div
                className={[
                  "text-sm",
                  status.state === "error"
                    ? "text-status-danger"
                    : status.state === "success"
                      ? "text-status-success"
                      : status.state === "uploading"
                        ? "text-brand-primary"
                        : "text-text-secondary",
                ].join(" ")}
              >
                {status.webUrl && status.state === "success" ? (
                  <a href={status.webUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2">
                    {status.message}
                  </a>
                ) : (
                  status.message
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatContactLabel(contact: ProjectContactOption) {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
  return fullName ? `${fullName} (${contact.email})` : contact.email;
}

function FormField({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-text-secondary">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-status-danger">{error}</span>}
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-primary">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand-primary)]" />
      {label}
    </label>
  );
}

type UpdateRow = {
  id: string;
  week_of: string;
  pct_complete: number | null;
  notes: string | null;
  blockers: string | null;
};

function CustomerContactsSection({ projectId }: { projectId: string }) {
  const supabase = createClient();
  const [contacts, setContacts] = useState<(ProjectCustomerContact & { profile: Profile })[]>([]);
  const [allCustomers, setAllCustomers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/admin/data?section=project-customer-contacts&projectId=${encodeURIComponent(projectId)}`, {
          credentials: "include",
        });
        const json = await response.json();
        setContacts((((response.ok ? json?.contacts : []) ?? []) as (ProjectCustomerContact & { profile: Profile })[]));
        setAllCustomers((((response.ok ? json?.profiles : []) ?? []) as Profile[]));
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const existingIds = new Set(contacts.map((c) => c.profile_id));
  const availableToAdd = allCustomers.filter((p) => !existingIds.has(p.id));

  async function handleAdd() {
    if (!selectedProfileId) return;
    setAdding(true);
    setAddError(null);
    const { data, error } = await supabase
      .from("project_customer_contacts")
      .insert({ project_id: projectId, profile_id: selectedProfileId, portal_access: false, email_digest: false })
      .select("*, profile:profiles(*)")
      .single();
    if (error) {
      setAddError(error.message);
    } else if (data) {
      setContacts((prev) => [...prev, data as ProjectCustomerContact & { profile: Profile }]);
      setSelectedProfileId("");
    }
    setAdding(false);
  }

  async function handleToggle(id: string, field: "portal_access" | "email_digest", value: boolean) {
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));
    await supabase.from("project_customer_contacts").update({ [field]: value }).eq("id", id);
  }

  async function handleRemove(id: string) {
    await supabase.from("project_customer_contacts").delete().eq("id", id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <section className="space-y-3">
      <h4 className="font-heading text-lg font-semibold text-text-primary">Customer Portal Access</h4>
      <p className="text-xs text-text-secondary">
        Add customer accounts and set whether they can view this project in the portal and/or receive email digests.
      </p>

      {loading ? (
        <p className="text-sm text-text-tertiary">Loading...</p>
      ) : (
        <div className="space-y-2">
          {contacts.length === 0 && (
            <p className="text-sm text-text-tertiary">No customer contacts added yet.</p>
          )}
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-raised px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{c.profile?.full_name || c.profile?.email}</p>
                <p className="truncate text-xs text-text-tertiary">{c.profile?.email}</p>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={c.portal_access}
                  onChange={(e) => void handleToggle(c.id, "portal_access", e.target.checked)}
                  className="h-4 w-4 rounded accent-brand-primary"
                />
                <span className="text-xs text-text-secondary">Portal</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={c.email_digest}
                  onChange={(e) => void handleToggle(c.id, "email_digest", e.target.checked)}
                  className="h-4 w-4 rounded accent-brand-primary"
                />
                <span className="text-xs text-text-secondary">Email</span>
              </label>
              <button onClick={() => void handleRemove(c.id)} className="text-xs text-status-danger hover:underline shrink-0">
                Remove
              </button>
            </div>
          ))}

          {availableToAdd.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="flex-1 rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
              >
                <option value="">Select a customer account...</option>
                {availableToAdd.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name ? `${p.full_name} (${p.email})` : p.email}
                  </option>
                ))}
              </select>
              <button
                onClick={() => void handleAdd()}
                disabled={adding || !selectedProfileId}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-brand-hover disabled:opacity-50"
              >
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
          )}

          {addError && (
            <p className="text-xs text-status-danger">{addError}</p>
          )}

          {availableToAdd.length === 0 && allCustomers.length === 0 && (
            <p className="text-xs text-text-tertiary">No customer accounts exist yet. Create one at Admin → User Management.</p>
          )}
        </div>
      )}
    </section>
  );
}

function PocSetupSection({ projectId }: { projectId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<PocLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState("");
  const [newWeight, setNewWeight] = useState("10");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/data?section=project-poc-items&projectId=${encodeURIComponent(projectId)}`, {
      credentials: "include",
    })
      .then((response) => response.json().then((json) => ({ ok: response.ok, json })))
      .then(({ ok, json }) => {
        setItems((((ok ? json?.items : []) ?? []) as PocLineItem[]));
        setLoading(false);
      })
      .catch(() => {
        setItems([]);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  async function persistSortOrder(nextItems: PocLineItem[]) {
    await Promise.all(
      nextItems.map((item, index) =>
        supabase.from("poc_line_items").update({ sort_order: index }).eq("id", item.id)
      )
    );
  }

  async function handleAdd() {
    if (!newCategory.trim() || !newWeight) return;
    setAdding(true);
    const { data, error } = await supabase
      .from("poc_line_items")
      .insert({
        project_id: projectId,
        category: newCategory.trim(),
        weight: Number(newWeight),
        pct_complete: 0,
        sort_order: items.length,
      })
      .select()
      .single();
    if (!error && data) {
      setItems((prev) => [...prev, data as PocLineItem]);
      setNewCategory("");
      setNewWeight("10");
    }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("poc_line_items").delete().eq("id", id);
    const nextItems = items.filter((item) => item.id !== id).map((item, index) => ({ ...item, sort_order: index }));
    setItems(nextItems);
    await persistSortOrder(nextItems);
  }

  async function handleWeightChange(id: string, weight: number) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, weight } : item)));
    setSaving(id);
    await supabase.from("poc_line_items").update({ weight }).eq("id", id);
    setSaving(null);
  }

  async function moveItem(id: string, direction: -1 | 1) {
    const currentIndex = items.findIndex((item) => item.id === id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= items.length) return;

    const reordered = [...items];
    const [movedItem] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, movedItem);
    const nextItems = reordered.map((item, index) => ({ ...item, sort_order: index }));
    setItems(nextItems);
    setSaving(id);
    await persistSortOrder(nextItems);
    setSaving(null);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-heading text-lg font-semibold text-text-primary">POC Line Items</h4>
        {totalWeight > 0 && <span className="text-xs text-text-tertiary">Total weight: {totalWeight}</span>}
      </div>
      <p className="text-xs text-text-secondary">
        Define the categories and relative weights for the % complete calculation. PMs update each category&apos;s completion in their weekly report.
      </p>

      {loading ? (
        <p className="text-sm text-text-tertiary">Loading...</p>
      ) : (
        <div className="space-y-2">
          {items.length === 0 && (
            <p className="text-sm text-text-tertiary">No POC line items yet. Add categories below.</p>
          )}
          {items.map((item, index) => {
            const currentPercent = item.pct_complete * 100;
            const percentOfTotal = totalWeight > 0 ? (item.weight / totalWeight) * 100 : 0;
            const contribution = totalWeight > 0 ? (item.weight * item.pct_complete) / totalWeight * 100 : 0;
            const badgeClass =
              currentPercent > 50
                ? "bg-status-success/10 text-status-success"
                : currentPercent >= 20
                  ? "bg-status-warning/10 text-status-warning"
                  : "bg-surface-overlay text-text-secondary";

            return (
              <div key={item.id} className="rounded-xl border border-border-default bg-surface-raised px-4 py-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{item.category}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
                        {currentPercent.toFixed(0)}%
                      </span>
                      <span className="text-xs text-text-tertiary">{percentOfTotal.toFixed(0)}% of total weight</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs text-text-tertiary">
                        <span>Weighted contribution</span>
                        <span>{contribution.toFixed(1)} points</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-overlay">
                        <div
                          className="h-full rounded-full bg-brand-primary/60 transition-all"
                          style={{ width: `${Math.min(contribution, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void moveItem(item.id, -1)}
                        disabled={index === 0}
                        className="rounded-lg border border-border-default bg-surface-overlay px-2 py-1 text-xs text-text-secondary transition hover:bg-surface-base hover:text-text-primary disabled:opacity-40"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => void moveItem(item.id, 1)}
                        disabled={index === items.length - 1}
                        className="rounded-lg border border-border-default bg-surface-overlay px-2 py-1 text-xs text-text-secondary transition hover:bg-surface-base hover:text-text-primary disabled:opacity-40"
                      >
                        Down
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-text-tertiary">weight</span>
                      <input
                        type="number"
                        min={1}
                        value={item.weight}
                        onChange={(e) => handleWeightChange(item.id, Number(e.target.value))}
                        className="w-16 rounded-lg border border-border-default bg-surface-overlay px-2 py-1 text-center text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
                      />
                    </div>
                    {saving === item.id && <span className="text-xs text-text-tertiary">saving...</span>}
                    <button onClick={() => handleDelete(item.id)} className="text-xs text-status-danger hover:underline">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
              placeholder="Category name (e.g. AHU's)"
              className="flex-1 rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary/50 focus:outline-none"
            />
            <input
              type="number"
              min={1}
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="Weight"
              className="w-20 rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-center text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
            />
            <button
              onClick={() => void handleAdd()}
              disabled={adding || !newCategory.trim()}
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-brand-hover disabled:opacity-50"
            >
              {adding ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function WeeklyUpdatesSection({ projectId }: { projectId: string }) {
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadUpdates() {
      setLoading(true);

      try {
        const res = await fetch(`/api/admin/data?section=project-weekly-updates&projectId=${encodeURIComponent(projectId)}`, {
          credentials: "include",
        });
        const json = await res.json();

        if (!active) return;

        if (!res.ok) {
          setUpdates([]);
        } else {
          setUpdates((json?.updates as UpdateRow[]) ?? []);
        }
      } catch {
        if (active) {
          setUpdates([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadUpdates();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <section className="space-y-3">
      <h4 className="font-heading text-lg font-semibold text-text-primary">Weekly Updates</h4>
      {loading ? (
        <p className="text-sm text-text-tertiary">Loading...</p>
      ) : updates.length === 0 ? (
        <p className="text-sm text-text-tertiary">No updates submitted yet.</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {updates.map((u) => (
            <div key={u.id} className="rounded-xl border border-border-default bg-surface-raised p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-text-secondary">
                    Week of {format(new Date(u.week_of), "MMM d, yyyy")}
                  </span>
                  <ViewReportLink updateId={u.id} />
                </div>
                {u.pct_complete !== null && (
                  <span className="shrink-0 text-sm font-semibold text-brand-primary">
                    {(u.pct_complete * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              {u.notes && <p className="mt-1.5 text-sm text-text-secondary">{u.notes}</p>}
              {u.blockers && (
                <p className="mt-1 text-sm text-status-danger">Blocker: {u.blockers}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
