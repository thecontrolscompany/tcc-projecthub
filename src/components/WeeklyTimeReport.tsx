'use client';

import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays } from 'date-fns';

interface Project {
  id: string;
  name: string;
  customer_id: string;
  customers?: {
    name: string;
  } | null;
}

interface TimeEntry {
  id: string;
  employee_name: string;
  work_date: string;
  hours: number;
  system_category: string;
  notes: string;
  approved: boolean;
}

interface WeeklyReport {
  week_of: string;
  project_id: string;
  summary: {
    num_employees: number;
    total_hours: number;
    num_entries: number;
    fully_approved: boolean;
  } | null;
  time_entries: TimeEntry[];
  approval: any;
}

interface WeeklyTimeReportProps {
  projects: Project[];
  userRole?: string;
}

export default function WeeklyTimeReport({ projects, userRole }: WeeklyTimeReportProps) {
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(format(startOfWeek(new Date()), 'yyyy-MM-dd'));
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);

  const loadReport = async () => {
    if (!selectedProject) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/time/weekly-report?projectId=${selectedProject}&weekOf=${selectedWeek}`);
      const data = await response.json();
      setReport(data);
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedProject, selectedWeek]);

  const handleApprove = async () => {
    if (!selectedProject) return;

    setApproving(true);
    try {
      const response = await fetch('/api/time/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: selectedProject,
          week_of: selectedWeek,
        }),
      });

      if (response.ok) {
        await loadReport(); // Reload the report
      } else {
        console.error('Failed to approve time');
      }
    } catch (error) {
      console.error('Approval error:', error);
    } finally {
      setApproving(false);
    }
  };

  const weekDays = [];
  const weekStart = new Date(selectedWeek);
  for (let i = 0; i < 7; i++) {
    weekDays.push(addDays(weekStart, i));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="project" className="block text-sm font-medium text-gray-700">
            Project
          </label>
          <select
            id="project"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
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
          <label htmlFor="week" className="block text-sm font-medium text-gray-700">
            Week Of
          </label>
          <input
            type="date"
            id="week"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>

      {loading && <p className="text-gray-500">Loading report...</p>}

      {report && (
        <div className="space-y-4">
          {/* Summary */}
          {report.summary && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Week Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Employees:</span>
                  <span className="ml-2 font-medium">{report.summary.num_employees}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Hours:</span>
                  <span className="ml-2 font-medium">{report.summary.total_hours}</span>
                </div>
                <div>
                  <span className="text-gray-600">Entries:</span>
                  <span className="ml-2 font-medium">{report.summary.num_entries}</span>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span className={`ml-2 font-medium ${report.summary.fully_approved ? 'text-green-600' : 'text-orange-600'}`}>
                    {report.summary.fully_approved ? 'Approved' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Time Entries */}
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">Time Entries</h3>
            {report.time_entries.length === 0 ? (
              <p className="text-gray-500 text-sm">No time entries for this week</p>
            ) : (
              <div className="space-y-2">
                {report.time_entries.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <span className="font-medium text-gray-900">{entry.employee_name}</span>
                        <span className="text-sm text-gray-600">{format(new Date(entry.work_date), 'EEE, MMM d')}</span>
                        <span className="text-sm font-medium text-blue-600">{entry.hours}h</span>
                        {entry.system_category && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {entry.system_category}
                          </span>
                        )}
                      </div>
                      {entry.notes && (
                        <p className="text-sm text-gray-600 mt-1">{entry.notes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {entry.approved ? (
                        <span className="text-xs text-green-600 font-medium">Approved</span>
                      ) : (
                        <span className="text-xs text-orange-600 font-medium">Pending</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Approval Button */}
          {userRole === 'pm' && report.time_entries.length > 0 && !report.summary?.fully_approved && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {approving ? 'Approving...' : 'Approve All Time Entries'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
