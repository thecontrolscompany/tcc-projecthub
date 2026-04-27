"use client";

import { useState, useEffect, useRef } from "react";
import type {
  CrmContact, CrmContactRoleType, CrmContactMethod,
  CrmInfluenceLevel, CrmBuyingRole, CrmConfidenceLevel,
} from "@/types/database";

type EditableContact = Pick<
  CrmContact,
  "id" | "first_name" | "last_name" | "display_name" | "role_type" | "title" |
  "email" | "phone" | "mobile" | "location" | "preferred_contact_method" |
  "influence_level" | "buying_role" | "notes" | "is_active" | "confidence_level" |
  "issues_purchase_orders" | "involved_in_estimating" | "involved_in_project_execution"
>;

type ContactEditModalProps = {
  contact: EditableContact;
  accountName?: string;
  onSaved: (updated: EditableContact) => void;
  onDeleted?: (id: string) => void;
  onClose: () => void;
};

const INPUT = "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";
const LABEL = "block text-xs font-medium text-text-secondary mb-1";

const ROLE_OPTIONS: Array<{ value: CrmContactRoleType; label: string }> = [
  { value: "salesperson",            label: "Salesperson" },
  { value: "sales_manager",          label: "Sales Manager" },
  { value: "estimator",              label: "Estimator" },
  { value: "project_manager",        label: "Project Manager" },
  { value: "senior_project_manager", label: "Senior Project Manager" },
  { value: "operations_manager",     label: "Operations Manager" },
  { value: "owner",                  label: "Owner" },
  { value: "cfo",                    label: "CFO" },
  { value: "cfo_estimator",          label: "CFO / Estimator" },
  { value: "unknown",                label: "Unknown" },
];

const INFLUENCE_OPTIONS: Array<{ value: CrmInfluenceLevel; label: string }> = [
  { value: "high",    label: "High" },
  { value: "medium",  label: "Medium" },
  { value: "low",     label: "Low" },
  { value: "unknown", label: "Unknown" },
];

const BUYING_ROLE_OPTIONS: Array<{ value: CrmBuyingRole; label: string }> = [
  { value: "decision_maker", label: "Decision Maker" },
  { value: "influencer",     label: "Influencer" },
  { value: "evaluator",      label: "Evaluator" },
  { value: "user",           label: "User" },
  { value: "gatekeeper",     label: "Gatekeeper" },
  { value: "unknown",        label: "Unknown" },
];

const CONFIDENCE_OPTIONS: Array<{ value: CrmConfidenceLevel; label: string }> = [
  { value: "confirmed",           label: "Confirmed" },
  { value: "partially_confirmed", label: "Partially confirmed" },
  { value: "needs_verification",  label: "Needs verification" },
];

const CONTACT_METHOD_OPTIONS: Array<{ value: CrmContactMethod; label: string }> = [
  { value: "email",     label: "Email" },
  { value: "phone",     label: "Phone" },
  { value: "mobile",    label: "Mobile" },
  { value: "in_person", label: "In person" },
];

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-border-default"
      />
      {label}
    </label>
  );
}

export function ContactEditModal({ contact, accountName, onSaved, onDeleted, onClose }: ContactEditModalProps) {
  const [firstName,        setFirstName]        = useState(contact.first_name ?? "");
  const [lastName,         setLastName]          = useState(contact.last_name ?? "");
  const [displayName,      setDisplayName]       = useState(contact.display_name);
  const [roleType,         setRoleType]          = useState<CrmContactRoleType>(contact.role_type);
  const [title,            setTitle]             = useState(contact.title ?? "");
  const [email,            setEmail]             = useState(contact.email ?? "");
  const [phone,            setPhone]             = useState(contact.phone ?? "");
  const [mobile,           setMobile]            = useState(contact.mobile ?? "");
  const [location,         setLocation]          = useState(contact.location ?? "");
  const [preferredMethod,  setPreferredMethod]   = useState<CrmContactMethod>(contact.preferred_contact_method);
  const [influenceLevel,   setInfluenceLevel]    = useState<CrmInfluenceLevel>(contact.influence_level);
  const [buyingRole,       setBuyingRole]        = useState<CrmBuyingRole>(contact.buying_role);
  const [confidenceLevel,  setConfidenceLevel]   = useState<CrmConfidenceLevel>(contact.confidence_level);
  const [notes,            setNotes]             = useState(contact.notes ?? "");
  const [isActive,         setIsActive]          = useState(contact.is_active);
  const [issuesPo,         setIssuesPo]          = useState(contact.issues_purchase_orders);
  const [involvedEst,      setInvolvedEst]       = useState(contact.involved_in_estimating);
  const [involvedExec,     setInvolvedExec]      = useState(contact.involved_in_project_execution);

  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  // Auto-build display name when first/last change, only if it looks auto-generated
  useEffect(() => {
    const auto = [firstName, lastName].filter(Boolean).join(" ");
    if (auto && (displayName === contact.display_name || displayName === [contact.first_name, contact.last_name].filter(Boolean).join(" "))) {
      setDisplayName(auto);
    }
  }, [firstName, lastName]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) { setError("Display name is required."); return; }
    setError(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/crm/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name:                   firstName  || null,
          last_name:                    lastName   || null,
          display_name:                 displayName.trim(),
          role_type:                    roleType,
          title:                        title      || null,
          email:                        email      || null,
          phone:                        phone      || null,
          mobile:                       mobile     || null,
          location:                     location   || null,
          preferred_contact_method:     preferredMethod,
          influence_level:              influenceLevel,
          buying_role:                  buyingRole,
          confidence_level:             confidenceLevel,
          notes:                        notes      || null,
          is_active:                    isActive,
          issues_purchase_orders:       issuesPo,
          involved_in_estimating:       involvedEst,
          involved_in_project_execution: involvedExec,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      onSaved(json.contact as EditableContact);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border-default bg-surface-raised shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-default bg-surface-raised px-6 py-4">
          <div>
            <h2 className="font-semibold text-text-primary">Edit Contact</h2>
            {accountName && <p className="text-xs text-text-tertiary">{accountName}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-tertiary hover:bg-surface-overlay hover:text-text-primary"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-5">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>First Name</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Last Name</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={INPUT} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Display Name *</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={INPUT}
              required
            />
            <p className="mt-1 text-xs text-text-tertiary">Shown in all lists and badges.</p>
          </div>

          {/* Role + Title */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Role Type</label>
              <select value={roleType} onChange={(e) => setRoleType(e.target.value as CrmContactRoleType)} className={INPUT}>
                {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Estimator" className={INPUT} />
            </div>
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Mobile</label>
              <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="(555) 000-0000" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Location / Office</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Birmingham, AL" className={INPUT} />
            </div>
          </div>

          {/* Relationship fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Influence Level</label>
              <select value={influenceLevel} onChange={(e) => setInfluenceLevel(e.target.value as CrmInfluenceLevel)} className={INPUT}>
                {INFLUENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Buying Role</label>
              <select value={buyingRole} onChange={(e) => setBuyingRole(e.target.value as CrmBuyingRole)} className={INPUT}>
                {BUYING_ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Preferred Contact</label>
              <select value={preferredMethod} onChange={(e) => setPreferredMethod(e.target.value as CrmContactMethod)} className={INPUT}>
                {CONTACT_METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Confidence */}
          <div>
            <label className={LABEL}>Data Confidence</label>
            <select value={confidenceLevel} onChange={(e) => setConfidenceLevel(e.target.value as CrmConfidenceLevel)} className={INPUT}>
              {CONFIDENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Boolean flags */}
          <div className="rounded-xl border border-border-default bg-surface-overlay px-4 py-3 space-y-2">
            <p className={LABEL}>Flags</p>
            <CheckRow label="Issues purchase orders"        checked={issuesPo}     onChange={setIssuesPo} />
            <CheckRow label="Involved in estimating"        checked={involvedEst}  onChange={setInvolvedEst} />
            <CheckRow label="Involved in project execution" checked={involvedExec} onChange={setInvolvedExec} />
            <CheckRow label="Active contact"                checked={isActive}     onChange={setIsActive} />
          </div>

          {/* Notes */}
          <div>
            <label className={LABEL}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any context about this contact — how they prefer to work, relationship notes, etc."
              className={`${INPUT} resize-none`}
            />
          </div>

          {error && <p className="text-sm text-status-danger">{error}</p>}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-border-default pt-4">
            {/* Delete — left side */}
            <div>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-xl px-3 py-2 text-sm text-status-danger hover:bg-status-danger/10 transition"
                >
                  Delete contact
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-status-danger font-medium">Delete permanently?</span>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={async () => {
                      setDeleting(true);
                      try {
                        const res = await fetch(`/api/crm/contacts/${contact.id}`, { method: "DELETE" });
                        if (res.ok) {
                          onDeleted?.(contact.id);
                          onClose();
                        } else {
                          const json = await res.json();
                          setError(json.error ?? "Delete failed.");
                          setConfirmDelete(false);
                        }
                      } finally {
                        setDeleting(false);
                      }
                    }}
                    className="rounded-xl bg-status-danger px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {deleting ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-sm text-text-tertiary hover:text-text-primary"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Save / Close — right side */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border-default px-4 py-2 text-sm text-text-secondary transition hover:bg-surface-overlay"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !displayName.trim()}
                className="rounded-xl bg-brand-primary px-5 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Contact"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
