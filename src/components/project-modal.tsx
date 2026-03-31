"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectAssignmentRole } from "@/types/database";

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
                  <select
                    value={values.useNewCustomer ? "__new__" : values.customerId}
                    onChange={(e) => {
                      const useNewCustomer = e.target.value === "__new__";
                      onChange("useNewCustomer", useNewCustomer);
                      onChange("customerId", useNewCustomer ? "" : e.target.value);
                    }}
                    className={inputClassName}
                  >
                    <option value="">Select customer</option>
                    {customerOptions.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                    <option value="__new__">Add new customer</option>
                  </select>
                  {values.useNewCustomer && (
                    <div className="grid gap-2 md:grid-cols-2">
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
            <FormField label="Special Requirements">
              <textarea rows={3} value={values.specialRequirements} onChange={(e) => onChange("specialRequirements", e.target.value)} className={textareaClassName} />
            </FormField>
            <FormField label="Special Access">
              <input value={values.specialAccess} onChange={(e) => onChange("specialAccess", e.target.value)} className={inputClassName} />
            </FormField>
          </section>

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
