"use client";

import type { CrmTask, CrmTaskStatus } from "@/types/database";
import { CRM_TASK_PRIORITY_BADGES, CRM_TASK_PRIORITY_LABELS, fmtCrmDate } from "@/lib/crm/utils";

type TaskWidgetProps = {
  tasks: CrmTask[];
  onStatusToggle?: (taskId: string, newStatus: CrmTaskStatus) => Promise<void>;
  compact?: boolean;
  emptyMessage?: string;
};

export function TaskWidget({ tasks, onStatusToggle, compact = false, emptyMessage = "No open tasks." }: TaskWidgetProps) {
  if (tasks.length === 0) {
    return <p className="py-4 text-center text-sm text-text-tertiary">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const isPastDue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "completed";

        return (
          <div
            key={task.id}
            className={[
              "flex items-start gap-3 rounded-xl border border-border-default bg-surface-raised p-3",
              task.status === "completed" ? "opacity-60" : "",
            ].join(" ")}
          >
            {onStatusToggle && (
              <button
                onClick={() =>
                  onStatusToggle(
                    task.id,
                    task.status === "completed" ? "open" : "completed"
                  )
                }
                className={[
                  "mt-0.5 h-4 w-4 shrink-0 rounded border-2 transition",
                  task.status === "completed"
                    ? "border-status-success bg-status-success"
                    : "border-border-default hover:border-brand-primary",
                ].join(" ")}
                title={task.status === "completed" ? "Mark open" : "Mark complete"}
              >
                {task.status === "completed" && (
                  <svg viewBox="0 0 12 12" className="text-white h-3 w-3">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-sm font-medium ${task.status === "completed" ? "line-through text-text-tertiary" : "text-text-primary"}`}>
                  {task.title}
                </span>
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${CRM_TASK_PRIORITY_BADGES[task.priority]}`}>
                  {CRM_TASK_PRIORITY_LABELS[task.priority]}
                </span>
              </div>

              {!compact && task.description && (
                <p className="mt-0.5 text-xs text-text-secondary">{task.description}</p>
              )}

              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-tertiary">
                {task.due_date && (
                  <span className={isPastDue ? "text-status-danger font-medium" : ""}>
                    Due: {fmtCrmDate(task.due_date)}{isPastDue ? " (overdue)" : ""}
                  </span>
                )}
                {!compact && task.assigned_to && (
                  <span>Assigned: {task.assigned_to.full_name ?? task.assigned_to.email}</span>
                )}
                {!compact && task.account && (
                  <span>· {task.account.company_name}</span>
                )}
                {!compact && task.opportunity && (
                  <span>· {task.opportunity.opportunity_number}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
