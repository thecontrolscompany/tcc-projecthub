"use client";

import { useState } from "react";

type FeedbackType = "bug" | "feature" | "ux" | "other";
type FeedbackPriority = "low" | "medium" | "high";

const TYPE_OPTIONS: Array<{ value: FeedbackType; label: string }> = [
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Idea" },
  { value: "ux", label: "UX Issue" },
  { value: "other", label: "Other" },
];

const PRIORITY_OPTIONS: Array<{ value: FeedbackPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export default function FeedbackPage() {
  const [type, setType] = useState<FeedbackType>("bug");
  const [priority, setPriority] = useState<FeedbackPriority>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pageArea, setPageArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type,
          title,
          description,
          priority,
          page_area: pageArea,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Unable to submit feedback.");
      }

      setTitle("");
      setDescription("");
      setPageArea("");
      setType("bug");
      setPriority("medium");
      setStatus("Feedback submitted. Thank you.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit feedback.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Portal Feedback</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Submit Feedback</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Report a bug, suggest a feature, or share an idea.
        </p>
      </div>

      {status && (
        <div className="rounded-2xl border border-status-success/30 bg-status-success/10 px-5 py-4 text-sm text-status-success">
          {status}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 px-5 py-4 text-sm text-status-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border-default bg-surface-raised p-6">
        <Field label="Type">
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={[
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  type === option.value
                    ? "bg-brand-primary text-text-inverse"
                    : "border border-border-default bg-surface-overlay text-text-secondary hover:bg-surface-base hover:text-text-primary",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
            className="w-full rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
          />
        </Field>

        <Field label="Priority">
          <div className="flex flex-wrap gap-2">
            {PRIORITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPriority(option.value)}
                className={[
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  priority === option.value
                    ? "bg-brand-primary text-text-inverse"
                    : "border border-border-default bg-surface-overlay text-text-secondary hover:bg-surface-base hover:text-text-primary",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Page/Area">
          <input
            value={pageArea}
            onChange={(e) => setPageArea(e.target.value)}
            placeholder="PM Portal, Billing Table, Customer Portal..."
            className="w-full rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
          />
        </Field>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-60"
        >
          {saving ? "Submitting..." : "Submit Feedback"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}
