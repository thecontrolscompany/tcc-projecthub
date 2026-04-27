"use client";

import { useState, useEffect, useCallback } from "react";
import type { CrmTask, CrmTaskStatus, CrmTaskPriority } from "@/types/database";
import { CrmSubnav } from "@/components/crm/crm-subnav";
import { TaskWidget } from "@/components/crm/task-widget";
import { CRM_TASK_PRIORITY_LABELS } from "@/lib/crm/utils";

const INPUT = "rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";
const LABEL = "block text-xs font-medium text-text-secondary mb-1";

export default function TasksPage() {
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("admin");
  const [priorityFilter, setPriorityFilter] = useState<CrmTaskPriority | "">("");
  const [dueThisWeek, setDueThisWeek] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<CrmTaskPriority>("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dueThisWeek) params.set("due_this_week", "true");
    const res = await fetch(`/api/crm/tasks?${params}`);
    const json = await res.json();
    setTasks(json.tasks ?? []);
    setLoading(false);
  }, [dueThisWeek]);

  useEffect(() => {
    void loadTasks();
    fetch("/api/crm/accounts").then((r) => r.json()).then(() => {
      // Just need the role from a protected endpoint response header
      // Actually get role from profile
    });
    // Get role
    fetch("/api/crm/dashboard").then((r) => {
      if (r.ok) setRole("admin");
    });
  }, [loadTasks]);

  const filtered = tasks.filter((t) => {
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });

  async function handleStatusToggle(taskId: string, newStatus: CrmTaskStatus) {
    await fetch(`/api/crm/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setTasks((prev) =>
      newStatus === "completed"
        ? prev.filter((t) => t.id !== taskId)
        : prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t)
    );
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/crm/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        priority: newPriority,
        due_date: newDueDate || null,
        description: newDescription || null,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      setTasks((prev) => [json.task, ...prev]);
      setNewTitle("");
      setNewPriority("medium");
      setNewDueDate("");
      setNewDescription("");
      setShowNewForm(false);
    }
    setSubmitting(false);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <CrmSubnav role={role} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Tasks</h1>
          <p className="text-sm text-text-tertiary">{filtered.length} open tasks</p>
        </div>
        <button
          onClick={() => setShowNewForm((p) => !p)}
          className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover"
        >
          + New Task
        </button>
      </div>

      {showNewForm && (
        <form onSubmit={handleCreateTask} className="mb-6 rounded-2xl border border-border-default bg-surface-raised p-5 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">New Task</h3>
          <div>
            <label className={LABEL}>Title *</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Follow up with Jack Heaney"
              className={`${INPUT} w-full`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Priority</label>
              <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as CrmTaskPriority)} className={`${INPUT} w-full`}>
                {(["low", "medium", "high", "urgent"] as CrmTaskPriority[]).map((p) => (
                  <option key={p} value={p}>{CRM_TASK_PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Due Date</label>
              <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className={`${INPUT} w-full`} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Description</label>
            <input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className={`${INPUT} w-full`} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting || !newTitle.trim()} className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse disabled:opacity-60">
              {submitting ? "Creating…" : "Create Task"}
            </button>
            <button type="button" onClick={() => setShowNewForm(false)} className="rounded-xl border border-border-default px-4 py-2 text-sm text-text-secondary hover:bg-surface-overlay">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mb-5 flex flex-wrap gap-3 items-center">
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as CrmTaskPriority | "")} className={INPUT}>
          <option value="">All Priorities</option>
          {(["urgent", "high", "medium", "low"] as CrmTaskPriority[]).map((p) => (
            <option key={p} value={p}>{CRM_TASK_PRIORITY_LABELS[p]}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-text-secondary cursor-pointer">
          <input type="checkbox" checked={dueThisWeek} onChange={(e) => setDueThisWeek(e.target.checked)} className="rounded" />
          Due this week
        </label>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-text-tertiary">Loading tasks…</p>
      ) : (
        <TaskWidget tasks={filtered} onStatusToggle={handleStatusToggle} />
      )}
    </div>
  );
}
