'use client';

import { useState } from 'react';
import { format } from 'date-fns';

interface Project {
  id: string;
  name: string;
  customer_id: string;
  customers?: {
    name: string;
  } | null;
}

interface TimeEntryFormProps {
  projects: Project[];
  userRole?: string;
}

type NoticeState =
  | {
      type: 'success' | 'error';
      text: string;
    }
  | null;

const fieldClassName =
  'w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none';

export default function TimeEntryForm({ projects }: TimeEntryFormProps) {
  const [formData, setFormData] = useState({
    project_id: '',
    work_date: format(new Date(), 'yyyy-MM-dd'),
    hours: '',
    notes: '',
    system_category: '',
    billable: true
  });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNotice(null);

    try {
      const response = await fetch('/api/time/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          hours: parseFloat(formData.hours)
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setNotice({ type: 'success', text: 'Time entry saved successfully.' });
        setFormData((prev) => ({
          ...prev,
          hours: '',
          notes: '',
          system_category: ''
        }));
      } else {
        setNotice({ type: 'error', text: result.error || 'Failed to save time entry.' });
      }
    } catch {
      setNotice({ type: 'error', text: 'An error occurred while saving.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  return (
    <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Time Entry</p>
      <h2 className="mt-2 text-2xl font-semibold text-text-primary">Log hours</h2>
      <p className="mt-2 text-sm leading-6 text-text-secondary">
        Enter labor against an assigned project and keep weekly approvals moving.
      </p>

      {projects.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-border-default bg-surface-overlay px-4 py-5 text-center text-sm text-text-secondary">
          No projects are assigned to your account yet.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="project_id" className="text-sm font-medium text-text-primary">
              Project
            </label>
            <select
              id="project_id"
              name="project_id"
              value={formData.project_id}
              onChange={handleChange}
              required
              className={`${fieldClassName} mt-2`}
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.customers?.name ? `${project.customers.name} - ` : ''}{project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="work_date" className="text-sm font-medium text-text-primary">
                Work Date
              </label>
              <input
                type="date"
                id="work_date"
                name="work_date"
                value={formData.work_date}
                onChange={handleChange}
                required
                className={`${fieldClassName} mt-2`}
              />
            </div>

            <div>
              <label htmlFor="hours" className="text-sm font-medium text-text-primary">
                Hours
              </label>
              <input
                type="number"
                id="hours"
                name="hours"
                value={formData.hours}
                onChange={handleChange}
                min="0.25"
                max="24"
                step="0.25"
                required
                className={`${fieldClassName} mt-2`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="system_category" className="text-sm font-medium text-text-primary">
              System Category
            </label>
            <select
              id="system_category"
              name="system_category"
              value={formData.system_category}
              onChange={handleChange}
              className={`${fieldClassName} mt-2`}
            >
              <option value="">Select category (optional)</option>
              <option value="VAV">VAV Systems</option>
              <option value="AHU">Air Handling Units</option>
              <option value="FCU">Fan Coil Units</option>
              <option value="Electrical">Electrical</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Controls">Controls</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="notes" className="text-sm font-medium text-text-primary">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              className={`${fieldClassName} mt-2`}
              placeholder="Optional notes about the work performed"
            />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-border-default bg-surface-overlay px-4 py-3">
            <input
              type="checkbox"
              id="billable"
              name="billable"
              checked={formData.billable}
              onChange={handleChange}
              className="h-4 w-4 rounded border-border-default bg-surface-raised text-brand-primary focus:ring-brand-primary"
            />
            <span className="text-sm font-medium text-text-primary">Billable time</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover disabled:opacity-60"
          >
            {loading ? 'Saving...' : 'Save Time Entry'}
          </button>

          {notice?.type === 'success' && (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {notice.text}
            </p>
          )}

          {notice?.type === 'error' && (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {notice.text}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
