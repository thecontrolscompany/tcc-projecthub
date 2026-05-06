"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AdminUsersPage } from "@/components/admin-users-page";
import { ContactsList } from "@/app/crm/contacts/contacts-list";
import { safeJson } from "@/lib/utils/safe-json";
import type { InternalContactRole, UserRole } from "@/types/database";

const INTERNAL_CONTACT_ROLES: InternalContactRole[] = ["pm", "lead", "installer", "ops_manager"];
type ContactTab = "all" | "directory" | "users" | "relationships";

type PmDirectoryRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  profile_id: string | null;
  intended_role: InternalContactRole | null;
  profile?: {
    id: string;
    full_name: string | null;
    role: UserRole;
    pm_directory_id: string | null;
  } | null;
};

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function AdminContactsPage({ role = "admin" }: { role?: string }) {
  const isAdmin = role === "admin";
  const tabs: Array<{ id: ContactTab; label: string; adminOnly?: boolean }> = [
    { id: "all", label: "All People" },
    { id: "directory", label: "Directory", adminOnly: true },
    { id: "users", label: "Portal Users", adminOnly: true },
    { id: "relationships", label: "Relationship People" },
  ];
  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin);
  const [contactTab, setContactTab] = useState<ContactTab>("all");

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 py-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-text-primary">People</h1>
        <p className="text-sm text-text-secondary">
          Manage the global people system: team directory, portal accounts, and relationship contacts.
        </p>
      </div>

      <div className="mb-4 flex gap-2 border-b border-border-default pb-3">
        {visibleTabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setContactTab(id)}
            className={[
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              contactTab === id
                ? "bg-surface-overlay text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {contactTab === "all" && <UnifiedPeoplePanel />}
      {contactTab === "directory" && isAdmin && <ContactsPanel />}
      {contactTab === "users" && isAdmin && <AdminUsersPage />}
      {contactTab === "relationships" && <RelationshipPeoplePanel role={role} />}
    </div>
  );
}

type UnifiedPerson = {
  key: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  companyNames: string[];
  roles: string[];
  sources: Array<"portal" | "directory" | "relationship">;
  profileIds: string[];
  directoryIds: string[];
  crmContactIds: string[];
};

const SOURCE_LABELS: Record<UnifiedPerson["sources"][number], string> = {
  portal: "Portal",
  directory: "Directory",
  relationship: "Relationship",
};

const PORTAL_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "pm", label: "PM" },
  { value: "lead", label: "Lead" },
  { value: "installer", label: "Installer" },
  { value: "ops_manager", label: "Ops Manager" },
  { value: "customer", label: "Customer" },
];

const ROLE_MATRIX_COLUMNS = [
  { key: "directory", label: "Directory" },
  { key: "portal", label: "Portal User" },
  { key: "role", label: "Portal Role" },
  { key: "relationship", label: "Relationship" },
] as const;

type MatrixColumnKey = "person" | "company" | (typeof ROLE_MATRIX_COLUMNS)[number]["key"];
type SortDir = "asc" | "desc";
type PresenceFilter = "all" | "checked" | "blank";
type RoleFilter = "all" | "none" | UserRole;

function UnifiedPeoplePanel() {
  const [people, setPeople] = useState<UnifiedPerson[]>([]);
  const [search, setSearch] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [presenceFilters, setPresenceFilters] = useState<Record<(typeof ROLE_MATRIX_COLUMNS)[number]["key"], PresenceFilter>>(
    () => Object.fromEntries(ROLE_MATRIX_COLUMNS.map((column) => [column.key, "all"])) as Record<(typeof ROLE_MATRIX_COLUMNS)[number]["key"], PresenceFilter>
  );
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sort, setSort] = useState<{ key: MatrixColumnKey; dir: SortDir }>({ key: "person", dir: "asc" });
  const [editMode, setEditMode] = useState(false);
  const [savingPersonKey, setSavingPersonKey] = useState<string | null>(null);
  const [matrixStatus, setMatrixStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPeople() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch("/api/people", { credentials: "include" });
        const json = await safeJson(response);
        if (!active) return;
        if (!response.ok) {
          setLoadError(json?.error ?? "Failed to load people.");
          setPeople([]);
        } else {
          setPeople((json?.people as UnifiedPerson[]) ?? []);
        }
      } catch {
        if (!active) return;
        setLoadError("Failed to load people.");
        setPeople([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPeople();
    return () => {
      active = false;
    };
  }, []);

  function getPortalRole(person: UnifiedPerson): UserRole | null {
    return PORTAL_ROLE_OPTIONS.find((role) => person.roles.includes(role.value))?.value ?? null;
  }

  function getCheckedByColumn(person: UnifiedPerson): Record<(typeof ROLE_MATRIX_COLUMNS)[number]["key"], boolean> {
    return {
      directory: person.sources.includes("directory"),
      portal: person.sources.includes("portal"),
      role: Boolean(getPortalRole(person)),
      relationship: person.sources.includes("relationship"),
    };
  }

  function toggleSort(key: MatrixColumnKey) {
    setSort((current) => ({
      key,
      dir: current.key === key && current.dir === "asc" ? "desc" : "asc",
    }));
  }

  async function handleRoleChange(person: UnifiedPerson, role: UserRole) {
    const userId = person.profileIds[0];
    if (!userId) {
      setMatrixStatus({ type: "error", message: "Create a portal user before assigning a portal role." });
      return;
    }

    setSavingPersonKey(person.key);
    setMatrixStatus(null);
    try {
      const response = await fetch("/api/admin/update-user-role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, role }),
      });
      const json = await safeJson(response);
      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to update portal role.");
      }

      setPeople((current) =>
        current.map((item) =>
          item.key === person.key
            ? {
                ...item,
                roles: [...item.roles.filter((value) => !PORTAL_ROLE_OPTIONS.some((option) => option.value === value)), role],
              }
            : item
        )
      );
      setMatrixStatus({ type: "success", message: `Updated ${person.displayName}.` });
    } catch (error) {
      setMatrixStatus({ type: "error", message: error instanceof Error ? error.message : "Failed to update portal role." });
    } finally {
      setSavingPersonKey(null);
    }
  }

  const filteredPeople = people.filter((person) => {
    const q = search.trim().toLowerCase();
    const searchable = [
      person.displayName,
      person.email,
      person.phone,
      ...person.companyNames,
      ...person.roles,
      ...person.sources.map((source) => SOURCE_LABELS[source]),
    ]
      .filter(Boolean);

    if (q && !searchable.some((value) => value!.toLowerCase().includes(q))) return false;
    if (personFilter.trim()) {
      const personQuery = personFilter.trim().toLowerCase();
      if (![person.displayName, person.email, person.phone].filter(Boolean).some((value) => value!.toLowerCase().includes(personQuery))) return false;
    }
    if (companyFilter.trim()) {
      const companyQuery = companyFilter.trim().toLowerCase();
      if (!person.companyNames.some((company) => company.toLowerCase().includes(companyQuery))) return false;
    }

    const checkedByColumn = getCheckedByColumn(person);
    return ROLE_MATRIX_COLUMNS.every((column) => {
      if (column.key === "role") {
        const role = getPortalRole(person);
        if (roleFilter === "all") return true;
        return roleFilter === "none" ? !role : role === roleFilter;
      }
      const filter = presenceFilters[column.key];
      if (filter === "all") return true;
      return filter === "checked" ? checkedByColumn[column.key] : !checkedByColumn[column.key];
    });
  }).sort((a, b) => {
    const multiplier = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "person") return a.displayName.localeCompare(b.displayName) * multiplier;
    if (sort.key === "company") return (a.companyNames[0] ?? "").localeCompare(b.companyNames[0] ?? "") * multiplier;

    const aChecked = getCheckedByColumn(a)[sort.key];
    const bChecked = getCheckedByColumn(b)[sort.key];
    if (sort.key === "role") {
      const aRole = getPortalRole(a) ?? "";
      const bRole = getPortalRole(b) ?? "";
      return aRole.localeCompare(bRole) * multiplier || a.displayName.localeCompare(b.displayName);
    }
    if (aChecked === bChecked) return a.displayName.localeCompare(b.displayName);
    return (Number(aChecked) - Number(bChecked)) * multiplier;
  });

  if (loading) {
    return <div className="py-10 text-center text-text-tertiary">Loading people...</div>;
  }

  if (loadError) {
    return <div className="rounded-xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger">{loadError}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Directory Matrix</h2>
          <p className="text-sm text-text-secondary">
            One row per person. Source columns show where the person appears; portal users have one current role.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search people..."
            className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none sm:w-72"
          />
          <button
            type="button"
            onClick={() => setEditMode((value) => !value)}
            className={[
              "rounded-xl border px-4 py-2 text-sm font-semibold transition",
              editMode
                ? "border-brand-primary/40 bg-brand-primary/10 text-brand-primary"
                : "border-border-default bg-surface-raised text-text-secondary hover:bg-surface-overlay hover:text-text-primary",
            ].join(" ")}
          >
            {editMode ? "Done Editing" : "Edit Matrix"}
          </button>
        </div>
      </div>

      {matrixStatus && (
        <div
          className={[
            "rounded-xl border px-4 py-2.5 text-sm",
            matrixStatus.type === "success"
              ? "border-status-success/30 bg-status-success/10 text-status-success"
              : "border-status-danger/30 bg-status-danger/10 text-status-danger",
          ].join(" ")}
        >
          {matrixStatus.message}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border-default">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-raised shadow-[0_1px_0_0_rgba(148,163,184,0.22)]">
            <tr className="border-b border-border-default">
              <th className="min-w-[240px] px-4 py-2.5 text-left align-bottom">
                <button type="button" onClick={() => toggleSort("person")} className="text-xs font-semibold uppercase tracking-wide text-text-secondary hover:text-text-primary">
                  Person {sort.key === "person" ? (sort.dir === "asc" ? "Asc" : "Desc") : ""}
                </button>
                <input
                  type="search"
                  value={personFilter}
                  onChange={(event) => setPersonFilter(event.target.value)}
                  placeholder="Filter..."
                  className="mt-2 w-full rounded-lg border border-border-default bg-surface-base px-2 py-1 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                />
              </th>
              <th className="min-w-[180px] px-4 py-2.5 text-left align-bottom">
                <button type="button" onClick={() => toggleSort("company")} className="text-xs font-semibold uppercase tracking-wide text-text-secondary hover:text-text-primary">
                  Company {sort.key === "company" ? (sort.dir === "asc" ? "Asc" : "Desc") : ""}
                </button>
                <input
                  type="search"
                  value={companyFilter}
                  onChange={(event) => setCompanyFilter(event.target.value)}
                  placeholder="Filter..."
                  className="mt-2 w-full rounded-lg border border-border-default bg-surface-base px-2 py-1 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                />
              </th>
              {ROLE_MATRIX_COLUMNS.map((column) => (
                <th key={column.key} className="min-w-[140px] px-3 py-2.5 text-center align-bottom">
                  <button type="button" onClick={() => toggleSort(column.key)} className="text-xs font-semibold uppercase tracking-wide text-text-secondary hover:text-text-primary">
                    {column.label} {sort.key === column.key ? (sort.dir === "asc" ? "Asc" : "Desc") : ""}
                  </button>
                  {column.key === "role" ? (
                    <select
                      value={roleFilter}
                      onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
                      className="mt-2 w-full rounded-lg border border-border-default bg-surface-base px-2 py-1 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                    >
                      <option value="all">All roles</option>
                      <option value="none">No role</option>
                      {PORTAL_ROLE_OPTIONS.map((role) => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={presenceFilters[column.key]}
                      onChange={(event) =>
                        setPresenceFilters((current) => ({
                          ...current,
                          [column.key]: event.target.value as PresenceFilter,
                        }))
                      }
                      className="mt-2 w-full rounded-lg border border-border-default bg-surface-base px-2 py-1 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                    >
                      <option value="all">All</option>
                      <option value="checked">Checked</option>
                      <option value="blank">Blank</option>
                    </select>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredPeople.map((person) => {
              const checkedByColumn = getCheckedByColumn(person);
              const portalRole = getPortalRole(person);

              return (
                <tr key={person.key} className="border-b border-border-default hover:bg-surface-raised">
                  <td className="min-w-[240px] px-4 py-3">
                    <p className="font-medium text-text-primary">{person.displayName}</p>
                    <p className="text-xs text-text-tertiary">{person.email ?? "No email on file"}</p>
                    {person.phone && <p className="text-xs text-text-tertiary">{person.phone}</p>}
                  </td>
                  <td className="min-w-[180px] px-4 py-3 text-text-secondary">{person.companyNames.join(", ") || "-"}</td>
                  {ROLE_MATRIX_COLUMNS.map((column) =>
                    column.key === "role" ? (
                      <td key={column.key} className="min-w-[140px] px-3 py-3 text-center">
                        {editMode && person.profileIds[0] ? (
                        <select
                          value={portalRole ?? ""}
                          onChange={(event) => void handleRoleChange(person, event.target.value as UserRole)}
                          disabled={savingPersonKey === person.key}
                          className="w-full rounded-lg border border-border-default bg-surface-overlay px-2 py-1 text-xs text-text-primary focus:border-brand-primary focus:outline-none disabled:opacity-50"
                        >
                          <option value="" disabled>Role</option>
                          {PORTAL_ROLE_OPTIONS.map((role) => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                        ) : (
                          <span className="text-sm text-text-secondary">
                            {portalRole ? PORTAL_ROLE_OPTIONS.find((role) => role.value === portalRole)?.label : person.profileIds[0] ? "No role" : "-"}
                          </span>
                        )}
                      </td>
                    ) : (
                      <td key={column.key} className="min-w-[140px] px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={checkedByColumn[column.key]}
                          readOnly
                          disabled
                          aria-label={`${person.displayName} ${column.label}`}
                          className="h-4 w-4 rounded border-border-default bg-surface-overlay accent-brand-primary disabled:opacity-70"
                        />
                      </td>
                    )
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-text-tertiary">
        Edit mode updates the current portal role for people who already have a portal user. Directory, Portal User, and Relationship remain source indicators.
      </p>

      {filteredPeople.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border-default px-6 py-10 text-center text-sm text-text-tertiary">
          No people match your search.
        </div>
      )}
    </div>
  );
}

type RelationshipContact = {
  id: string;
  display_name: string;
  role_type: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  is_active: boolean;
  confidence_level: string;
  influence_level: string;
  issues_purchase_orders: boolean;
  involved_in_estimating: boolean;
  involved_in_project_execution: boolean;
  account_id: string | null;
  account?: { id: string; company_name: string; type: string } | null;
};

function RelationshipPeoplePanel({ role }: { role: string }) {
  const [contacts, setContacts] = useState<RelationshipContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadContacts() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch("/api/crm/contacts", { credentials: "include" });
        const json = await safeJson(response);
        if (!active) return;
        if (!response.ok) {
          setLoadError(json?.error ?? "Failed to load relationship people.");
          setContacts([]);
        } else {
          setContacts((json?.contacts as RelationshipContact[]) ?? []);
        }
      } catch {
        if (!active) return;
        setLoadError("Failed to load relationship people.");
        setContacts([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadContacts();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="py-10 text-center text-text-tertiary">Loading relationship people...</div>;
  }

  if (loadError) {
    return <div className="rounded-xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger">{loadError}</div>;
  }

  return (
    <ContactsList
      contacts={contacts as Parameters<typeof ContactsList>[0]["contacts"]}
      role={role}
      showSubnav={false}
      title="Relationship People"
      importHref="/crm/contacts/import-email"
    />
  );
}

function ContactsPanel() {
  const supabase = createClient();
  const [pms, setPms] = useState<PmDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string; consentUrl?: string } | null>(null);
  const [editingPm, setEditingPm] = useState<PmDirectoryRow | null>(null);
  const [isAddingPm, setIsAddingPm] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState<InternalContactRole>("pm");
  const [savingPm, setSavingPm] = useState(false);
  const [deletingPmId, setDeletingPmId] = useState<string | null>(null);

  async function loadPms() {
    setLoading(true);

    try {
      const res = await fetch("/api/admin/data?section=contacts", {
        credentials: "include",
      });
      const json = await safeJson(res);
      const contactData = res.ok ? json?.contacts : null;

      const normalized = (
        (contactData as Array<
          PmDirectoryRow & {
            profile?:
              | PmDirectoryRow["profile"]
              | Array<NonNullable<PmDirectoryRow["profile"]>>;
          }
        > | null) ?? []
      ).map((item) => ({
        ...item,
        profile: Array.isArray(item.profile) ? item.profile[0] ?? null : item.profile ?? null,
      }));

      setPms(normalized);
    } catch {
      setPms([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPms();
  }, []);

  function resetPmForm() {
    setEditingPm(null);
    setIsAddingPm(false);
    setFormEmail("");
    setFormFirstName("");
    setFormLastName("");
    setFormPhone("");
    setFormRole("pm");
  }

  function openAddPmModal() {
    resetPmForm();
    setIsAddingPm(true);
    setStatus(null);
  }

  function openEditPmModal(pm: PmDirectoryRow) {
    setEditingPm(pm);
    setIsAddingPm(false);
    setFormEmail(pm.email);
    setFormFirstName(pm.first_name ?? "");
    setFormLastName(pm.last_name ?? "");
    setFormPhone(formatPhone(pm.phone ?? ""));
    setFormRole(
      pm.profile?.role && INTERNAL_CONTACT_ROLES.includes(pm.profile.role as InternalContactRole)
        ? (pm.profile.role as InternalContactRole)
        : pm.intended_role ?? "pm"
    );
    setStatus(null);
  }

  async function handleSavePm() {
    const normalizedEmail = formEmail.trim().toLowerCase();
    const isInternalContact = normalizedEmail.endsWith("@controlsco.net");

    if (!normalizedEmail) {
      setStatus({ type: "error", message: "Email is required." });
      return;
    }

    setSavingPm(true);
    setStatus(null);

    try {
      let intendedRole: InternalContactRole | null = null;

      if (isInternalContact) {
        const { data: matchingProfile } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (matchingProfile?.id) {
          const { error: profileError } = await supabase
            .from("profiles")
            .update({ role: formRole })
            .eq("id", matchingProfile.id);

          if (profileError) throw profileError;
        } else {
          intendedRole = formRole;
        }
      }

      if (editingPm) {
        const { error } = await supabase
          .from("pm_directory")
          .update({
            email: normalizedEmail,
            first_name: formFirstName.trim() || null,
            last_name: formLastName.trim() || null,
            phone: formPhone.trim() || null,
            intended_role: isInternalContact ? intendedRole : null,
          })
          .eq("id", editingPm.id);

        if (error) throw error;

        setStatus({ type: "success", message: "Contact entry updated." });
      } else {
        const { error } = await supabase
          .from("pm_directory")
          .insert({
            email: normalizedEmail,
            first_name: formFirstName.trim() || null,
            last_name: formLastName.trim() || null,
            phone: formPhone.trim() || null,
            intended_role: isInternalContact ? intendedRole : null,
          });

        if (error) throw error;

        setStatus({ type: "success", message: "Contact entry added." });
      }

      resetPmForm();
      await loadPms();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to save contact entry.",
      });
    } finally {
      setSavingPm(false);
    }
  }

  async function handleDeletePm(pm: PmDirectoryRow) {
    if (!confirm(`Delete contact entry for ${pm.email}?`)) return;

    setDeletingPmId(pm.id);
    setStatus(null);

    try {
      const { error } = await supabase.from("pm_directory").delete().eq("id", pm.id);

      if (error) throw error;

      if (editingPm?.id === pm.id) {
        resetPmForm();
      }

      setStatus({ type: "success", message: "Contact entry deleted." });
      await loadPms();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete contact entry.",
      });
    } finally {
      setDeletingPmId(null);
    }
  }

  async function handleImport() {
    setImporting(true);
    setStatus(null);

    try {
      const res = await fetch("/api/admin/import-pm-directory", {
        method: "POST",
      });
      const json = await safeJson(res);

      if (!res.ok) {
        const rawCount = typeof json?.rawCount === "number" ? json.rawCount : null;
        setStatus({
          type: "error",
          message:
            `${typeof json?.error === "string" ? json.error : "PM import failed."}${
              rawCount !== null ? ` Graph returned ${rawCount} ${rawCount === 1 ? "user" : "users"} before filtering.` : ""
            }`,
          consentUrl: typeof json?.consentUrl === "string" ? json.consentUrl : undefined,
        });
        return;
      }

      const rawCount = typeof json?.rawCount === "number" ? json.rawCount : 0;
      const inserted = typeof json?.inserted === "number" ? json.inserted : 0;
      const updated = typeof json?.updated === "number" ? json.updated : 0;
      const skipped = typeof json?.skipped === "number" ? json.skipped : 0;

      setStatus({
        type: "success",
        message: `Graph returned ${rawCount} ${rawCount === 1 ? "user" : "users"}, imported ${inserted + updated}, skipped ${skipped}.`,
      });
      await loadPms();
    } catch {
      setStatus({
        type: "error",
        message: "PM import failed. Please try again.",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-text-primary">Contacts</h2>
          <p className="text-sm text-text-secondary">
            Stores both internal TCC staff and external customer-side contacts. Linked portal accounts are shown when `profile_id` is present.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openAddPmModal}
            className="rounded-xl border border-border-default bg-surface-raised px-4 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
          >
            Add Contact
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            className="rounded-xl border border-brand-primary/40 bg-brand-primary/10 px-4 py-1.5 text-sm font-medium text-brand-primary transition hover:bg-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? "Importing from Microsoft..." : "Import from Microsoft"}
          </button>
        </div>
      </div>

      {status && (
        <div
          className={[
            "rounded-xl border px-4 py-2.5 text-sm",
            status.type === "success"
              ? "border-status-success/30 bg-status-success/10 text-status-success"
              : "border-status-warning/30 bg-status-warning/10 text-status-warning",
          ].join(" ")}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span>{status.message}</span>
            {status.consentUrl && (
              <a
                href={status.consentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-status-warning/50 bg-status-warning/10 px-3 py-1 text-xs font-medium text-status-warning transition hover:bg-status-warning/20"
              >
                Grant Admin Consent in Azure &rarr;
              </a>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-text-tertiary">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-default">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-raised/80">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Email</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">First Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Last Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Phone</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Portal Link</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pms.map((pm) => (
                <tr key={pm.id} className="border-b border-border-default hover:bg-surface-raised">
                  <td className="px-4 py-2.5 text-text-primary">{pm.email}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{pm.first_name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{pm.last_name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{pm.phone ? formatPhone(pm.phone) : "-"}</td>
                  <td className="px-4 py-2.5">
                    {pm.profile_id ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex w-fit rounded-full bg-status-success/10 px-2.5 py-0.5 text-xs font-medium text-status-success">
                          Linked Portal Account
                        </span>
                        <span className="text-xs text-text-secondary">{pm.profile?.full_name ?? pm.profile_id}</span>
                      </div>
                    ) : pm.email.toLowerCase().endsWith("@controlsco.net") ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex w-fit rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-medium text-brand-primary">
                          Internal - Not Yet Signed In
                        </span>
                        {(pm.intended_role ?? pm.profile?.role) && (
                          <span className="text-xs text-text-secondary">
                            Intended role: {pm.intended_role ?? pm.profile?.role}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex rounded-full bg-surface-overlay px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                        External
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditPmModal(pm)}
                        className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-raised hover:text-text-primary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePm(pm)}
                        disabled={deletingPmId === pm.id}
                        className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-1.5 text-xs font-medium text-status-danger transition hover:bg-status-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingPmId === pm.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(isAddingPm || editingPm) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-default bg-surface-raised p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {editingPm ? "Edit Contact Entry" : "Add Contact Entry"}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {editingPm?.profile_id
                    ? "This entry is linked to a portal account. Editing email may affect future auto-linking."
                    : "Use this for external contacts or internal staff not yet linked to a portal account."}
                </p>
              </div>
              <button
                onClick={() => {
                  resetPmForm();
                  setStatus(null);
                }}
                className="rounded-lg px-2 py-1 text-text-tertiary transition hover:bg-surface-overlay hover:text-text-primary"
              >
                x
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">First Name</label>
                  <input
                    type="text"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Last Name</label>
                  <input
                    type="text"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Phone</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(formatPhone(e.target.value))}
                    className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                  />
                </div>
              </div>

              {formEmail.trim().toLowerCase().endsWith("@controlsco.net") && !editingPm?.profile_id && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as InternalContactRole)}
                    className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                  >
                    {INTERNAL_CONTACT_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-text-tertiary">
                    If this user has not signed in yet, the selected role will be applied automatically after their first login.
                  </p>
                </div>
              )}

              {editingPm?.profile_id && (
                <div className="rounded-xl border border-status-success/20 bg-status-success/10 px-3 py-2 text-sm text-status-success">
                  Linked portal account: {editingPm.profile?.full_name ?? editingPm.profile_id}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  resetPmForm();
                  setStatus(null);
                }}
                className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePm}
                disabled={savingPm}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingPm ? "Saving..." : editingPm ? "Save Changes" : "Add Contact"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
