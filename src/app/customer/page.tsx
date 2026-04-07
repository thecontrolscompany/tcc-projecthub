"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { ErrorBoundary } from "@/components/error-boundary";
import { ViewReportLink } from "@/components/view-report-link";
import type { BillingPeriod, CrewLogEntry, WeeklyUpdate } from "@/types/database";

interface CustomerChangeOrder {
  id: string;
  project_id: string;
  co_number: string;
  title: string;
  amount: number;
  status: string;
  submitted_date: string | null;
  approved_date: string | null;
  reference_doc: string | null;
}

interface CustomerProject {
  id: string;
  name: string;
  estimated_income: number;
  job_number: string | null;
  site_address: string | null;
  general_contractor: string | null;
  start_date: string | null;
  scheduled_completion: string | null;
  scope_description: string | null;
  customer_name: string | null;
  billing_periods: BillingPeriod[];
  weekly_updates: WeeklyUpdate[];
  team_members: ProjectTeamMember[];
  change_orders: CustomerChangeOrder[];
  photo_count: number;
}

type ProjectTeamMember = {
  role_on_project: "pm" | "lead";
  profile?: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  pm_directory?:
    | { first_name: string | null; last_name: string | null; email: string; phone: string | null }
    | { first_name: string | null; last_name: string | null; email: string; phone: string | null }[]
    | null;
};

const PAGE_BG = "#f0faf9";
const HEADER_BG = "#017a6f";
const ACCENT = "#20b2aa";
const BORDER = "#b2dfdb";
const CHARCOAL = "#2d3748";

export default function CustomerPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<CustomerProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<CustomerProject | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  useEffect(() => {
    void loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProjects() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setProjects([]);
        return;
      }

      setUserEmail(user.email ?? "");
      setUserId(user.id);

      const response = await fetch("/api/customer/data?section=projects", {
        credentials: "include",
      });
      const json = await response.json();

      if (!response.ok) {
        setProjects([]);
        return;
      }

      const projectData = (json?.projects ?? []) as Array<{
        id: string;
        name: string;
        estimated_income: number;
        job_number: string | null;
        site_address: string | null;
        general_contractor: string | null;
        start_date: string | null;
        scheduled_completion: string | null;
        scope_description: string | null;
        customer?: { name: string } | { name: string }[] | null;
      }>;
      const periods = (json?.billingPeriods ?? []) as BillingPeriod[];
      const updates = (json?.weeklyUpdates ?? []) as WeeklyUpdate[];
      const assignments = (json?.assignments ?? []) as Array<ProjectTeamMember & { project_id: string }>;
      const changeOrders = (json?.changeOrders ?? []) as CustomerChangeOrder[];
      const photosByProject = (json?.photosByProject ?? {}) as Record<string, number>;

      if (!projectData?.length) {
        setProjects([]);
        return;
      }

      const combined = projectData.map((project) => {
        const customer = Array.isArray(project.customer) ? project.customer[0] : project.customer;

        return {
          id: project.id,
          name: project.name,
          estimated_income: project.estimated_income,
          job_number: project.job_number ?? null,
          site_address: project.site_address ?? null,
          general_contractor: project.general_contractor ?? null,
          start_date: project.start_date ?? null,
          scheduled_completion: project.scheduled_completion ?? null,
          scope_description: project.scope_description ?? null,
          customer_name: customer?.name ?? null,
          billing_periods: ((periods ?? []).filter((period) => period.project_id === project.id) as BillingPeriod[]),
          weekly_updates: ((updates ?? []).filter((update) => update.project_id === project.id) as WeeklyUpdate[]),
          team_members: assignments.filter((assignment) => assignment.project_id === project.id),
          change_orders: changeOrders.filter((co) => co.project_id === project.id),
          photo_count: photosByProject[project.id] ?? 0,
        };
      });

      setProjects(combined);
      setLoadedAt(new Date());
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600" style={{ backgroundColor: PAGE_BG }}>
        <div className="w-full max-w-6xl px-6">
          <CustomerProjectListSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-900" style={{ backgroundColor: PAGE_BG }}>
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
          }

          .customer-print-hide {
            display: none !important;
          }

          .customer-print-shell,
          .customer-print-shell * {
            color: #111827 !important;
          }

          .customer-print-shell {
            background: #ffffff !important;
          }

          .customer-print-card {
            background: #ffffff !important;
            box-shadow: none !important;
            border-color: #d1d5db !important;
          }

          .customer-print-chart {
            break-inside: avoid;
          }
        }
      `}</style>

      <header className="customer-print-shell shadow-lg" style={{ backgroundColor: HEADER_BG }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <Image
              src="/logo.png"
              alt="The Controls Company"
              width={72}
              height={72}
              className="h-14 w-14 rounded-md bg-white/10 p-1"
            />
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-white/80">
                  The Controls Company, LLC
                </p>
                <h1 className="text-3xl font-bold text-white">Project Portal</h1>
              </div>
            </div>
          </div>

          <div className="customer-print-hide flex items-center gap-3 self-start md:self-center">
            <div className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm text-white/90">
              {userEmail || "Signed in"}
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="customer-print-shell mx-auto max-w-6xl px-6 py-8">
        <ErrorBoundary theme="light">
          {projects.length === 0 ? (
            <div
              className="customer-print-card flex flex-col items-center rounded-3xl border border-dashed px-10 py-16 text-center shadow-sm"
              style={{ borderColor: BORDER, backgroundColor: "#ffffff" }}
            >
              <Image
                src="/logo.png"
                alt="The Controls Company"
                width={64}
                height={64}
                className="mb-5 h-16 w-16 rounded-xl border border-slate-200 bg-white p-2"
              />
              <p className="text-2xl font-bold" style={{ color: CHARCOAL }}>
                No projects found
              </p>
              <p className="mt-3 max-w-xl text-sm text-slate-600">
                Your project access hasn&apos;t been set up yet. Contact The Controls Company to get started.
              </p>
              <a
                href="mailto:info@thecontrolscompany.com"
                className="mt-6 inline-flex items-center rounded-full px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                style={{ backgroundColor: HEADER_BG }}
              >
                Contact Us
              </a>
            </div>
          ) : selectedProject ? (
            <ProjectDetail project={selectedProject} userId={userId} onBack={() => setSelectedProject(null)} />
          ) : (
            <ProjectList projects={projects} loadedAt={loadedAt} onSelect={setSelectedProject} />
          )}
        </ErrorBoundary>
      </main>

      <footer
        className="customer-print-shell border-t py-5 text-center text-sm text-white"
        style={{ backgroundColor: HEADER_BG, borderColor: "rgba(255,255,255,0.15)" }}
      >
        The Controls Company, LLC | Service Disabled Veteran Owned Small Business | TheControlsCompany.com
      </footer>
    </div>
  );
}

function ProjectList({
  projects,
  loadedAt,
  onSelect,
}: {
  projects: CustomerProject[];
  loadedAt: Date | null;
  onSelect: (project: CustomerProject) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const summary = useMemo(() => {
    const totalContracts = projects.reduce((sum, project) => sum + getProjectContractValue(project), 0);
    const totalBilled = projects.reduce((sum, project) => sum + getProjectBilledToDate(project), 0);
    const totalBacklog = Math.max(totalContracts - totalBilled, 0);
    const billedThisPeriod = projects.reduce((sum, project) => sum + (project.billing_periods[0]?.actual_billed ?? 0), 0);
    const averageProgress =
      projects.length > 0
        ? projects.reduce((sum, project) => sum + (project.billing_periods[0]?.pct_complete ?? 0), 0) / projects.length
        : 0;

    const financialChartData = projects.map((project) => {
      const billed = getProjectBilledToDate(project);
      const contractValue = getProjectContractValue(project);
      return {
        name: getProjectChartLabel(project),
        contractValue,
        billed,
        backlog: Math.max(contractValue - billed, 0),
      };
    });

    const mixChartData = [
      { name: "Billed", value: totalBilled, color: HEADER_BG },
      { name: "Backlog", value: totalBacklog, color: ACCENT },
    ].filter((item) => item.value > 0);

    return {
      totalContracts,
      billedThisPeriod,
      averageProgress,
      financialChartData,
      mixChartData,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        !search ||
        project.name.toLowerCase().includes(search.toLowerCase()) ||
        (project.site_address ?? "").toLowerCase().includes(search.toLowerCase());
      const badge = getProjectStatus(project).label;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && badge !== "Complete") ||
        (statusFilter === "complete" && badge === "Complete") ||
        (statusFilter === "blocked" && badge === "Has Blockers");

      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: HEADER_BG }}>
            Active Projects
          </p>
          <h2 className="text-2xl font-bold" style={{ color: CHARCOAL }}>
            Project updates and billing snapshots
          </h2>
        </div>
        <p className="text-sm text-slate-600">
          {projects.length} active project{projects.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Avg Progress Across Projects" value={`${(summary.averageProgress * 100).toFixed(1)}%`} />
        <MetricCard label="Billed This Period" value={currency(summary.billedThisPeriod)} />
        <MetricCard label="Total Contract Value" value={currency(summary.totalContracts)} />
      </div>

      {loadedAt && (
        <p className="text-xs text-slate-500">
          Last updated: {format(loadedAt, "MMM d, yyyy h:mm a")}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary/50 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary focus:outline-none"
        >
          <option value="all">All Projects</option>
          <option value="active">Active</option>
          <option value="complete">Complete</option>
          <option value="blocked">Has Blockers</option>
        </select>
      </div>

      <div className="customer-print-chart grid gap-5 lg:grid-cols-[1.3fr_0.9fr]">
        <ChartCard title="Financial Snapshot by Project">
          {summary.financialChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={summary.financialChartData} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
                <CartesianGrid vertical={false} stroke="#dbe7e5" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#475569", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(value) => compactCurrency(value)}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<PortfolioTooltip />} />
                <Bar dataKey="contractValue" fill="#b2dfdb" radius={[8, 8, 0, 0]} />
                <Bar dataKey="billed" fill={HEADER_BG} radius={[8, 8, 0, 0]} />
                <Bar dataKey="backlog" fill={ACCENT} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartMessage message="Contract and billing totals will appear here as project data is recorded." />
          )}
        </ChartCard>

        <ChartCard title="Billed vs Backlog">
          {summary.mixChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={summary.mixChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={68}
                  outerRadius={104}
                  paddingAngle={2}
                >
                  {summary.mixChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PortfolioMixTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartMessage message="Billed and backlog totals will appear once billing records are available." />
          )}
          {summary.mixChartData.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {summary.mixChartData.map((entry) => (
                <div key={entry.name} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{entry.name}</p>
                  </div>
                  <p className="mt-2 text-lg font-bold" style={{ color: CHARCOAL }}>
                    {currency(entry.value)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {filteredProjects.map((project) => {
          const latestPeriod = project.billing_periods[0];
          const latestUpdate = project.weekly_updates[0];
          const pct = latestPeriod ? latestPeriod.pct_complete * 100 : 0;
          const status = getProjectStatus(project);
          const lastUpdateLabel = latestUpdate
            ? `Last update: ${format(new Date(latestUpdate.week_of), "MMM d, yyyy")} (${formatDistanceToNow(new Date(latestUpdate.week_of), { addSuffix: true })})`
            : "Last update: No update yet";

          return (
            <button
              key={project.id}
              onClick={() => { onSelect(project); window.scrollTo({ top: 0, behavior: "instant" }); }}
              className="customer-print-card relative overflow-hidden rounded-3xl border-l-4 bg-white p-6 text-left shadow-[0_18px_45px_rgba(1,122,111,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_55px_rgba(1,122,111,0.14)]"
              style={{ borderColor: BORDER, borderLeftColor: HEADER_BG }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xl font-bold" style={{ color: CHARCOAL }}>
                      {project.name}
                    </p>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <div>
                    <p className="text-3xl font-bold leading-none text-status-success">{pct.toFixed(1)}%</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Current progress</p>
                  </div>
                  <p className="text-sm font-medium text-slate-700">{lastUpdateLabel}</p>
                  <div className="space-y-1 text-sm text-slate-500">
                    {project.site_address && <p>{project.site_address}</p>}
                    <p>{project.customer_name || "Customer project"}</p>
                  </div>
                </div>
                <ProgressDonut value={pct} />
              </div>

              {latestUpdate?.notes && (
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{latestUpdate.notes}</p>
              )}

              <div className="mt-5 flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: HEADER_BG }}>
                  View updates
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {filteredProjects.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          No projects match the current search or filter.
        </div>
      )}
    </div>
  );
}

function ProjectDetail({
  project,
  userId,
  onBack,
}: {
  project: CustomerProject;
  userId: string;
  onBack: () => void;
}) {
  const [view, setView] = useState<"updates" | "billing">("updates");
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [statusLinkMessage, setStatusLinkMessage] = useState<string | null>(null);
  const latestPeriod = project.billing_periods[0];
  const publicStatusPath = project.job_number ? `/status/${encodeURIComponent(project.job_number)}` : null;

  const progressChartData = useMemo(
    () =>
      [...project.billing_periods]
        .filter((period) => period.pct_complete != null)
        .sort((a, b) => new Date(a.period_month).getTime() - new Date(b.period_month).getTime())
        .map((period) => ({
          label: format(new Date(period.period_month), "MMM ''yy"),
          date: format(new Date(period.period_month), "MMMM yyyy"),
          percent: Number(((period.pct_complete ?? 0) * 100).toFixed(1)),
        })),
    [project.billing_periods]
  );

  const billingChartData = useMemo(
    () =>
      [...project.billing_periods]
        .filter((period) => period.actual_billed !== null)
        .sort((a, b) => new Date(a.period_month).getTime() - new Date(b.period_month).getTime())
        .map((period) => ({
          label: format(new Date(period.period_month), "MMM ''yy"),
          billed: period.actual_billed ?? 0,
          contractValue: getProjectContractValue(project),
        })),
    [project]
  );

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="customer-print-hide text-sm font-semibold hover:underline"
        style={{ color: HEADER_BG }}
      >
        {"<- Back to projects"}
      </button>

      <section
        className="customer-print-card rounded-3xl border bg-white p-6 shadow-[0_18px_45px_rgba(1,122,111,0.08)]"
        style={{ borderColor: BORDER }}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: HEADER_BG }}>
                Project Status
              </p>
              <h2 className="text-3xl font-bold" style={{ color: CHARCOAL }}>
                {project.name}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{project.customer_name || "Customer project"}</p>
              {publicStatusPath && (
                <div className="customer-print-hide mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-slate-600">Public Status Link:</span>
                  <code className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{publicStatusPath}</code>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`${window.location.origin}${publicStatusPath}`);
                        setStatusLinkMessage("Copied public status link.");
                        window.setTimeout(() => setStatusLinkMessage(null), 2500);
                      } catch {
                        setStatusLinkMessage("Unable to copy link.");
                        window.setTimeout(() => setStatusLinkMessage(null), 2500);
                      }
                    }}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
                  >
                    Copy
                  </button>
                  {statusLinkMessage && <span className="text-xs text-slate-500">{statusLinkMessage}</span>}
                </div>
              )}
              {project.site_address && (
                <div className="mt-2 flex items-start gap-2 text-sm text-slate-600">
                  <LocationPinIcon />
                  <span>{project.site_address}</span>
                </div>
              )}
              {project.general_contractor && (
                <p className="text-sm text-slate-600">GC: {project.general_contractor}</p>
              )}
              {project.scope_description && (
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
                  {project.scope_description}
                </p>
              )}
              {project.scheduled_completion ? (
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <CalendarIcon />
                  <span>
                    Scheduled completion:{" "}
                    <span className={
                      new Date(project.scheduled_completion) < new Date()
                        ? "font-semibold text-red-600"
                        : "font-medium"
                    }>
                      {format(new Date(project.scheduled_completion), "MMMM d, yyyy")}
                    </span>
                  </span>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  Schedule not received — please provide your project schedule so we can set a completion date.
                </div>
              )}
              {project.photo_count > 0 && (
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <PhotoIcon />
                  <span>
                    {project.photo_count} site photo{project.photo_count !== 1 ? "s" : ""} on file
                  </span>
                </div>
              )}
            </div>
            {latestPeriod && (
              <div className="max-w-xl">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-600">Overall progress</span>
                  <span className="font-semibold" style={{ color: HEADER_BG }}>
                    {(latestPeriod.pct_complete * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-3 rounded-full transition-all"
                    style={{
                      width: `${Math.min(latestPeriod.pct_complete * 100, 100)}%`,
                      backgroundColor: ACCENT,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Compute these inline since they're only used here */}
          {(() => {
            const approvedCoTotal = getProjectApprovedCoTotal(project);
            const contractValue = getProjectContractValue(project);
            const totalBilled = project.billing_periods.reduce((sum, p) => sum + (p.actual_billed ?? 0), 0);
            const remaining = Math.max(contractValue - totalBilled, 0);
            const currentPct = latestPeriod ? latestPeriod.pct_complete * 100 : null;
            return (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Contract Value"
                  value={currency(contractValue)}
                  subLabel={approvedCoTotal > 0 ? `incl. ${currency(approvedCoTotal)} in approved COs` : undefined}
                />
                <MetricCard label="Total Billed" value={currency(totalBilled)} />
                <MetricCard label="Remaining Balance" value={currency(remaining)} />
                <MetricCard
                  label="% Complete"
                  value={currentPct !== null ? `${currentPct.toFixed(1)}%` : "Pending"}
                />
              </div>
            );
          })()}
        </div>
      </section>

      {project.team_members.length > 0 && (
        <section className="customer-print-card rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: BORDER }}>
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: HEADER_BG }}>
              Your Project Team
            </p>
            <h3 className="text-xl font-bold" style={{ color: CHARCOAL }}>Who to contact</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {project.team_members.map((member, index) => {
              const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile;
              const directory = Array.isArray(member.pm_directory) ? member.pm_directory[0] : member.pm_directory;
              const name =
                profile?.full_name ??
                [directory?.first_name, directory?.last_name].filter(Boolean).join(" ").trim() ??
                directory?.email ??
                "Team member";
              const email = profile?.email ?? directory?.email ?? null;
              const phone = directory?.phone ?? null;

              return (
                <div
                  key={`${member.role_on_project}-${email ?? index}`}
                  className="rounded-2xl border-l-4 border bg-white p-4 shadow-sm"
                  style={{ borderColor: BORDER, borderLeftColor: HEADER_BG }}
                >
                  <span
                    className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase"
                    style={{ backgroundColor: "#e6f6f4", color: HEADER_BG }}
                  >
                    {member.role_on_project === "pm" ? "PM" : "Lead"}
                  </span>
                  <p className="mt-3 text-lg font-bold" style={{ color: CHARCOAL }}>
                    {name}
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-slate-500">
                    {email && (
                      <a href={`mailto:${email}`} className="block hover:underline">
                        {email}
                      </a>
                    )}
                    {phone && (
                      <a href={`tel:${phone}`} className="block hover:underline">
                        {phone}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="customer-print-chart grid gap-5 lg:grid-cols-2">
        <ChartCard title="Progress Over Time">
          {progressChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={progressChartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#dbe7e5" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#475569", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ProgressTooltip />} />
                <Line
                  type="monotone"
                  dataKey="percent"
                  stroke={HEADER_BG}
                  strokeWidth={3}
                  dot={{ r: 4, fill: HEADER_BG }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartMessage message="Progress data will appear here as monthly billing periods are recorded." />
          )}
        </ChartCard>

        <ChartCard title="Billing Summary">
          {billingChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={billingChartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#dbe7e5" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#475569", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(value) => compactCurrency(value)}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<BillingTooltip />} />
                <Bar dataKey="contractValue" fill="#b2dfdb" radius={[8, 8, 0, 0]} />
                <Bar dataKey="billed" fill={HEADER_BG} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartMessage message="Billing history will appear once billed periods are recorded." />
          )}
        </ChartCard>
      </div>

      {project.change_orders.filter((co) => co.status === "approved").length > 0 && (
        <section
          className="customer-print-card rounded-3xl border bg-white p-6 shadow-sm"
          style={{ borderColor: BORDER }}
        >
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: HEADER_BG }}>
              Change Orders
            </p>
            <h3 className="text-xl font-bold" style={{ color: CHARCOAL }}>
              Approved Change Orders
            </h3>
          </div>
          <div className="space-y-3">
            {project.change_orders
              .filter((co) => co.status === "approved")
              .map((co) => (
                <div
                  key={co.id}
                  className="flex items-center justify-between rounded-2xl border bg-slate-50 px-4 py-3 text-sm"
                  style={{ borderColor: BORDER }}
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-800">{co.co_number}</span>
                      <span className="text-slate-400">-</span>
                      <span className="text-slate-700">{co.title}</span>
                    </div>
                    {co.approved_date && (
                      <p className="text-xs text-slate-400">
                        Approved {format(new Date(co.approved_date), "MMM d, yyyy")}
                      </p>
                    )}
                    {co.reference_doc && (
                      <p className="text-xs text-slate-400">Ref: {co.reference_doc}</p>
                    )}
                  </div>
                  <span className="shrink-0 font-semibold" style={{ color: HEADER_BG }}>
                    {co.amount >= 0 ? "+" : ""}
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }).format(co.amount)}
                  </span>
                </div>
              ))}
          </div>
          <div
            className="mt-4 rounded-2xl px-4 py-3"
            style={{ backgroundColor: "#e6f6f4" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total Approved Change Orders
            </p>
            <p className="mt-1 text-base font-bold" style={{ color: HEADER_BG }}>
              {currency(getProjectApprovedCoTotal(project))}
            </p>
          </div>
        </section>
      )}

      <div className="customer-print-hide flex gap-2 border-b pb-1" style={{ borderColor: BORDER }}>
        {(["updates", "billing"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className="rounded-full px-4 py-2 text-sm font-semibold transition"
            style={
              view === tab
                ? { backgroundColor: HEADER_BG, color: "#ffffff" }
                : { backgroundColor: "#ffffff", color: "#475569", border: `1px solid ${BORDER}` }
            }
          >
            {tab === "updates" ? "Weekly Updates" : "Billing History"}
          </button>
        ))}
      </div>

      <section className={view === "updates" ? "block print:block" : "hidden print:block"}>
        <div className="space-y-4">
          {project.weekly_updates.length === 0 ? (
            <section
              className="customer-print-card rounded-3xl border bg-white p-6 text-sm text-slate-500 shadow-sm"
              style={{ borderColor: BORDER }}
            >
              No weekly updates submitted yet.
            </section>
          ) : (
            project.weekly_updates.map((update) => <WeeklyUpdateCard key={update.id} update={update} />)
          )}
        </div>
      </section>

      <section className={view === "billing" ? "block print:block" : "hidden print:block"}>
        <div className="customer-print-card overflow-x-auto rounded-3xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#eef8f6" }}>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Period
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  % Complete
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Billed
                </th>
              </tr>
            </thead>
            <tbody>
              {project.billing_periods.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-slate-500">
                    No billing records yet.
                  </td>
                </tr>
              ) : (
                project.billing_periods.map((period) => (
                  <tr key={period.id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium text-slate-800">
                      {format(new Date(period.period_month), "MMMM yyyy")}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {(period.pct_complete * 100).toFixed(1)}%
                    </td>
                    <td className="px-5 py-3 text-right font-semibold" style={{ color: HEADER_BG }}>
                      {period.actual_billed !== null ? currency(period.actual_billed) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="customer-print-hide fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3">
        {feedbackStatus && (
          <div className="rounded-2xl border border-status-success/20 bg-white px-4 py-3 text-sm text-status-success shadow-lg">
            {feedbackStatus}
          </div>
        )}

        <div
          className={[
            "w-full max-w-md overflow-hidden rounded-3xl border bg-white shadow-[0_20px_50px_rgba(1,122,111,0.18)] transition-all duration-300",
            showFeedback ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
          ].join(" ")}
          style={{ borderColor: BORDER }}
        >
          <div className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: HEADER_BG }}>
                  Project Feedback
                </p>
                <h3 className="text-lg font-bold" style={{ color: CHARCOAL }}>Questions or feedback</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedback(false)}
                className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <textarea
              rows={5}
              value={feedbackMessage}
              onChange={(event) => setFeedbackMessage(event.target.value)}
              placeholder="Your feedback or questions"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-[color:#20b2aa] focus:outline-none"
            />

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Messages are sent to The Controls Company team for follow-up.</p>
              <button
                type="button"
                disabled={feedbackSaving || !feedbackMessage.trim() || !userId}
                onClick={async () => {
                  setFeedbackSaving(true);
                  setFeedbackStatus(null);
                  try {
                    const response = await fetch("/api/customer/feedback", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({
                        project_id: project.id,
                        message: feedbackMessage.trim(),
                      }),
                    });
                    const json = await response.json();

                    if (!response.ok) {
                      throw new Error(json?.error ?? "Unable to submit feedback.");
                    }

                    setFeedbackMessage("");
                    setShowFeedback(false);
                    setFeedbackStatus("Feedback sent. Thank you.");
                    window.setTimeout(() => setFeedbackStatus(null), 3000);
                  } catch (submitError) {
                    setFeedbackStatus(submitError instanceof Error ? submitError.message : "Unable to submit feedback.");
                  }

                  setFeedbackSaving(false);
                }}
                className="rounded-full px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: HEADER_BG }}
              >
                {feedbackSaving ? "Sending..." : "Submit"}
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setFeedbackStatus(null);
            setShowFeedback((current) => !current);
          }}
          className="rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
          style={{ backgroundColor: HEADER_BG }}
        >
          Leave Feedback
        </button>
      </div>
    </div>
  );
}

function CustomerProjectListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-white/70" />
        <div className="h-8 w-72 animate-pulse rounded bg-white/80" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="rounded-3xl border border-[#d8ebe7] bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="h-6 w-48 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-20 w-20 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="mt-5 h-16 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectDetailSkeleton() {
  return (
    <section className="customer-print-card rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: BORDER }}>
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
        <div className="h-7 w-48 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {[0, 1].map((index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="h-5 w-20 animate-pulse rounded bg-slate-100" />
            <div className="mt-4 h-5 w-40 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-4 w-32 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </section>
  );
}

function LocationPinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
      <path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}

function WeeklyUpdateCard({ update }: { update: WeeklyUpdate }) {
  const visibleCrewRows = (update.crew_log ?? []).filter((row) => row.men > 0 || row.hours > 0 || row.activities);
  const reportRows = [
    { label: "Material Delivered", value: update.material_delivered, icon: <PackageIcon /> },
    { label: "Equipment Set", value: update.equipment_set, icon: <WrenchIcon /> },
    { label: "Delays / Impacts", value: update.delays_impacts, icon: <AlertIcon /> },
    { label: "Safety Incidents", value: update.safety_incidents, icon: <ShieldIcon /> },
  ].filter((row) => row.value);

  return (
    <article className="customer-print-card rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: BORDER }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-bold" style={{ color: CHARCOAL }}>
            Week of {format(new Date(update.week_of), "MMMM d, yyyy")}
          </h3>
          {update.submitted_at && (
            <p className="mt-1 text-sm text-slate-500">
              Submitted {format(new Date(update.submitted_at), "MMM d, yyyy")}
            </p>
          )}
        </div>
        {update.pct_complete !== null && (
          <span
            className="inline-flex rounded-full px-3 py-1 text-sm font-semibold"
            style={{ backgroundColor: "#e6f6f4", color: HEADER_BG }}
          >
            {(update.pct_complete * 100).toFixed(1)}%
          </span>
        )}
      </div>

      <div className="mt-3">
        <ViewReportLink updateId={update.id} />
      </div>

      {update.notes && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{update.notes}</p>}

      {visibleCrewRows.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <th className="px-4 py-3">Day</th>
                <th className="px-4 py-3 text-center">Men</th>
                <th className="px-4 py-3 text-center">Hours</th>
                <th className="px-4 py-3">Activities</th>
              </tr>
            </thead>
            <tbody>
              {visibleCrewRows.map((row: CrewLogEntry) => (
                <tr key={row.day} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-700">{row.day}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{row.men}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{row.hours}</td>
                  <td className="px-4 py-3 text-slate-600">{row.activities || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportRows.length > 0 && (
        <div className="mt-5 grid gap-3">
          {reportRows.map((row) => (
            <div key={row.label} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="mt-0.5 text-slate-500">{row.icon}</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{row.label}</p>
                <p className="mt-1 text-sm text-slate-700">{row.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {update.blockers && (
        <div className="mt-5 rounded-2xl border px-4 py-3" style={{ borderColor: "#fbbf24", backgroundColor: "#fff8e1" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "#b45309" }}>
            Blockers
          </p>
          <p className="mt-1 text-sm" style={{ color: "#92400e" }}>
            {update.blockers}
          </p>
        </div>
      )}
    </article>
  );
}

function ProgressDonut({ value }: { value: number }) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 84 84" className="h-24 w-24 -rotate-90">
        <circle cx="42" cy="42" r={radius} fill="none" stroke="#e2f1ef" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke={ACCENT}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-status-success">
          {clamped.toFixed(0)}%
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Complete</span>
      </div>
    </div>
  );
}

function MetricCard({ label, value, subLabel }: { label: string; value: string; subLabel?: string }) {
  return (
    <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm" style={{ borderColor: BORDER }}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold" style={{ color: CHARCOAL }}>
        {value}
      </p>
      {subLabel && (
        <p className="mt-0.5 text-[11px] text-slate-400">{subLabel}</p>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="customer-print-card rounded-3xl border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}>
      <h3 className="mb-4 text-lg font-bold" style={{ color: CHARCOAL }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function EmptyChartMessage({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function ProgressTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { date: string; percent: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-800">{item.date}</p>
      <p className="text-slate-600">{item.percent.toFixed(1)}% complete</p>
    </div>
  );
}

function BillingTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-800">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-slate-600">
          {entry.name === "contractValue" ? "Contract Value" : "Billed"}: {currency(entry.value)}
        </p>
      ))}
    </div>
  );
}

function PortfolioTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const labels: Record<string, string> = {
    contractValue: "Contract Value",
    billed: "Billed",
    backlog: "Backlog",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-800">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-slate-600">
          {labels[entry.name] ?? entry.name}: {currency(entry.value)}
        </p>
      ))}
    </div>
  );
}

function PortfolioMixTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-800">{item.name}</p>
      <p className="text-slate-600">{currency(item.value)}</p>
    </div>
  );
}

function SignOutButton() {
  const supabase = createClient();

  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
      }}
      className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
    >
      Sign out
    </button>
  );
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function getProjectBilledToDate(project: CustomerProject) {
  // Use the most recent period's prev_billed (cumulative billed before this period)
  // plus its actual_billed if recorded, otherwise fall back to prev_billed alone.
  // billing_periods are ordered by period_month descending (most recent first).
  const latest = project.billing_periods[0];
  if (!latest) return 0;
  return latest.actual_billed !== null
    ? latest.prev_billed + latest.actual_billed
    : latest.prev_billed;
}

function getProjectApprovedCoTotal(project: CustomerProject): number {
  return project.change_orders
    .filter((co) => co.status === "approved")
    .reduce((sum, co) => sum + co.amount, 0);
}

function getProjectContractValue(project: CustomerProject): number {
  return (project.estimated_income ?? 0) + getProjectApprovedCoTotal(project);
}

function getProjectStatus(project: CustomerProject) {
  const latestPeriod = project.billing_periods[0];
  const latestUpdate = project.weekly_updates[0];
  const pctComplete = latestPeriod?.pct_complete ?? 0;
  const hasBlockers = Boolean(latestUpdate?.blockers?.trim());

  if (pctComplete >= 0.95) {
    return { label: "Complete", className: "bg-status-success/10 text-status-success" };
  }

  if (hasBlockers) {
    return { label: "Has Blockers", className: "bg-status-danger/10 text-status-danger" };
  }

  if (latestUpdate) {
    const daysSinceUpdate = (Date.now() - new Date(latestUpdate.week_of).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate <= 14) {
      return { label: "On Track", className: "bg-brand-primary/10 text-brand-primary" };
    }
    if (daysSinceUpdate > 30) {
      return { label: "No Updates", className: "bg-status-warning/10 text-status-warning" };
    }
  }

  return { label: "Active", className: "bg-surface-overlay text-text-secondary" };
}

function getProjectChartLabel(project: CustomerProject) {
  if (project.job_number) {
    return project.job_number;
  }

  if (project.name.length <= 18) {
    return project.name;
  }

  return `${project.name.slice(0, 15)}...`;
}

function PackageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2 20 6.5v11L12 22l-8-4.5v-11L12 2Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 22V12" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 6.5 12 12 4 6.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14.5 4.5a4.5 4.5 0 0 0 4.78 6.25l-8.53 8.53a2 2 0 1 1-2.83-2.83l8.53-8.53A4.5 4.5 0 0 1 14.5 4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 2 20h20L12 3Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 5 6v5c0 4.6 2.8 8.9 7 10 4.2-1.1 7-5.4 7-10V6l-7-3Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="m9.5 12 1.7 1.7 3.3-3.7" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
