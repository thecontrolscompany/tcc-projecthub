"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { roleHome } from "@/lib/auth/role-routes";

async function signInAsRole(role: "admin" | "pm" | "customer") {
  "use server";
  const credentials = {
    admin:    { email: "demo-admin@trimrespond.com",    password: process.env.DEMO_ADMIN_PASSWORD! },
    pm:       { email: "demo-pm1@trimrespond.com",      password: process.env.DEMO_PM_PASSWORD! },
    customer: { email: "demo-customer@trimrespond.com", password: process.env.DEMO_CUSTOMER_PASSWORD! },
  }[role];

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) throw new Error(error.message);

  const rolePath = roleHome(role === "admin" ? "admin" : role === "pm" ? "pm" : "customer");
  redirect(rolePath);
}

const signInAsAdmin    = signInAsRole.bind(null, "admin");
const signInAsPm       = signInAsRole.bind(null, "pm");
const signInAsCustomer = signInAsRole.bind(null, "customer");

export default function DemoLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-base px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-1">
            <span className="font-display text-3xl font-black tracking-tight text-text-primary">
              trim
            </span>
            <span className="font-display text-3xl font-light text-brand-primary">+</span>
            <span className="font-display text-3xl font-black tracking-tight text-text-primary">
              respond
            </span>
          </div>
          <p className="mt-2 text-xs font-mono uppercase tracking-widest text-text-tertiary">
            Live Demo · Apex Mechanical
          </p>
        </div>

        <div className="rounded-3xl border border-border-default bg-surface-raised p-8">
          <h1 className="mb-1 text-base font-semibold text-text-primary">
            Explore the platform
          </h1>
          <p className="mb-6 text-sm text-text-secondary">
            Sign in as any role to see what Trim+Respond looks like in action.
          </p>

          <div className="flex flex-col gap-3">
            <form action={signInAsAdmin}>
              <button
                type="submit"
                className="flex w-full items-center justify-between rounded-xl border border-border-default bg-surface-overlay px-5 py-4 text-sm font-semibold text-text-primary transition hover:border-brand-primary/50 hover:bg-surface-base"
              >
                <span className="flex flex-col items-start gap-0.5">
                  <span>Admin</span>
                  <span className="text-xs font-normal text-text-tertiary">
                    Full access — billing, projects, users, analytics
                  </span>
                </span>
                <Arrow />
              </button>
            </form>

            <form action={signInAsPm}>
              <button
                type="submit"
                className="flex w-full items-center justify-between rounded-xl border border-border-default bg-surface-overlay px-5 py-4 text-sm font-semibold text-text-primary transition hover:border-brand-primary/50 hover:bg-surface-base"
              >
                <span className="flex flex-col items-start gap-0.5">
                  <span>Project Manager</span>
                  <span className="text-xs font-normal text-text-tertiary">
                    Assigned projects, weekly updates, time, BOM
                  </span>
                </span>
                <Arrow />
              </button>
            </form>

            <form action={signInAsCustomer}>
              <button
                type="submit"
                className="flex w-full items-center justify-between rounded-xl border border-border-default bg-surface-overlay px-5 py-4 text-sm font-semibold text-text-primary transition hover:border-brand-primary/50 hover:bg-surface-base"
              >
                <span className="flex flex-col items-start gap-0.5">
                  <span>Customer</span>
                  <span className="text-xs font-normal text-text-tertiary">
                    Project status, updates, billing history (read-only)
                  </span>
                </span>
                <Arrow />
              </button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-text-tertiary">
          Demo data is fake and resets nightly at 3 AM UTC.
        </p>
      </div>
    </main>
  );
}

function Arrow() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-text-tertiary"
    >
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
