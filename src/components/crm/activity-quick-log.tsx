"use client";

import { useState } from "react";
import { z } from "zod";
import type { CrmActivity, CrmActivityType } from "@/types/database";
import { CRM_ACTIVITY_TYPE_LABELS } from "@/lib/crm/utils";

type ActivityQuickLogProps = {
  accountId?: string;
  contactId?: string;
  opportunityId?: string;
  onLogged?: (activity: CrmActivity) => void;
};

const ACTIVITY_TYPES: CrmActivityType[] = [
  "meeting", "call", "email", "site_visit", "lunch",
  "estimate_request", "proposal_followup", "pm_handoff", "other",
];

const schema = z.object({
  activity_type: z.string().min(1),
  activity_date: z.string().min(1),
  summary: z.string().min(1, "Summary is required"),
  key_decisions: z.string().optional(),
  follow_up_actions: z.string().optional(),
  follow_up_due_date: z.string().optional(),
  attendees_text: z.string().optional(),
});

const INPUT = "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";
const LABEL = "block text-xs font-medium text-text-secondary mb-1";

export function ActivityQuickLog({ accountId, contactId, opportunityId, onLogged }: ActivityQuickLogProps) {
  const today = new Date().toISOString().slice(0, 10);

  const [activityType, setActivityType] = useState<CrmActivityType>("call");
  const [activityDate, setActivityDate] = useState(today);
  const [summary, setSummary] = useState("");
  const [keyDecisions, setKeyDecisions] = useState("");
  const [followUpActions, setFollowUpActions] = useState("");
  const [followUpDueDate, setFollowUpDueDate] = useState("");
  const [attendeesText, setAttendeesText] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = schema.safeParse({
      activity_type: activityType,
      activity_date: activityDate,
      summary,
      key_decisions: keyDecisions || undefined,
      follow_up_actions: followUpActions || undefined,
      follow_up_due_date: followUpDueDate || undefined,
      attendees_text: attendeesText || undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Validation error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          account_id: accountId ?? null,
          contact_id: contactId ?? null,
          opportunity_id: opportunityId ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to log activity");

      setSummary("");
      setKeyDecisions("");
      setFollowUpActions("");
      setFollowUpDueDate("");
      setAttendeesText("");
      setShowDetails(false);
      onLogged?.(json.activity as CrmActivity);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border-default bg-surface-raised p-4 space-y-3">
      <h4 className="text-sm font-semibold text-text-primary">Log Activity</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Type</label>
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value as CrmActivityType)}
            className={INPUT}
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>{CRM_ACTIVITY_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>Date</label>
          <input
            type="date"
            value={activityDate}
            onChange={(e) => setActivityDate(e.target.value)}
            className={INPUT}
          />
        </div>
      </div>

      <div>
        <label className={LABEL}>Summary *</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Brief summary of the interaction..."
          rows={2}
          className={`${INPUT} resize-none`}
        />
      </div>

      <button
        type="button"
        onClick={() => setShowDetails((p) => !p)}
        className="text-xs text-brand-primary hover:underline"
      >
        {showDetails ? "− Hide details" : "+ Add attendees / decisions / follow-up"}
      </button>

      {showDetails && (
        <div className="space-y-3 border-t border-border-default pt-3">
          <div>
            <label className={LABEL}>Attendees</label>
            <input
              type="text"
              value={attendeesText}
              onChange={(e) => setAttendeesText(e.target.value)}
              placeholder="Jack Heaney, Timothy Collins"
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>Key Decisions</label>
            <textarea
              value={keyDecisions}
              onChange={(e) => setKeyDecisions(e.target.value)}
              rows={2}
              className={`${INPUT} resize-none`}
            />
          </div>
          <div>
            <label className={LABEL}>Follow-up Actions</label>
            <textarea
              value={followUpActions}
              onChange={(e) => setFollowUpActions(e.target.value)}
              rows={2}
              className={`${INPUT} resize-none`}
            />
          </div>
          <div>
            <label className={LABEL}>Follow-up Due Date</label>
            <input
              type="date"
              value={followUpDueDate}
              onChange={(e) => setFollowUpDueDate(e.target.value)}
              className={INPUT}
            />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-status-danger">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !summary.trim()}
        className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-60"
      >
        {submitting ? "Logging…" : "Log Activity"}
      </button>
    </form>
  );
}
