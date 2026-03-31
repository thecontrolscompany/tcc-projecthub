"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarNav } from "./sidebar-nav";
import { getUserInitials, resolvePageTitle } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";

const SIDEBAR_STORAGE_KEY = "tcc-sidebar-collapsed";

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
  const [collapsed, setCollapsed] = useState(false);
  const title = useMemo(() => resolvePageTitle(pathname), [pathname]);
  const initials = useMemo(() => getUserInitials(userEmail), [userEmail]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    setCollapsed(stored === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <>
      <SidebarNav role={role} userEmail={userEmail} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
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
        <main className="p-6">{children}</main>
      </div>
    </>
  );
}
