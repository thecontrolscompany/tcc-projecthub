"use client";

import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/client";

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
  special_requirements: string | null;
  special_access: string | null;
  notes: string | null;
  pm_directory_id: string | null;
  pm_id: string | null;
  sharepoint_folder: string | null;
  customer?: { name: string } | null;
  pm_directory?: { id: string; first_name: string | null; last_name: string | null; email: string; profile_id: string | null } | null;
};

type CustomerOption = {
  id: string;
  name: string;
  contact_email: string | null;
};

type PmOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  profile_id: string | null;
};

type ProjectFormErrors = Partial<Record<"form" | "projectName" | "customerId" | "newCustomerName" | "contractPrice", string>>;

type ProjectFormValues = {
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
  assignedPmId: string;
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

const EMPTY_PROJECT_FORM: ProjectFormValues = {
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
  assignedPmId: "",
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

function normalizeSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const inputClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

const textareaClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

type SortKey = "name" | "customer" | "contract_price";
type SortDir = "asc" | "desc";
type StatusFilter = "active" | "completed" | "all";

export function AdminProjectsTab() {
  const supabase = createClient();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [pms, setPms] = useState<PmOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRow | null>(null);
  const [jobNumberPreview, setJobNumberPreview] = useState("");
  const [formValues, setFormValues] = useState<ProjectFormValues>(EMPTY_PROJECT_FORM);
  const [validationErrors, setValidationErrors] = useState<ProjectFormErrors>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    loadProjects();
    loadFormLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("projects")
        .select(`
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
          special_requirements,
          special_access,
          notes,
          pm_directory_id,
          pm_id,
          sharepoint_folder,
          created_at,
          customer:customers(name),
          pm_directory:pm_directory(id, first_name, last_name, email, profile_id)
        `)
        .order("name");

      const normalized = (data ?? []).map((item) => ({
        ...item,
        customer: normalizeSingle(item.customer),
        pm_directory: normalizeSingle(item.pm_directory),
      })) as ProjectRow[];

      setProjects(normalized);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadFormLookups() {
    const [{ data: customerData }, { data: pmData }] = await Promise.all([
      supabase.from("customers").select("id, name, contact_email").order("name"),
      supabase.from("pm_directory").select("id, first_name, last_name, email, profile_id").order("email"),
    ]);

    setCustomers((customerData as CustomerOption[]) ?? []);
    setPms((pmData as PmOption[]) ?? []);
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

  async function openNewProjectModal() {
    const nextJobNumber = await getNextJobNumber();
    setEditingProject(null);
    setFormValues(EMPTY_PROJECT_FORM);
    setValidationErrors({});
    setJobNumberPreview(nextJobNumber);
    setShowModal(true);
  }

  function openEditProjectModal(project: ProjectRow) {
    setEditingProject(project);
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
      assignedPmId: project.pm_directory_id ?? "",
      notes: project.notes ?? "",
      specialRequirements: project.special_requirements ?? "",
      specialAccess: project.special_access ?? "",
      allConduitPlenum: project.all_conduit_plenum ?? false,
      certifiedPayroll: project.certified_payroll ?? false,
      buyAmerican: project.buy_american ?? false,
      bondRequired: project.bond_required ?? false,
      billedInFull: project.billed_in_full ?? false,
      paidInFull: project.paid_in_full ?? false,
    });
    setValidationErrors({});
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

  async function handleSaveProject() {
    const errors: ProjectFormErrors = {};

    if (!formValues.projectName.trim()) {
      errors.projectName = "Project name is required";
    }

    if (formValues.useNewCustomer) {
      if (!formValues.newCustomerName.trim()) {
        errors.newCustomerName = "New customer name is required";
      }
    } else if (!formValues.customerId) {
      errors.customerId = "Customer is required";
    }

    if (!formValues.contractPrice.trim()) {
      errors.contractPrice = "Contract price is required";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors({
        ...errors,
        form: "Please fill in all required fields before saving.",
      });
      return;
    }

    setValidationErrors({});

    setSaving(true);

    try {
      let customerId = formValues.customerId;

      if (formValues.useNewCustomer) {
        const { data: newCustomer, error: customerError } = await supabase
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

      const selectedPm = pms.find((pm) => pm.id === formValues.assignedPmId) ?? null;
      const contractPrice = Number(formValues.contractPrice);
      const billedAndPaid = formValues.billedInFull && formValues.paidInFull;
      const effectiveJobNumber = editingProject?.job_number ?? jobNumberPreview;
      const projectName = `${effectiveJobNumber} - ${formValues.projectName.trim()}`;

      const payload = {
        customer_id: customerId || null,
        pm_directory_id: formValues.assignedPmId || null,
        pm_id: selectedPm?.profile_id ?? null,
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
        special_requirements: formValues.specialRequirements.trim() || null,
        special_access: formValues.specialAccess.trim() || null,
        notes: formValues.notes.trim() || null,
        billed_in_full: formValues.billedInFull,
        paid_in_full: formValues.paidInFull,
        is_active: !billedAndPaid,
        completed_at: billedAndPaid ? new Date().toISOString() : null,
      };

      if (editingProject) {
        const { error } = await supabase
          .from("projects")
          .update(payload)
          .eq("id", editingProject.id);

        if (error) throw error;

        if ((editingProject.contract_price ?? editingProject.estimated_income) !== contractPrice) {
          await supabase
            .from("billing_periods")
            .update({ estimated_income_snapshot: contractPrice })
            .eq("project_id", editingProject.id)
            .is("actual_billed", null);
        }
      } else {
        const { data: insertedProject, error } = await supabase
          .from("projects")
          .insert({
            ...payload,
            job_number: jobNumberPreview,
          })
          .select("id, job_number")
          .single();

        if (error) throw error;

        await supabase.from("billing_periods").insert({
          project_id: insertedProject.id,
          period_month: format(startOfMonth(new Date()), "yyyy-MM-dd"),
          estimated_income_snapshot: contractPrice,
          pct_complete: 0,
          prev_billed: 0,
        });

        fetch("/api/admin/provision-project-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: insertedProject.id,
            jobNumber: insertedProject.job_number,
            projectName: formValues.projectName.trim(),
          }),
        }).catch((error) => console.error("Project folder provisioning failed", error));
      }

      setShowModal(false);
      setEditingProject(null);
      setFormValues(EMPTY_PROJECT_FORM);
      setValidationErrors({});
      await loadProjects();
    } finally {
      setSaving(false);
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const visibleProjects = projects
    .filter((p) => {
      if (statusFilter === "active" && !p.is_active) return false;
      if (statusFilter === "completed" && p.is_active) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.customer?.name ?? "").toLowerCase().includes(q) ||
          (p.pm_directory?.first_name ?? "").toLowerCase().includes(q) ||
          (p.pm_directory?.email ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let av = "", bv = "";
      if (sortKey === "name") { av = a.name; bv = b.name; }
      else if (sortKey === "customer") { av = a.customer?.name ?? ""; bv = b.customer?.name ?? ""; }
      else if (sortKey === "contract_price") {
        const an = a.contract_price ?? a.estimated_income ?? 0;
        const bn = b.contract_price ?? b.estimated_income ?? 0;
        return sortDir === "asc" ? an - bn : bn - an;
      }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const externalContactOptions = useMemo(
    () => pms.filter((pm) => !pm.email.toLowerCase().endsWith("@controlsco.net")),
    [pms]
  );

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey !== col ? <span className="ml-1 opacity-30">↕</span> :
    sortDir === "asc" ? <span className="ml-1">↑</span> : <span className="ml-1">↓</span>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Projects</h2>
        <button
          onClick={openNewProjectModal}
          className="rounded-xl bg-brand-primary px-4 py-1.5 text-sm font-semibold text-text-inverse hover:bg-brand-hover"
        >
          + New Project
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-border-default overflow-hidden text-sm">
          {(["active", "completed", "all"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                "px-3 py-1.5 capitalize",
                statusFilter === s
                  ? "bg-brand-primary text-text-inverse font-semibold"
                  : "text-text-secondary hover:bg-surface-overlay",
              ].join(" ")}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search projects, customer, PM…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl border border-border-default bg-surface-overlay px-3 py-1.5 text-sm text-text-primary focus:border-brand-primary focus:outline-none w-64"
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
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("name")}>Project <SortIcon col="name" /></th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("customer")}>Customer <SortIcon col="customer" /></th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">PM</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort("contract_price")}>Contract <SortIcon col="contract_price" /></th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">B / P</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary"></th>
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((p) => (
                <tr key={p.id} className="border-b border-border-default hover:bg-surface-raised">
                  <td className="px-3 py-2 font-medium text-text-primary">
                    {p.name}
                    {p.migration_status === "legacy" && (
                      <span className="ml-2 inline-flex items-center rounded border border-status-warning/20 bg-status-warning/10 px-1.5 py-0.5 text-xs font-medium text-status-warning">
                        Legacy
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    <div>{p.customer?.name ?? "-"}</div>
                    {p.customer_poc && <div className="text-xs text-text-tertiary">{p.customer_poc}</div>}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {p.pm_directory ? (p.pm_directory.first_name ?? p.pm_directory.email) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right text-text-secondary">{fmt(p.contract_price ?? p.estimated_income ?? 0)}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        p.is_active ? "bg-status-success/10 text-status-success" : "bg-surface-overlay text-text-secondary",
                      ].join(" ")}
                    >
                      {p.is_active ? "Active" : "Completed"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs text-text-secondary">
                      {p.billed_in_full ? "B" : "·"} / {p.paid_in_full ? "P" : "·"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => openEditProjectModal(p)}
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
          pms={pms}
          externalContacts={externalContactOptions}
          values={formValues}
          saving={saving}
          errors={validationErrors}
          onClose={() => {
            setShowModal(false);
            setEditingProject(null);
            setFormValues(EMPTY_PROJECT_FORM);
            setValidationErrors({});
          }}
          onChange={updateFormValue}
          onSave={handleSaveProject}
        />
      )}
    </div>
  );
}

function ProjectModal({
  editingProject,
  jobNumberPreview,
  customers,
  pms,
  externalContacts,
  values,
  saving,
  errors,
  onClose,
  onChange,
  onSave,
}: {
  editingProject: ProjectRow | null;
  jobNumberPreview: string;
  customers: CustomerOption[];
  pms: PmOption[];
  externalContacts: PmOption[];
  values: ProjectFormValues;
  saving: boolean;
  errors: ProjectFormErrors;
  onClose: () => void;
  onChange: <K extends keyof ProjectFormValues>(field: K, value: ProjectFormValues[K]) => void;
  onSave: () => void;
}) {
  const customerOptions = useMemo(() => customers, [customers]);
  const pmOptions = useMemo(() => pms.filter((pm) => pm.email.toLowerCase().endsWith("@controlsco.net")), [pms]);
  const customerPocOptions = useMemo(() => {
    const options = [...externalContacts];
    const currentValue = values.customerPoc.trim();

    if (currentValue && !options.some((pm) => formatContactLabel(pm) === currentValue)) {
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

  function formatContactLabel(pm: PmOption) {
    const fullName = [pm.first_name, pm.last_name].filter(Boolean).join(" ").trim();
    return fullName ? `${fullName} (${pm.email})` : pm.email;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border-default bg-surface-base shadow-xl">
        <div className="flex items-start justify-between border-b border-border-default px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
              {editingProject ? "Edit Project" : "New Project"}
            </p>
            <h3 className="font-heading text-xl font-bold text-text-primary">
              {jobNumberPreview || "Pending Job Number"}
            </h3>
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
                    onChange={(e) =>
                      {
                        const useNewCustomer = e.target.value === "__new__";
                        onChange("useNewCustomer", useNewCustomer);
                        onChange("customerId", useNewCustomer ? "" : e.target.value);
                      }
                    }
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

              <FormField label="Assigned PM">
                <select value={values.assignedPmId} onChange={(e) => onChange("assignedPmId", e.target.value)} className={inputClassName}>
                  <option value="">Unassigned</option>
                  {pmOptions.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {formatContactLabel(pm)}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Customer POC">
                <select
                  value={values.customerPoc}
                  onChange={(e) => onChange("customerPoc", e.target.value)}
                  className={inputClassName}
                >
                  <option value="">Select customer contact</option>
                  {customerPocOptions.map((pm) => {
                    const label = formatContactLabel(pm);
                    return (
                      <option key={pm.id} value={label}>
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
