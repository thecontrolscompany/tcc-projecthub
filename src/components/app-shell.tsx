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
  hasPortalAccess = false,
}: {
  children: React.ReactNode;
  role: string;
  userEmail: string;
  hasPortalAccess?: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = useMemo(() => resolvePageTitle(pathname), [pathname]);
  const initials = useMemo(() => getUserInitials(userEmail), [userEmail]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    setCollapsed(stored === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="hidden md:block">
        <SidebarNav role={role} userEmail={userEmail} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      </div>
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <SidebarNav role={role} userEmail={userEmail} collapsed={false} onToggle={() => setMobileOpen(false)} />
          </div>
        </>
      )}
      <header
        className={[
          "fixed top-0 right-0 z-20 flex h-14 items-center justify-between border-b border-border-default bg-surface-raised px-4 transition-[left] duration-200",
          "left-0 md:left-auto",
          collapsed ? "md:left-16" : "md:left-56",
        ].join(" ")}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen((value) => !value)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-default bg-surface-overlay text-text-secondary transition hover:text-text-primary md:hidden"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <button
            onClick={() => setCollapsed((value) => !value)}
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-border-default bg-surface-overlay text-text-secondary transition hover:text-text-primary md:inline-flex"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          {hasPortalAccess && (
            <a
              href="/customer"
              className="hidden rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-3 py-1.5 text-xs font-medium text-brand-primary transition hover:bg-brand-primary/20 sm:inline-flex items-center gap-1.5"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z" />
              </svg>
              My Portal
            </a>
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
          "ml-0",
          collapsed ? "md:ml-16" : "md:ml-56",
        ].join(" ")}
      >
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </>
  );
}
