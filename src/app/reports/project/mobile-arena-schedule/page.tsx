export const dynamic = "force-dynamic";

import { format } from "date-fns";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { PrintButton } from "@/app/reports/weekly-update/[id]/PrintButton";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{
    projectId?: string;
    packetDate?: string;
  }>;
};

type PacketListRow = {
  id: string;
  packet_date: string;
  title: string;
};

type PacketRow = PacketListRow & {
  body: {
    html_content?: string;
  } | null;
};

const REPORT_TYPE = "mobile_arena_schedule_review";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function formatLongDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "MMMM d, yyyy");
}

async function canAccessProject(
  supabase: ReturnType<typeof adminClient>,
  role: string,
  userId: string,
  projectId: string
) {
  if (role === "admin" || role === "ops_manager") {
    return true;
  }

  if (role === "customer") {
    const { data } = await supabase
      .from("project_customer_contacts")
      .select("id")
      .eq("project_id", projectId)
      .eq("profile_id", userId)
      .eq("portal_access", true)
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  }

  const { data } = await supabase
    .from("project_assignments")
    .select("id")
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .limit(1)
    .maybeSingle();

  return Boolean(data);
}

export default async function MobileArenaScheduleReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const projectId = params.projectId;
  const packetDate = params.packetDate;

  if (!projectId) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedProfile = await resolveUserRole(user);
  const role = resolvedProfile?.role ?? "customer";
  if (!["admin", "ops_manager", "pm", "lead", "customer"].includes(role)) {
    redirect("/login");
  }

  const admin = adminClient();
  const allowed = await canAccessProject(admin, role, user.id, projectId);
  if (!allowed) {
    redirect(role === "customer" ? "/customer" : "/pm");
  }

  if (!packetDate) {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host");
    if (!host) {
      notFound();
    }

    const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
    const response = await fetch(
      `${protocol}://${host}/api/pm/report-packets?projectId=${encodeURIComponent(projectId)}&reportType=${encodeURIComponent(REPORT_TYPE)}&list=true`,
      {
        cache: "no-store",
        headers: {
          cookie: requestHeaders.get("cookie") ?? "",
        },
      }
    );

    if (!response.ok) {
      notFound();
    }

    const payload = (await response.json()) as { packets?: PacketListRow[] };
    const packets = payload.packets ?? [];

    return (
      <main className="min-h-screen bg-surface-overlay text-text-primary">
        <section className="mx-auto max-w-4xl px-6 py-10">
          <header className="border-b border-brand-primary/25 pb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
              The Controls Company, LLC
            </p>
            <h1 className="mt-2 text-3xl font-bold">Mobile Arena Schedule Impact Reviews</h1>
            <p className="mt-2 text-sm text-text-secondary">Saved ProjectHub report packets</p>
          </header>

          <div className="mt-6 space-y-3">
            {packets.length > 0 ? (
              packets.map((packet) => (
                <article
                  key={packet.id}
                  className="rounded-lg border border-border-default bg-surface-base p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-brand-primary">{formatLongDate(packet.packet_date)}</p>
                      <h2 className="mt-1 text-lg font-bold">{packet.title}</h2>
                    </div>
                    <Link
                      href={`/reports/project/mobile-arena-schedule?projectId=${encodeURIComponent(projectId)}&packetDate=${encodeURIComponent(packet.packet_date)}`}
                      className="inline-flex items-center rounded-xl border border-brand-primary/20 bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/20"
                    >
                      View Report &rarr;
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-lg border border-border-default bg-surface-base p-5 text-sm text-text-secondary">
                No schedule impact reviews have been saved for this project.
              </div>
            )}
          </div>
        </section>
      </main>
    );
  }

  const { data } = await admin
    .from("project_report_packets")
    .select("id, packet_date, title, body")
    .eq("project_id", projectId)
    .eq("report_type", REPORT_TYPE)
    .eq("packet_date", packetDate)
    .limit(1)
    .maybeSingle();

  const packet = data as PacketRow | null;
  const htmlContent = packet?.body?.html_content;
  if (!packet || !htmlContent) {
    notFound();
  }

  return (
    <html lang="en">
      <body>
        <style>{`
          :root { color-scheme: light; }
          body { color: #111827; background: #fff; }
        `}</style>
        <PrintButton documentTitle={packet.title} />
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </body>
    </html>
  );
}
