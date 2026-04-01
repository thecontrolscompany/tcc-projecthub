"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { ViewReportLink } from "@/components/view-report-link";
import type { BillingPeriod, CrewLogEntry, WeeklyUpdate } from "@/types/database";

interface CustomerProject {
  id: string;
  name: string;
  estimated_income: number;
  job_number: string | null;
  site_address: string | null;
  general_contractor: string | null;
  customer_name: string | null;
  billing_periods: BillingPeriod[];
  weekly_updates: WeeklyUpdate[];
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

      const { data: contactRows } = await supabase
        .from("project_customer_contacts")
        .select("project_id")
        .eq("profile_id", user.id)
        .eq("portal_access", true);

      const projectIds = (contactRows ?? []).map((row) => row.project_id);
      if (!projectIds.length) {
        setProjects([]);
        return;
      }

      const { data: projectData } = await supabase
        .from("projects")
        .select("id, name, estimated_income, job_number, site_address, general_contractor, customer:customers(name)")
        .in("id", projectIds)
        .eq("is_active", true)
        .order("name");

      if (!projectData?.length) {
        setProjects([]);
        return;
      }

      const ids = projectData.map((project) => project.id);

      const [{ data: periods }, { data: updates }] = await Promise.all([
        supabase
          .from("billing_periods")
          .select("*")
          .in("project_id", ids)
          .order("period_month", { ascending: false }),
        supabase
          .from("weekly_updates")
          .select(`
            id,
            project_id,
            pm_id,
            week_of,
            pct_complete,
            notes,
            blockers,
            submitted_at,
            crew_log,
            material_delivered,
            equipment_set,
            safety_incidents,
            inspections_tests,
            delays_impacts,
            other_remarks
          `)
          .in("project_id", ids)
          .order("week_of", { ascending: false })
          .limit(100),
      ]);

      const combined = projectData.map((project) => {
        const customer = Array.isArray(project.customer) ? project.customer[0] : project.customer;

        return {
          id: project.id,
          name: project.name,
          estimated_income: project.estimated_income,
          job_number: project.job_number ?? null,
          site_address: project.site_address ?? null,
          general_contractor: project.general_contractor ?? null,
          customer_name: customer?.name ?? null,
          billing_periods: ((periods ?? []).filter((period) => period.project_id === project.id) as BillingPeriod[]),
          weekly_updates: ((updates ?? []).filter((update) => update.project_id === project.id) as WeeklyUpdate[]),
        };
      });

      setProjects(combined);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600" style={{ backgroundColor: PAGE_BG }}>
        Loading your projects...
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
              <Image
                src="/sdvosb.jpg"
                alt="Service Disabled Veteran Owned Small Business"
                width={144}
                height={32}
                className="h-8 w-auto rounded border border-white/20 bg-white object-cover"
              />
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
        {projects.length === 0 ? (
          <div
            className="customer-print-card rounded-3xl border border-dashed px-10 py-16 text-center shadow-sm"
            style={{ borderColor: BORDER, backgroundColor: "#ffffff" }}
          >
            <p className="text-lg font-semibold" style={{ color: CHARCOAL }}>
              No active projects found for your account.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Contact The Controls Company if you believe this is an error.
            </p>
          </div>
        ) : selectedProject ? (
          <ProjectDetail project={selectedProject} userId={userId} onBack={() => setSelectedProject(null)} />
        ) : (
          <ProjectList projects={projects} onSelect={setSelectedProject} />
        )}
      </main>

      <footer
        className="customer-print-shell border-t py-5 text-center text-sm text-white"
        style={{ backgroundColor: HEADER_BG, borderColor: "rgba(255,255,255,0.15)" }}
      >
        The Controls Company, LLC | Service Disabled Veteran Owned Small Business | thecontrolsco.com
      </footer>
    </div>
  );
}

function ProjectList({
  projects,
  onSelect,
}: {
  projects: CustomerProject[];
  onSelect: (project: CustomerProject) => void;
}) {
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

      <div className="grid gap-5 lg:grid-cols-2">
        {projects.map((project) => {
          const latestPeriod = project.billing_periods[0];
          const latestUpdate = project.weekly_updates[0];
          const pct = latestPeriod ? latestPeriod.pct_complete * 100 : 0;
          const lastUpdateLabel = latestUpdate
            ? format(new Date(latestUpdate.week_of), "MMMM d, yyyy")
            : "No update yet";

          return (
            <button
              key={project.id}
              onClick={() => onSelect(project)}
              className="customer-print-card relative overflow-hidden rounded-3xl border-l-4 bg-white p-6 text-left shadow-[0_18px_45px_rgba(1,122,111,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_55px_rgba(1,122,111,0.14)]"
              style={{ borderColor: BORDER, borderLeftColor: HEADER_BG }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xl font-bold" style={{ color: CHARCOAL }}>
                    {project.name}
                  </p>
                  <p className="text-sm text-slate-500">{project.customer_name || "Customer project"}</p>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Last update</p>
                  <p className="text-sm font-medium text-slate-700">{lastUpdateLabel}</p>
                </div>
                <ProgressDonut value={pct} />
              </div>

              {latestUpdate?.notes && (
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{latestUpdate.notes}</p>
              )}

              <div className="mt-5 flex items-center justify-between">
                <div
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: "#e6f6f4", color: HEADER_BG }}
                >
                  {latestPeriod ? `${pct.toFixed(1)}% complete` : "Progress pending"}
                </div>
                <span className="text-sm font-semibold" style={{ color: HEADER_BG }}>
                  {"View Details ->"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
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
  const supabase = createClient();
  const [view, setView] = useState<"updates" | "billing">("updates");
  const [teamMembers, setTeamMembers] = useState<ProjectTeamMember[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [statusLinkMessage, setStatusLinkMessage] = useState<string | null>(null);
  const latestPeriod = project.billing_periods[0];
  const publicStatusPath = project.job_number ? `/status/${encodeURIComponent(project.job_number)}` : null;

  useEffect(() => {
    let active = true;

    async function loadTeam() {
      const { data } = await supabase
        .from("project_assignments")
        .select("role_on_project, profile:profiles(full_name, email), pm_directory:pm_directory(first_name, last_name, email, phone)")
        .eq("project_id", project.id)
        .in("role_on_project", ["pm", "lead"]);

      if (active) {
        setTeamMembers((data as ProjectTeamMember[] | null) ?? []);
      }
    }

    void loadTeam();

    return () => {
      active = false;
    };
  }, [project.id, supabase]);

  const progressChartData = useMemo(
    () =>
      [...project.weekly_updates]
        .sort((a, b) => new Date(a.week_of).getTime() - new Date(b.week_of).getTime())
        .map((update) => ({
          label: format(new Date(update.week_of), "MMM d"),
          date: format(new Date(update.week_of), "MMMM d, yyyy"),
          percent: Number(((update.pct_complete ?? 0) * 100).toFixed(1)),
        })),
    [project.weekly_updates]
  );

  const billingChartData = useMemo(
    () =>
      [...project.billing_periods]
        .filter((period) => period.actual_billed !== null)
        .sort((a, b) => new Date(a.period_month).getTime() - new Date(b.period_month).getTime())
        .map((period) => ({
          label: format(new Date(period.period_month), "MMM ''yy"),
          billed: period.actual_billed ?? 0,
          contractValue: period.estimated_income_snapshot,
        })),
    [project.billing_periods]
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

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Contract Value" value={currency(project.estimated_income)} />
            <MetricCard
              label="Last Update"
              value={project.weekly_updates[0] ? format(new Date(project.weekly_updates[0].week_of), "MMM d, yyyy") : "Pending"}
            />
          </div>
        </div>
      </section>

      {teamMembers.length > 0 && (
        <section className="customer-print-card rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: BORDER }}>
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: HEADER_BG }}>
              Your Project Team
            </p>
            <h3 className="text-xl font-bold" style={{ color: CHARCOAL }}>Who to contact</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {teamMembers.map((member, index) => {
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
            <EmptyChartMessage message="Weekly updates will appear here as progress is reported." />
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
                  const { error } = await supabase.from("customer_feedback").insert({
                    project_id: project.id,
                    profile_id: userId,
                    message: feedbackMessage.trim(),
                  });

                  if (!error) {
                    setFeedbackMessage("");
                    setShowFeedback(false);
                    setFeedbackStatus("Feedback sent. Thank you.");
                    window.setTimeout(() => setFeedbackStatus(null), 3000);
                  } else {
                    setFeedbackStatus(error.message);
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

function LocationPinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
      <path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
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
        <span className="text-lg font-bold" style={{ color: CHARCOAL }}>
          {clamped.toFixed(0)}%
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Complete</span>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm" style={{ borderColor: BORDER }}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold" style={{ color: CHARCOAL }}>
        {value}
      </p>
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
