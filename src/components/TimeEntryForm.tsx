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

export default function TimeEntryForm({ projects, userRole }: TimeEntryFormProps) {
  const [formData, setFormData] = useState({
    project_id: '',
    work_date: format(new Date(), 'yyyy-MM-dd'),
    hours: '',
    notes: '',
    system_category: '',
    billable: true
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

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
        setMessage('Time entry saved successfully!');
        // Reset form
        setFormData({
          ...formData,
          hours: '',
          notes: '',
          system_category: ''
        });
      } else {
        setMessage(result.error || 'Failed to save time entry');
      }
    } catch (error) {
      setMessage('An error occurred while saving');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="project_id" className="block text-sm font-medium text-gray-700">
          Project
        </label>
        <select
          id="project_id"
          name="project_id"
          value={formData.project_id}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">Select a project</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.customers?.name} - {project.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="work_date" className="block text-sm font-medium text-gray-700">
          Work Date
        </label>
        <input
          type="date"
          id="work_date"
          name="work_date"
          value={formData.work_date}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="hours" className="block text-sm font-medium text-gray-700">
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
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="system_category" className="block text-sm font-medium text-gray-700">
          System Category
        </label>
        <select
          id="system_category"
          name="system_category"
          value={formData.system_category}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Optional notes about the work performed"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="billable"
          name="billable"
          checked={formData.billable}
          onChange={handleChange}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="billable" className="ml-2 block text-sm text-gray-900">
          Billable time
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Time Entry'}
      </button>

      {message && (
        <p className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </form>
  );
}
