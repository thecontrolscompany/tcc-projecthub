"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BomTab } from "@/components/bom-tab";
import type { ProjectAssignmentRole } from "@/types/database";
import { ROLE_LABELS, ROLE_BADGE_STYLES } from "@/lib/project/roles";
import { WeeklyReportImportDialog } from "@/components/project-modal/weekly-report-import-dialog";
import { CustomerContactsSection } from "@/components/project-modal/customer-contacts-section";
import { ChangeOrdersSection } from "@/components/project-modal/change-orders-section";
import { EstimatorAndPocSection } from "@/components/project-modal/poc-setup-section";
import { WeeklyUpdatesSection } from "@/components/project-modal/weekly-updates-section";

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
  startDate: string;
  scheduledCompletion: string;
  generalContractor: string;
  mechanicalContractor: string;
  electricalContractor: string;
  notes: string;
  scopeDescription: string;
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
  startDate: "",
  scheduledCompletion: "",
  generalContractor: "",
  mechanicalContractor: "",
  electricalContractor: "",
  notes: "",
  scopeDescription: "",
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

const textareaClassName = inputClassName;

const dropdownClassName =
  "absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 max-h-60 overflow-auto rounded-xl border border-border-default bg-surface-raised shadow-lg";

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


export function ProjectModal({
  editingProject,
  jobNumberPreview,
  customers,
  teamMemberOptions,
  externalContacts,
  assignments,
  pendingTeamMemberId,
  pendingRoleOnProject,
  primaryPersonId,
  values,
  saving,
  errors,
  saveError,
  isNewProjectFlow,
  isWaitingForSharePointFolder,
  siteAddresses,
  contractorNames,
  onClose,
  onChange,
  onPendingTeamMemberChange,
  onPendingRoleChange,
  onSetPrimary,
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
  primaryPersonId: string | null;
  values: ProjectFormValues;
  saving: boolean;
  errors: ProjectFormErrors;
  saveError?: string | null;
  isNewProjectFlow: boolean;
  isWaitingForSharePointFolder: boolean;
  siteAddresses?: string[];
  contractorNames?: string[];
  onClose: () => void;
  onChange: <K extends keyof ProjectFormValues>(field: K, value: ProjectFormValues[K]) => void;
  onPendingTeamMemberChange: (value: string) => void;
  onPendingRoleChange: (value: ProjectAssignmentRole) => void;
  onSetPrimary: (personId: string) => void;
  onAddAssignment: () => void;
  onRemoveAssignment: (personId: string, roleOnProject: ProjectAssignmentRole) => void;
  onSave: () => void;
}) {
  const customerOptions = useMemo(() => customers, [customers]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "weekly-updates" | "change-orders" | "materials">("overview");
  const [formTab, setFormTab] = useState<"details" | "team" | "compliance" | "history">("details");

  // Track unsaved changes
  const initialValuesRef = useRef<string>("");
  useEffect(() => {
    initialValuesRef.current = JSON.stringify(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingProject?.id]);
  const isDirty = useMemo(() => JSON.stringify(values) !== initialValuesRef.current, [values]);
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
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-border-default bg-surface-base shadow-xl">
        <div className="flex shrink-0 items-start justify-between border-b border-border-default px-6 py-4">
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

        {editingProject && (
          <div className="shrink-0 border-b border-border-default px-6 py-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "overview", label: "Overview" },
                  { id: "weekly-updates", label: "Weekly Updates" },
                  { id: "change-orders", label: "Change Orders" },
                  { id: "materials", label: "Materials" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "rounded-lg px-4 py-2 text-sm font-medium transition",
                    activeTab === tab.id
                      ? "bg-surface-overlay text-text-primary shadow-sm"
                      : "text-text-secondary hover:bg-surface-overlay/70 hover:text-text-primary",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form sub-tabs — Overview only, editing only */}
        {editingProject && activeTab === "overview" && (
          <div className="shrink-0 border-b border-border-default bg-surface-raised/50 px-6 py-2">
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: "details", label: "Details" },
                  { id: "team", label: "Team" },
                  { id: "compliance", label: "Compliance" },
                  { id: "history", label: "Docs & History" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFormTab(tab.id)}
                  className={[
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                    formTab === tab.id
                      ? "bg-brand-primary text-text-inverse"
                      : "text-text-secondary hover:bg-surface-overlay hover:text-text-primary",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
        {(!editingProject || activeTab === "overview") && (
        <div className="space-y-6 px-6 py-6">
          {(errors.form || saveError) && (
            <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
              {errors.form ?? saveError}
            </div>
          )}

          {(!editingProject || formTab === "details") && (
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
                <CurrencyInput value={values.contractPrice} onChange={(v) => onChange("contractPrice", v)} className={inputClassName} />
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
                <SiteAddressInput
                  value={values.siteAddress}
                  onChange={(v) => onChange("siteAddress", v)}
                  className={inputClassName}
                />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Start Date
                  </label>
                  <input
                    type="date"
                    className={inputClassName}
                    value={values.startDate}
                    onChange={(e) => onChange("startDate", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Scheduled Completion
                  </label>
                  <input
                    type="date"
                    className={inputClassName}
                    value={values.scheduledCompletion}
                    onChange={(e) => onChange("scheduledCompletion", e.target.value)}
                  />
                </div>
              </div>
              <FormField label="General Contractor">
                <ComboboxInput
                  value={values.generalContractor}
                  onChange={(v) => onChange("generalContractor", v)}
                  suggestions={contractorNames ?? []}
                  className={inputClassName}
                />
              </FormField>
              <FormField label="Mechanical Contractor">
                <ComboboxInput
                  value={values.mechanicalContractor}
                  onChange={(v) => onChange("mechanicalContractor", v)}
                  suggestions={contractorNames ?? []}
                  className={inputClassName}
                />
              </FormField>
              <FormField label="Electrical Contractor">
                <ComboboxInput
                  value={values.electricalContractor}
                  onChange={(v) => onChange("electricalContractor", v)}
                  suggestions={contractorNames ?? []}
                  className={inputClassName}
                />
              </FormField>
            </div>

            <FormField label="Notes">
              <textarea rows={3} value={values.notes} onChange={(e) => onChange("notes", e.target.value)} className={textareaClassName} />
            </FormField>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Scope Description
                <span className="ml-1 normal-case font-normal text-text-tertiary">(visible to customer)</span>
              </label>
              <textarea
                rows={3}
                className={textareaClassName}
                placeholder="Brief description of work scope visible on customer portal"
                value={values.scopeDescription}
                onChange={(e) => onChange("scopeDescription", e.target.value)}
              />
            </div>
            <FormField label="Special Requirements">
              <textarea rows={3} value={values.specialRequirements} onChange={(e) => onChange("specialRequirements", e.target.value)} className={textareaClassName} />
            </FormField>
            <FormField label="Special Access">
              <input value={values.specialAccess} onChange={(e) => onChange("specialAccess", e.target.value)} className={inputClassName} />
            </FormField>
          </section>
          )}

          {(!editingProject || formTab === "team") && editingProject && (
            <CustomerContactsSection projectId={editingProject.id} />
          )}

          {(!editingProject || formTab === "team") && (
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
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-text-primary">{label}</p>
                            {assignment.roleOnProject === "pm" && assignment.personId === primaryPersonId && (
                              <span className="inline-flex rounded-full bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning">
                                ★ Primary
                              </span>
                            )}
                            {assignment.roleOnProject === "pm" && assignment.personId !== primaryPersonId && (
                              <button
                                type="button"
                                onClick={() => onSetPrimary(assignment.personId)}
                                className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning transition hover:bg-status-warning/20"
                              >
                                Set Primary
                              </button>
                            )}
                          </div>
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
          )}

          {(!editingProject || formTab === "compliance") && (
          <section className="space-y-4">
            <h4 className="font-heading text-lg font-semibold text-text-primary">Compliance</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <CheckboxField label="All Conduit" checked={values.allConduitPlenum} onChange={(checked) => onChange("allConduitPlenum", checked)} />
              <CheckboxField label="Certified Payroll" checked={values.certifiedPayroll} onChange={(checked) => onChange("certifiedPayroll", checked)} />
              <CheckboxField label="Buy American" checked={values.buyAmerican} onChange={(checked) => onChange("buyAmerican", checked)} />
              <CheckboxField label="Bond Required" checked={values.bondRequired} onChange={(checked) => onChange("bondRequired", checked)} />
            </div>
          </section>
          )}

          {formTab === "compliance" && editingProject && (
            <section className="space-y-4">
              <h4 className="font-heading text-lg font-semibold text-text-primary">Completion Status</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <CheckboxField label="Billed in Full" checked={values.billedInFull} onChange={(checked) => onChange("billedInFull", checked)} />
                <CheckboxField label="Paid in Full" checked={values.paidInFull} onChange={(checked) => onChange("paidInFull", checked)} />
              </div>
            </section>
          )}

          {formTab === "history" && editingProject && (
            <ProjectDocumentUploads
              project={editingProject}
              isNewProjectFlow={isNewProjectFlow}
              isWaitingForSharePointFolder={isWaitingForSharePointFolder}
            />
          )}

          {formTab === "history" && editingProject && (
            <EstimatorAndPocSection
              projectId={editingProject.id}
              sourceEstimateId={values.sourceEstimateId}
              onSourceEstimateIdChange={(v) => onChange("sourceEstimateId", v)}
            />
          )}

        </div>
        )}

        {editingProject && activeTab === "weekly-updates" && (
          <div className="px-6 py-6">
            <WeeklyUpdatesSection projectId={editingProject.id} />
          </div>
        )}

        {editingProject && activeTab === "change-orders" && (
          <div className="px-6 py-6">
            <ChangeOrdersSection projectId={editingProject.id} />
          </div>
        )}

        {editingProject && activeTab === "materials" && (
          <div className="px-6 py-6">
            <BomTab projectId={editingProject.id} />
          </div>
        )}
        </div>{/* end scrollable content */}

        {(!editingProject || activeTab === "overview") && (
        <div className={["shrink-0 flex items-center justify-end gap-3 border-t px-6 py-4 transition-colors", isDirty ? "border-brand-primary/40 bg-brand-primary/5" : "border-border-default"].join(" ")}>
          <div className="flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {editingProject && (
                <button
                  type="button"
                  onClick={() => setShowImportDialog(true)}
                  className="text-sm text-text-secondary underline hover:text-text-primary"
                >
                  Import Weekly Reports from Excel…
                </button>
              )}
              {isDirty && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                  Unsaved changes
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="rounded-xl bg-surface-overlay px-4 py-2 text-sm text-text-secondary hover:bg-surface-overlay">Cancel</button>
              <button
                onClick={onSave}
                disabled={saving}
                className={["rounded-xl px-4 py-2 text-sm font-semibold text-text-inverse transition disabled:opacity-50", isDirty ? "bg-brand-primary ring-2 ring-brand-primary/40 hover:bg-brand-hover" : "bg-brand-primary hover:bg-brand-hover"].join(" ")}
              >
                {saving ? "Saving..." : editingProject ? "Save Changes" : "Create Project"}
              </button>
            </div>
          </div>
        </div>
        )}
      </div>

      {showImportDialog && editingProject && (
        <WeeklyReportImportDialog
          projectId={editingProject.id}
          onClose={() => setShowImportDialog(false)}
        />
      )}
    </div>
  );
}

function ComboboxInput({
  value,
  onChange,
  suggestions,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filteredSuggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    const uniqueSuggestions = Array.from(new Set(suggestions.filter(Boolean)));
    if (!query) return uniqueSuggestions;
    return uniqueSuggestions.filter((suggestion) => suggestion.toLowerCase().includes(query));
  }, [suggestions, value]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [value, open]);

  function selectSuggestion(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            setOpen(true);
            return;
          }

          if (!filteredSuggestions.length) {
            if (event.key === "Escape") setOpen(false);
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightedIndex((current) => (current + 1) % filteredSuggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((current) => (current - 1 + filteredSuggestions.length) % filteredSuggestions.length);
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            selectSuggestion(filteredSuggestions[highlightedIndex] ?? filteredSuggestions[0]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
        className={className}
        autoComplete="off"
      />

      {open && filteredSuggestions.length > 0 && (
        <div className={dropdownClassName}>
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                selectSuggestion(suggestion);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={[
                "block w-full px-3 py-2 text-left text-sm text-text-primary",
                index === highlightedIndex ? "bg-surface-overlay" : "hover:bg-surface-overlay",
              ].join(" ")}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SiteAddressInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [results, setResults] = useState<string[]>([]);

  useEffect(() => {
    if (!open || value.trim().length < 4) {
      setLoading(false);
      setResults([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setLoading(true);

      try {
        const response = await fetch(`/api/address-search?q=${encodeURIComponent(value.trim())}`);
        const json = await response.json();
        setResults((response.ok ? (json?.results as string[] | undefined) : []) ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [open, value]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [value, results.length, open]);

  function selectAddress(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            setOpen(true);
            return;
          }

          if (!results.length) {
            if (event.key === "Escape") setOpen(false);
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightedIndex((current) => (current + 1) % results.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((current) => (current - 1 + results.length) % results.length);
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            selectAddress(results[highlightedIndex] ?? results[0]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
        className={className}
        autoComplete="off"
      />

      {open && (loading || results.length > 0) && (
        <div className={dropdownClassName}>
          {loading ? (
            <div className="px-3 py-2 text-sm text-text-secondary">Searching…</div>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result}-${index}`}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectAddress(result);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={[
                  "block w-full px-3 py-2 text-left text-sm text-text-primary",
                  index === highlightedIndex ? "bg-surface-overlay" : "hover:bg-surface-overlay",
                ].join(" ")}
              >
                {result}
              </button>
            ))
          )}
        </div>
      )}
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


function CurrencyInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) {
  const [focused, setFocused] = useState(false);
  const displayValue = focused
    ? value
    : value
      ? `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : "";

  return (
    <input
      type="text"
      value={displayValue}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, "");
        onChange(raw);
      }}
      className={className}
      placeholder="$0"
    />
  );
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

