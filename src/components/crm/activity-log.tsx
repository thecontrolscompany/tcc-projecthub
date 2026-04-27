"use client";

import { useState } from "react";
import type { CrmActivity } from "@/types/database";
import { CRM_ACTIVITY_TYPE_LABELS, fmtCrmDate, daysSince } from "@/lib/crm/utils";

type ActivityLogProps = {
  activities: CrmActivity[];
  showAccount?: boolean;
  showOpportunity?: boolean;
  emptyMessage?: string;
};

const ACTIVITY_ICONS: Record<string, string> = {
  meeting: "🤝",
  call: "📞",
  email: "✉️",
  site_visit: "🏗️",
  lunch: "🍽️",
  estimate_request: "📋",
  proposal_followup: "📄",
  pm_handoff: "🔄",
  other: "💬",
};

export function ActivityLog({
  activities,
  showAccount = false,
  showOpportunity = false,
  emptyMessage = "No activities logged yet.",
}: ActivityLogProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (activities.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-tertiary">{emptyMessage}</p>
    );
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="relative space-y-0">
      {/* vertical timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border-default" />

      {activities.map((activity) => {
        const isOpen = expanded.has(activity.id);
        const hasDetails = activity.key_decisions || activity.follow_up_actions || activity.attendees_text;
        const followUpOverdue =
          activity.follow_up_due_date && new Date(activity.follow_up_due_date) < new Date();

        return (
          <div key={activity.id} className="relative pl-10">
            {/* dot */}
            <div className="absolute left-2.5 top-3 h-3 w-3 rounded-full border-2 border-brand-primary bg-surface-raised" />

            <div
              className={[
                "mb-4 rounded-xl border border-border-default bg-surface-raised p-4",
                hasDetails ? "cursor-pointer hover:border-brand-primary/30" : "",
              ].join(" ")}
              onClick={() => hasDetails && toggle(activity.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">
                    {ACTIVITY_ICONS[activity.activity_type] ?? "💬"}
                  </span>
                  <div>
                    <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
                      {CRM_ACTIVITY_TYPE_LABELS[activity.activity_type]}
                    </span>
                    {showAccount && activity.account && (
                      <span className="ml-2 text-xs text-text-tertiary">
                        · {activity.account.company_name}
                      </span>
                    )}
                    {showOpportunity && activity.opportunity && (
                      <span className="ml-2 text-xs text-text-tertiary">
                        · {activity.opportunity.opportunity_number}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-text-tertiary">
                  {fmtCrmDate(activity.activity_date)}
                </span>
              </div>

              <p className="mt-2 text-sm text-text-primary">{activity.summary}</p>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary">
                {activity.logged_by && (
                  <span>Logged by {activity.logged_by.full_name ?? activity.logged_by.email}</span>
                )}
                {activity.contact && <span>· {activity.contact.display_name}</span>}
                {activity.follow_up_due_date && (
                  <span className={followUpOverdue ? "text-status-danger font-medium" : ""}>
                    · Follow-up: {fmtCrmDate(activity.follow_up_due_date)}
                    {followUpOverdue ? " (overdue)" : ""}
                  </span>
                )}
                {hasDetails && (
                  <span className="ml-auto text-brand-primary">
                    {isOpen ? "▲ Less" : "▼ More"}
                  </span>
                )}
              </div>

              {isOpen && hasDetails && (
                <div className="mt-3 space-y-3 border-t border-border-default pt-3">
                  {activity.attendees_text && (
                    <div>
                      <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Attendees</span>
                      <p className="mt-0.5 text-sm text-text-secondary">{activity.attendees_text}</p>
                    </div>
                  )}
                  {activity.key_decisions && (
                    <div>
                      <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Key Decisions</span>
                      <p className="mt-0.5 text-sm text-text-secondary whitespace-pre-wrap">{activity.key_decisions}</p>
                    </div>
                  )}
                  {activity.follow_up_actions && (
                    <div>
                      <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Follow-up Actions</span>
                      <p className="mt-0.5 text-sm text-text-secondary whitespace-pre-wrap">{activity.follow_up_actions}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
