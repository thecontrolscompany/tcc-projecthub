"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { ViewReportLink } from "@/components/view-report-link";
import { WipTab } from "@/components/wip-tab";
import { BomTab } from "@/components/bom-tab";
import type { ParsedPocImportRow } from "@/lib/poc/import";
import type { ChangeOrder, ChangeOrderStatus, PocLineItem, Profile, ProjectAssignmentRole, ProjectCustomerContact } from "@/types/database";

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

const dropdownClassName =
  "absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 max-h-60 overflow-auto rounded-xl border border-border-default bg-surface-raised shadow-lg";

type DocumentType = "contract" | "scope" | "estimate";
type UploadState = "idle" | "uploading" | "success" | "error";

type UploadStatus = {
  state: UploadState;
  message: string;
  webUrl?: string | null;
};

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

type ParsedPocSheet = {
  filename: string;
  worksheetName: string;
  rows: ParsedPocImportRow[];
  totalWeight: number;
  overallPct: number;
  existingCount: number;
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
  const [activeTab, setActiveTab] = useState<"overview" | "wip" | "materials">("overview");
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

        {editingProject && (
          <div className="border-b border-border-default px-6 py-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "overview", label: "Overview" },
                  { id: "wip", label: "WIP" },
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

        {(!editingProject || activeTab === "overview") && (
        <div className="space-y-6 px-6 py-6">
          {(errors.form || saveError) && (
            <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
              {errors.form ?? saveError}
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

          {editingProject && (
            <ChangeOrdersSection projectId={editingProject.id} />
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
            <EstimatorAndPocSection
              projectId={editingProject.id}
              sourceEstimateId={values.sourceEstimateId}
              onSourceEstimateIdChange={(v) => onChange("sourceEstimateId", v)}
            />
          )}

          {editingProject && (
            <WeeklyUpdatesSection projectId={editingProject.id} />
          )}
        </div>
        )}

        {editingProject && activeTab === "wip" && (
          <div className="px-6 py-6">
            <WipTab projectId={editingProject.id} />
          </div>
        )}

        {editingProject && activeTab === "materials" && (
          <div className="px-6 py-6">
            <BomTab projectId={editingProject.id} />
          </div>
        )}

        {(!editingProject || activeTab === "overview") && (
        <div className="flex items-center justify-end gap-3 border-t border-border-default px-6 py-4">
          <div className="flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {editingProject && (
                <button
                  type="button"
                  onClick={() => setShowImportDialog(true)}
                  className="text-sm text-text-secondary underline hover:text-text-primary"
                >
                  Import Weekly Reports from Excel…
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="rounded-xl bg-surface-overlay px-4 py-2 text-sm text-text-secondary hover:bg-surface-overlay">Cancel</button>
              <button onClick={onSave} disabled={saving} className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-brand-hover disabled:opacity-50">
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

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
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

type UpdateRow = {
  id: string;
  week_of: string;
  pct_complete: number | null;
  notes: string | null;
  blockers: string | null;
};

type WeeklyReportImportDialogProps = {
  projectId: string;
  onClose: () => void;
};

function WeeklyReportImportDialog({ projectId, onClose }: WeeklyReportImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedWeeklyUpdate[] | null>(null);
  const [filename, setFilename] = useState("");
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overwriteDates, setOverwriteDates] = useState<Set<string>>(new Set());

  const importableRows = (parsedRows ?? []).filter((row) => row.weekOf && !row.alreadyExists && !row.parseError);
  const overwriteRows = (parsedRows ?? []).filter((row) => row.weekOf && row.alreadyExists && overwriteDates.has(row.weekOf));
  const totalToImport = importableRows.length + overwriteRows.length;

  function toggleOverwrite(weekOf: string) {
    setOverwriteDates((prev) => {
      const next = new Set(prev);
      if (next.has(weekOf)) next.delete(weekOf);
      else next.add(weekOf);
      return next;
    });
  }

  async function handleParse() {
    if (!file) return;

    setParsing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);

      const response = await fetch("/api/admin/parse-weekly-report", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to parse weekly report.");
      }

      setParsedRows((json?.rows as ParsedWeeklyUpdate[]) ?? []);
      setFilename((json?.filename as string) ?? file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse weekly report.");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!parsedRows) return;

    setImporting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/import-weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          rows: parsedRows,
          filename,
          overwriteDates: Array.from(overwriteDates),
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to import weekly reports.");
      }

      if (Array.isArray(json?.errors) && json.errors.length > 0) {
        setError(json.errors.join(" | "));
      }

      setResult({
        imported: typeof json?.imported === "number" ? json.imported : 0,
        skipped: typeof json?.skipped === "number" ? json.skipped : 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import weekly reports.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl border border-border-default bg-surface-base shadow-xl">
        <div className="flex items-start justify-between border-b border-border-default px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Weekly Report Import</p>
            <h3 className="mt-1 text-xl font-bold text-text-primary">Import Excel Reports</h3>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">x</button>
        </div>

        <div className="space-y-4 px-6 py-6">
          {error && (
            <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
              {error}
            </div>
          )}

          {!parsedRows && !result && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                Select a Weekly Report file (.xlsx or .xlsm) to import.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="file"
                  accept=".xlsx,.xlsm"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="text-sm text-text-secondary"
                />
                <span className="text-sm text-text-tertiary">{file?.name ?? "No file chosen"}</span>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleParse()}
                  disabled={!file || parsing}
                  className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-50"
                >
                  {parsing ? "Parsing..." : "Parse File"}
                </button>
              </div>
            </div>
          )}

          {parsedRows && !result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-text-secondary">
                  {importableRows.length} new{overwriteRows.length > 0 ? `, ${overwriteRows.length} overwrite` : ""}
                </p>
                <p className="text-xs text-text-tertiary">{filename}</p>
              </div>

              <div className="max-h-[420px] overflow-auto rounded-2xl border border-border-default">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-raised">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Sheet Name</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Week Of</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Days Active</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Hours</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row) => {
                      const isOverwriteChecked = !!row.weekOf && overwriteDates.has(row.weekOf);
                      const statusCell = row.parseError
                        ? <span className="text-status-danger">⚠ Parse error: {row.parseError}</span>
                        : row.alreadyExists
                          ? (
                            <label className="flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isOverwriteChecked}
                                onChange={() => row.weekOf && toggleOverwrite(row.weekOf)}
                                className="h-3.5 w-3.5 rounded accent-brand-primary"
                              />
                              <span className={isOverwriteChecked ? "text-status-warning font-medium" : "text-text-tertiary"}>
                                {isOverwriteChecked ? "Will overwrite" : "Already imported"}
                              </span>
                            </label>
                          )
                          : <span className="text-status-success">New ✓</span>;
                      const rowClass = row.parseError
                        ? "bg-status-danger/5"
                        : isOverwriteChecked
                          ? "bg-status-warning/5"
                          : row.alreadyExists
                            ? "opacity-50"
                            : "bg-status-success/5";

                      return (
                        <tr key={`${row.sheetName}-${row.weekOf ?? "unknown"}`} className={`border-b border-border-default ${rowClass}`}>
                          <td className="px-4 py-2.5 text-text-primary">{row.sheetName}</td>
                          <td className="px-4 py-2.5 text-text-secondary">{row.weekOf ?? "—"}</td>
                          <td className="px-4 py-2.5 text-right text-text-secondary">{row.crewLog.length || "—"}</td>
                          <td className="px-4 py-2.5 text-right text-text-secondary">{row.totalHours || "—"}</td>
                          <td className="px-4 py-2.5">{statusCell}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-surface-overlay px-4 py-2 text-sm text-text-secondary hover:bg-surface-overlay"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={totalToImport === 0 || importing}
                  className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-50"
                >
                  {importing ? "Importing..." : `Import ${totalToImport} Report${totalToImport !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <p className="text-base font-semibold text-text-primary">Import complete.</p>
              <div className="space-y-2 text-sm text-text-secondary">
                <p>✓ {result.imported} reports imported</p>
                <p>— {result.skipped} already existed or were skipped</p>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type PocSheetImportDialogProps = {
  projectId: string;
  onClose: () => void;
  onImported: () => void;
};

function PocSheetImportDialog({ projectId, onClose, onImported }: PocSheetImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState<ParsedPocSheet | null>(null);
  const [result, setResult] = useState<{ imported: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    if (!file) return;

    setParsing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);

      const response = await fetch("/api/admin/parse-poc-sheet", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to parse POC sheet.");
      }

      setParsed({
        filename: (json?.filename as string) ?? file.name,
        worksheetName: (json?.worksheetName as string) ?? "Sheet1",
        rows: ((json?.rows as ParsedPocImportRow[] | undefined) ?? []),
        totalWeight: typeof json?.totalWeight === "number" ? json.totalWeight : 0,
        overallPct: typeof json?.overallPct === "number" ? json.overallPct : 0,
        existingCount: typeof json?.existingCount === "number" ? json.existingCount : 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse POC sheet.");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!parsed) return;

    setImporting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/import-poc-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          filename: parsed.filename,
          rows: parsed.rows,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to import POC sheet.");
      }

      setResult({
        imported: typeof json?.imported === "number" ? json.imported : parsed.rows.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import POC sheet.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="w-full max-w-3xl rounded-2xl border border-border-default bg-surface-base shadow-xl">
        <div className="flex items-start justify-between border-b border-border-default px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">POC Import</p>
            <h3 className="mt-1 text-xl font-bold text-text-primary">Import POC Sheet</h3>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">x</button>
        </div>

        <div className="space-y-4 px-6 py-6">
          {error && (
            <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
              {error}
            </div>
          )}

          {!parsed && !result && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                Upload one project&apos;s legacy POC workbook. The import replaces this project&apos;s existing POC line items only.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="file"
                  accept=".xlsx,.xlsm"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="text-sm text-text-secondary"
                />
                <span className="text-sm text-text-tertiary">{file?.name ?? "No file chosen"}</span>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleParse()}
                  disabled={!file || parsing}
                  className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-50"
                >
                  {parsing ? "Parsing..." : "Parse File"}
                </button>
              </div>
            </div>
          )}

          {parsed && !result && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{parsed.filename}</p>
                    <p className="text-xs text-text-tertiary">Worksheet: {parsed.worksheetName}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-text-tertiary">Rows</p>
                      <p className="font-semibold text-text-primary">{parsed.rows.length}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-text-tertiary">Weight</p>
                      <p className="font-semibold text-text-primary">{parsed.totalWeight}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-text-tertiary">Overall</p>
                      <p className="font-semibold text-status-success">{(parsed.overallPct * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-text-secondary">
                  This will replace {parsed.existingCount} existing POC item{parsed.existingCount === 1 ? "" : "s"} for this project. You can still edit or clear the imported items afterward.
                </p>
              </div>

              <div className="max-h-[420px] overflow-auto rounded-2xl border border-border-default">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-raised">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Category</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Weight</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">% Complete</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.map((row) => (
                      <tr key={`${row.category}-${row.sourceRow}`} className="border-b border-border-default last:border-b-0">
                        <td className="px-4 py-2.5 text-text-primary">{row.category}</td>
                        <td className="px-4 py-2.5 text-right text-text-secondary">{row.weight}</td>
                        <td className="px-4 py-2.5 text-right text-text-secondary">{(row.pctComplete * 100).toFixed(1)}%</td>
                        <td className="px-4 py-2.5 text-right text-text-secondary">{row.contribution.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-surface-overlay px-4 py-2 text-sm text-text-secondary hover:bg-surface-overlay"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={parsed.rows.length === 0 || importing}
                  className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-50"
                >
                  {importing ? "Importing..." : `Replace with ${parsed.rows.length} POC Item${parsed.rows.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <p className="text-base font-semibold text-text-primary">POC import complete.</p>
              <p className="text-sm text-text-secondary">
                Imported {result.imported} line item{result.imported === 1 ? "" : "s"} for this project.
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onImported();
                    onClose();
                  }}
                  className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomerContactsSection({ projectId }: { projectId: string }) {
  const [contacts, setContacts] = useState<(ProjectCustomerContact & { profile: Profile })[]>([]);
  const [availableContacts, setAvailableContacts] = useState<Array<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    profile_id: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [portalAccountMessage, setPortalAccountMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/admin/data?section=project-customer-contacts&projectId=${encodeURIComponent(projectId)}`, {
          credentials: "include",
        });
        const json = await response.json();
        setContacts((((response.ok ? json?.contacts : []) ?? []) as (ProjectCustomerContact & { profile: Profile })[]));
        setAvailableContacts((((response.ok ? json?.availableContacts : []) ?? []) as Array<{
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          profile_id: string | null;
        }>));
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const existingIds = new Set(contacts.map((c) => c.profile_id));
  const availableToAdd = availableContacts.filter((contact) => !contact.profile_id || !existingIds.has(contact.profile_id));

  async function handleAdd() {
    if (!selectedContactId) return;
    setAdding(true);
    setAddError(null);
    setPortalAccountMessage(null);
    const res = await fetch("/api/admin/project-portal-contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ projectId, pmDirectoryId: selectedContactId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setAddError(json.error ?? "Failed to add contact.");
    } else if (json?.contact) {
      setContacts((prev) => {
        const next = prev.filter((item) => item.profile_id !== json.contact.profile_id);
        return [...next, json.contact as ProjectCustomerContact & { profile: Profile }];
      });
      if (typeof json?.createdAccountEmail === "string" && json.createdAccountEmail) {
        setPortalAccountMessage(`A portal account was created for ${json.createdAccountEmail}. They can use Forgot Password to set their password.`);
      }
      setSelectedContactId("");
    }
    setAdding(false);
  }

  async function handleToggle(profileId: string, field: "portal_access" | "email_digest", value: boolean) {
    setContacts((prev) => prev.map((c) => {
      if (c.profile_id !== profileId) return c;
      if (field === "portal_access" && !value) {
        return { ...c, portal_access: false, email_digest: false };
      }
      return { ...c, [field]: value };
    }));
    const res = await fetch("/api/admin/project-portal-contact", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ projectId, profileId, field, value }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setAddError(json?.error ?? "Failed to update contact.");
    }
  }

  async function handleRemove(profileId: string) {
    const res = await fetch("/api/admin/project-portal-contact", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ projectId, profileId }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setAddError(json?.error ?? "Failed to remove contact.");
      return;
    }
    setContacts((prev) => prev.filter((c) => c.profile_id !== profileId));
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
                  onChange={(e) => c.profile_id && void handleToggle(c.profile_id, "portal_access", e.target.checked)}
                  className="h-4 w-4 rounded accent-brand-primary"
                />
                <span className="text-xs text-text-secondary">Portal</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={c.email_digest}
                  onChange={(e) => c.profile_id && void handleToggle(c.profile_id, "email_digest", e.target.checked)}
                  className="h-4 w-4 rounded accent-brand-primary"
                />
                <span className="text-xs text-text-secondary">Email</span>
              </label>
              <button onClick={() => c.profile_id && void handleRemove(c.profile_id)} className="text-xs text-status-danger hover:underline shrink-0">
                Remove
              </button>
            </div>
          ))}

          {availableToAdd.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <select
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(e.target.value)}
                className="flex-1 rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
              >
                <option value="">Select a contact...</option>
                {availableToAdd.map((contact) => {
                  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
                  return (
                    <option key={contact.id} value={contact.id}>
                      {fullName ? `${fullName} <${contact.email}>` : contact.email}
                    </option>
                  );
                })}
              </select>
              <button
                onClick={() => void handleAdd()}
                disabled={adding || !selectedContactId}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-brand-hover disabled:opacity-50"
              >
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
          )}

          {addError && (
            <p className="text-xs text-status-danger">{addError}</p>
          )}

          {portalAccountMessage && (
            <p className="text-xs text-brand-primary">{portalAccountMessage}</p>
          )}

          {availableToAdd.length === 0 && availableContacts.length === 0 && (
            <p className="text-xs text-text-tertiary">No customer accounts exist yet. Create one at Admin → User Management.</p>
          )}
        </div>
      )}
    </section>
  );
}

function ChangeOrdersSection({ projectId }: { projectId: string }) {
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [coLoading, setCoLoading] = useState(false);
  const [showCoForm, setShowCoForm] = useState(false);
  const [coForm, setCoForm] = useState({
    coNumber: "",
    title: "",
    description: "",
    amount: "",
    status: "pending" as ChangeOrderStatus,
    submittedDate: "",
    approvedDate: "",
    referenceDoc: "",
    notes: "",
  });
  const [coSaving, setCoSaving] = useState(false);
  const [coError, setCoError] = useState<string | null>(null);

  useEffect(() => {
    async function loadChangeOrders() {
      setCoLoading(true);
      setCoError(null);
      try {
        const res = await fetch(`/api/admin/change-orders?projectId=${encodeURIComponent(projectId)}`, {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "Failed to load change orders.");
        }
        setChangeOrders((json?.changeOrders as ChangeOrder[] | undefined) ?? []);
      } catch (error) {
        setChangeOrders([]);
        setCoError(error instanceof Error ? error.message : "Failed to load change orders.");
      } finally {
        setCoLoading(false);
      }
    }

    void loadChangeOrders();
  }, [projectId]);

  const approvedTotal = useMemo(
    () => changeOrders.filter((co) => co.status === "approved").reduce((sum, co) => sum + co.amount, 0),
    [changeOrders]
  );
  const pendingTotal = useMemo(
    () => changeOrders.filter((co) => co.status === "pending").reduce((sum, co) => sum + co.amount, 0),
    [changeOrders]
  );

  async function handleAddCo() {
    if (!coForm.title.trim()) {
      setCoError("Title is required.");
      return;
    }

    setCoSaving(true);
    setCoError(null);

    const res = await fetch("/api/admin/change-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        projectId,
        coNumber: coForm.coNumber.trim() || undefined,
        title: coForm.title.trim(),
        description: coForm.description.trim() || undefined,
        amount: Number(coForm.amount) || 0,
        status: coForm.status,
        submittedDate: coForm.submittedDate || undefined,
        approvedDate: coForm.approvedDate || undefined,
        referenceDoc: coForm.referenceDoc.trim() || undefined,
        notes: coForm.notes.trim() || undefined,
      }),
    });

    const json = await res.json().catch(() => ({}));
    setCoSaving(false);

    if (!res.ok) {
      setCoError(json?.error ?? "Failed to save.");
      return;
    }

    setChangeOrders((prev) => [...prev, json.changeOrder as ChangeOrder]);
    setShowCoForm(false);
    setCoForm({
      coNumber: "",
      title: "",
      description: "",
      amount: "",
      status: "pending",
      submittedDate: "",
      approvedDate: "",
      referenceDoc: "",
      notes: "",
    });
  }

  async function handleVoidCo(id: string) {
    const res = await fetch("/api/admin/change-orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });

    if (res.ok) {
      setChangeOrders((prev) => prev.map((co) => (co.id === id ? { ...co, status: "void" } : co)));
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-heading text-lg font-semibold text-text-primary">Change Orders</h4>
        <button
          type="button"
          onClick={() => setShowCoForm((value) => !value)}
          className="rounded-lg bg-brand-primary/10 px-3 py-1.5 text-xs font-medium text-brand-primary hover:bg-brand-primary/20"
        >
          + Add CO
        </button>
      </div>

      {changeOrders.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-status-success/10 px-2.5 py-1 font-medium text-status-success">
            Approved: {formatCurrency(approvedTotal)}
          </span>
          <span className="rounded-full bg-status-warning/10 px-2.5 py-1 font-medium text-status-warning">
            Pending: {formatCurrency(pendingTotal)}
          </span>
        </div>
      )}

      {coLoading ? (
        <p className="text-sm text-text-tertiary">Loading change orders...</p>
      ) : (
        <div className="space-y-2">
          {changeOrders.filter((co) => co.status !== "void").map((co) => (
            <div
              key={co.id}
              className="flex items-center justify-between rounded-xl border border-border-default bg-surface-raised px-4 py-2.5 text-sm"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{co.co_number}</span>
                  <span className="text-text-secondary">-</span>
                  <span className="text-text-primary">{co.title}</span>
                  <StatusBadge status={co.status} />
                </div>
                {co.reference_doc && (
                  <p className="text-xs text-text-tertiary">Ref: {co.reference_doc}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={["font-semibold", co.amount >= 0 ? "text-status-success" : "text-status-danger"].join(" ")}>
                  {co.amount >= 0 ? "+" : ""}
                  {formatCurrency(co.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => void handleVoidCo(co.id)}
                  className="text-xs text-text-tertiary hover:text-status-danger"
                >
                  Void
                </button>
              </div>
            </div>
          ))}

          {!coLoading && changeOrders.filter((co) => co.status !== "void").length === 0 && (
            <p className="text-sm text-text-tertiary">No change orders logged yet.</p>
          )}
        </div>
      )}

      {showCoForm && (
        <div className="space-y-3 rounded-xl border border-border-default bg-surface-overlay p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">CO Number</label>
              <input
                type="text"
                value={coForm.coNumber}
                onChange={(e) => setCoForm((current) => ({ ...current, coNumber: e.target.value }))}
                placeholder="PCO-001"
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Status</label>
              <select
                value={coForm.status}
                onChange={(e) => setCoForm((current) => ({ ...current, status: e.target.value as ChangeOrderStatus }))}
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Title</label>
            <input
              type="text"
              value={coForm.title}
              onChange={(e) => setCoForm((current) => ({ ...current, title: e.target.value }))}
              placeholder="Brief description of the change"
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Description</label>
            <textarea
              value={coForm.description}
              onChange={(e) => setCoForm((current) => ({ ...current, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Amount ($)</label>
              <input
                type="number"
                value={coForm.amount}
                onChange={(e) => setCoForm((current) => ({ ...current, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Reference (RFI#, PO#, etc.)</label>
              <input
                type="text"
                value={coForm.referenceDoc}
                onChange={(e) => setCoForm((current) => ({ ...current, referenceDoc: e.target.value }))}
                placeholder="Optional"
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Submitted Date</label>
              <input
                type="date"
                value={coForm.submittedDate}
                onChange={(e) => setCoForm((current) => ({ ...current, submittedDate: e.target.value }))}
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Approved Date</label>
              <input
                type="date"
                value={coForm.approvedDate}
                onChange={(e) => setCoForm((current) => ({ ...current, approvedDate: e.target.value }))}
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Notes</label>
            <textarea
              value={coForm.notes}
              onChange={(e) => setCoForm((current) => ({ ...current, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </div>
          {coError && <p className="text-xs text-status-danger">{coError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCoForm(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-raised"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleAddCo()}
              disabled={coSaving}
              className="rounded-lg bg-brand-primary px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {coSaving ? "Saving..." : "Save CO"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: ChangeOrderStatus }) {
  const styles: Record<ChangeOrderStatus, string> = {
    pending: "bg-status-warning/10 text-status-warning",
    approved: "bg-status-success/10 text-status-success",
    rejected: "bg-status-danger/10 text-status-danger",
    void: "bg-surface-overlay text-text-tertiary",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}

function EstimatorAndPocSection({
  projectId,
  sourceEstimateId,
  onSourceEstimateIdChange,
}: {
  projectId: string;
  sourceEstimateId: string;
  onSourceEstimateIdChange: (v: string) => void;
}) {
  const [showEstimator, setShowEstimator] = useState(Boolean(sourceEstimateId));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-heading text-lg font-semibold text-text-primary">POC Setup</h4>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={showEstimator}
            onChange={(e) => setShowEstimator(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-brand-primary)]"
          />
          Link Estimate
        </label>
      </div>
      {showEstimator && (
        <div className="rounded-xl border border-border-default bg-surface-raised px-4 py-3 space-y-1.5">
          <label className="block text-sm font-medium text-text-secondary">Estimator Reference ID</label>
          <input
            value={sourceEstimateId}
            onChange={(e) => onSourceEstimateIdChange(e.target.value)}
            placeholder="Paste estimate ID from estimates.thecontrolscompany.com"
            className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
          />
          <p className="text-xs text-text-tertiary">
            Links POC categories to the original estimate. Future feature — save the ID now for later sync.
          </p>
        </div>
      )}
      <PocSetupSection projectId={projectId} />
    </div>
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
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function loadItems() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/data?section=project-poc-items&projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      const json = await response.json();
      setItems((((response.ok ? json?.items : []) ?? []) as PocLineItem[]));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
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
    setStatusMessage(null);
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
      setStatusMessage("POC item added.");
    }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    setStatusMessage(null);
    await supabase.from("poc_line_items").delete().eq("id", id);
    const nextItems = items.filter((item) => item.id !== id).map((item, index) => ({ ...item, sort_order: index }));
    setItems(nextItems);
    await persistSortOrder(nextItems);
    setStatusMessage("POC item removed.");
  }

  async function handleWeightChange(id: string, weight: number) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, weight } : item)));
    setSaving(id);
    await supabase.from("poc_line_items").update({ weight }).eq("id", id);
    setSaving(null);
  }

  async function handleCategorySave(id: string, category: string) {
    setSaving(id);
    await supabase.from("poc_line_items").update({ category }).eq("id", id);
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

  async function handleClearAll() {
    if (items.length === 0) return;
    const confirmed = window.confirm("Delete all POC line items for this project?");
    if (!confirmed) return;

    setSaving("all");
    setStatusMessage(null);
    await supabase.from("poc_line_items").delete().eq("project_id", projectId);
    setItems([]);
    setSaving(null);
    setStatusMessage("All POC items cleared for this project.");
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-heading text-lg font-semibold text-text-primary">POC Line Items</h4>
          <p className="text-xs text-text-secondary">Project-scoped categories and weights used to calculate % complete.</p>
        </div>
        <div className="flex items-center gap-2">
          {totalWeight > 0 && <span className="text-xs text-text-tertiary">Total weight: {totalWeight}</span>}
          <button
            type="button"
            onClick={() => setShowImportDialog(true)}
            className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
          >
            Import POC Sheet...
          </button>
          <button
            type="button"
            onClick={() => void handleClearAll()}
            disabled={items.length === 0 || saving === "all"}
            className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-1.5 text-xs font-medium text-status-danger transition hover:bg-status-danger/20 disabled:opacity-50"
          >
            {saving === "all" ? "Clearing..." : "Clear All"}
          </button>
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        Define the categories and relative weights for the % complete calculation. PMs update each category&apos;s completion in their weekly report.
      </p>
      {statusMessage && (
        <div className="rounded-xl border border-status-success/20 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          {statusMessage}
        </div>
      )}

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
                      <input
                        type="text"
                        value={item.category}
                        onChange={(e) => {
                          const nextCategory = e.target.value;
                          setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, category: nextCategory } : row)));
                        }}
                        onBlur={(e) => void handleCategorySave(item.id, e.target.value)}
                        className="min-w-[220px] rounded-lg border border-border-default bg-surface-overlay px-2.5 py-1 text-sm font-medium text-text-primary focus:border-brand-primary/50 focus:outline-none"
                      />
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

      {showImportDialog && (
        <PocSheetImportDialog
          projectId={projectId}
          onClose={() => setShowImportDialog(false)}
          onImported={() => {
            setShowImportDialog(false);
            setStatusMessage("POC sheet imported for this project.");
            void loadItems();
          }}
        />
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
