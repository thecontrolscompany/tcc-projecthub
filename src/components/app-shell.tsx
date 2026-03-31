"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarNav } from "./sidebar-nav";
import { getUserInitials, resolvePageTitle, type NavRole } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";
import { roleHome } from "@/lib/auth/role-routes";

const SIDEBAR_STORAGE_KEY = "tcc-sidebar-collapsed";
const VIEW_AS_STORAGE_KEY = "tcc-view-as-role";
const VIEW_AS_OPTIONS: Array<{ value: NavRole; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "pm", label: "PM" },
  { value: "lead", label: "Lead" },
  { value: "ops_manager", label: "Ops Manager" },
  { value: "installer", label: "Installer" },
  { value: "customer", label: "Customer" },
];

function ChevronLeftIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function AppShell({
  children,
  role,
  userEmail,
}: {
  children: React.ReactNode;
  role: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [viewAsRole, setViewAsRole] = useState<NavRole | null>(null);
  const effectiveRole = viewAsRole ?? (role as NavRole);
  const title = useMemo(() => resolvePageTitle(pathname), [pathname]);
  const initials = useMemo(() => getUserInitials(userEmail), [userEmail]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    setCollapsed(stored === "true");

    const storedViewAs = window.sessionStorage.getItem(VIEW_AS_STORAGE_KEY);
    setViewAsRole(storedViewAs ? (storedViewAs as NavRole) : null);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (viewAsRole) {
      window.sessionStorage.setItem(VIEW_AS_STORAGE_KEY, viewAsRole);
    } else {
      window.sessionStorage.removeItem(VIEW_AS_STORAGE_KEY);
    }
  }, [viewAsRole]);

  return (
    <>
      <SidebarNav
        role={role}
        overrideRole={viewAsRole}
        userEmail={userEmail}
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
      />
      <header
        className={[
          "fixed top-0 right-0 z-20 flex h-14 items-center justify-between border-b border-border-default bg-surface-raised px-4 transition-[left] duration-200",
          collapsed ? "left-16" : "left-56",
        ].join(" ")}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCollapsed((value) => !value)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-default bg-surface-overlay text-text-secondary transition hover:text-text-primary"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          {role === "admin" && (
            <label className="flex items-center gap-2 rounded-full border border-border-default bg-surface-overlay px-3 py-1.5 text-sm text-text-secondary">
              <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">View as</span>
              <select
                value={viewAsRole ?? "admin"}
                onChange={(e) => {
                  const selected = e.target.value as NavRole;
                  setViewAsRole(selected === "admin" ? null : selected);
                }}
                className="bg-transparent text-sm text-text-primary focus:outline-none"
              >
                {VIEW_AS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ThemeToggle />
          <div className="flex items-center gap-3 rounded-full border border-border-default bg-surface-overlay px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary/15 text-xs font-semibold text-brand-primary">
              {initials}
            </div>
            <span className="hidden max-w-[220px] truncate text-sm text-text-secondary sm:block">{userEmail}</span>
          </div>
        </div>
      </header>
      <div
        className={[
          "min-h-screen bg-surface-base pt-14 transition-[margin-left] duration-200",
          collapsed ? "ml-16" : "ml-56",
        ].join(" ")}
      >
        <main className="p-6">
          {viewAsRole && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
              <span>
                Viewing as: {VIEW_AS_OPTIONS.find((option) => option.value === effectiveRole)?.label ?? effectiveRole}
                <span className="mt-1 block text-xs text-status-warning/80">
                  Nav preview only - data reflects your admin account.
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    window.sessionStorage.setItem(VIEW_AS_STORAGE_KEY, effectiveRole);
                    setViewAsRole(effectiveRole);
                    router.push(roleHome(effectiveRole));
                  }}
                  className="rounded-lg border border-status-warning/40 px-3 py-1.5 text-xs font-medium transition hover:bg-status-warning/10"
                >
                  Open Home
                </button>
                <button
                  onClick={() => setViewAsRole(null)}
                  className="rounded-lg border border-status-warning/40 px-3 py-1.5 text-xs font-medium transition hover:bg-status-warning/10"
                >
                  Exit
                </button>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </>
  );
}
