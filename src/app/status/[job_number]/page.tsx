import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ job_number: string }>;
};

type ProjectRow = {
  id: string;
  name: string;
  job_number: string | null;
  customer?: { name: string | null } | Array<{ name: string | null }> | null;
};

function normalizeSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function PublicStatusPage({ params }: PageProps) {
  const { job_number } = await params;
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: project } = await adminClient
    .from("projects")
    .select("id, name, job_number, customer:customers(name)")
    .eq("job_number", job_number)
    .maybeSingle();

  const normalizedProject = project as ProjectRow | null;

  if (!normalizedProject?.id) {
    return <NotFoundState />;
  }

  const { data: accessRow } = await adminClient
    .from("project_customer_contacts")
    .select("id")
    .eq("project_id", normalizedProject.id)
    .eq("portal_access", true)
    .limit(1)
    .maybeSingle();

  if (!accessRow) {
    return <NotFoundState />;
  }

  const [{ data: latestBilling }, { data: latestUpdate }] = await Promise.all([
    adminClient
      .from("billing_periods")
      .select("pct_complete, period_month")
      .eq("project_id", normalizedProject.id)
      .order("period_month", { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminClient
      .from("weekly_updates")
      .select("week_of")
      .eq("project_id", normalizedProject.id)
      .eq("status", "submitted")
      .order("week_of", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const customer = normalizeSingle(normalizedProject.customer);
  const pctComplete = latestBilling?.pct_complete !== null && latestBilling?.pct_complete !== undefined
    ? `${(latestBilling.pct_complete * 100).toFixed(1)}%`
    : "Not reported";
  const lastUpdate = latestUpdate?.week_of ? format(new Date(latestUpdate.week_of), "MMMM d, yyyy") : "No update yet";

  return (
    <main className="min-h-screen bg-[#f0faf9] px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[28px] border border-[#b2dfdb] bg-white shadow-[0_20px_55px_rgba(1,122,111,0.12)]">
        <div className="bg-[#017a6f] px-6 py-8 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">The Controls Company, LLC</p>
          <h1 className="mt-2 text-3xl font-bold">Public Project Status</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/80">
            High-level project visibility for customers and stakeholders. For detailed updates, contact The Controls Company directly.
          </p>
        </div>

        <div className="space-y-6 px-6 py-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#017a6f]">Project</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">{normalizedProject.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {customer?.name || "Customer project"}{normalizedProject.job_number ? ` • Job ${normalizedProject.job_number}` : ""}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StatusCard label="Current % Complete" value={pctComplete} accent />
            <StatusCard label="Last Update Date" value={lastUpdate} />
            <StatusCard label="Need Help?" value="info@thecontrolsco.com" />
          </div>

          <div className="rounded-3xl border border-[#d9ece8] bg-[#f8fcfb] p-5">
            <p className="text-sm text-slate-600">
              This public page intentionally shows only minimal status information. Financial data, crew details, and internal notes remain private.
            </p>
          </div>

          <div>
            <Link
              href="mailto:info@thecontrolsco.com"
              className="inline-flex items-center rounded-full bg-[#017a6f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#015f57]"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatusCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-3xl border border-[#d9ece8] bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={["mt-2 text-xl font-bold", accent ? "text-[#017a6f]" : "text-slate-900"].join(" ")}>{value}</p>
    </div>
  );
}

function NotFoundState() {
  return (
    <main className="min-h-screen bg-[#f0faf9] px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-[#b2dfdb] bg-white px-6 py-12 text-center shadow-[0_20px_55px_rgba(1,122,111,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#017a6f]">Project Status</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Project not found</h1>
        <p className="mt-3 text-sm text-slate-600">
          We couldn&apos;t find a public project status page for that job number.
        </p>
        <Link
          href="mailto:info@thecontrolsco.com"
          className="mt-6 inline-flex items-center rounded-full bg-[#017a6f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#015f57]"
        >
          Contact Us
        </Link>
      </div>
    </main>
  );
}
