"use client";

import { SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";

export function AppShell({
  children,
  role,
  userEmail,
}: {
  children: React.ReactNode;
  role: string;
  userEmail: string;
}) {
  return (
    <>
      <SidebarNav role={role} userEmail={userEmail} />
      <header className="fixed top-0 left-56 right-0 h-14 bg-surface-raised border-b border-border-default flex items-center justify-end px-6 z-20">
        <ThemeToggle />
      </header>
      <div className="ml-56 pt-14 min-h-screen bg-surface-base">
        <main className="p-6">{children}</main>
      </div>
    </>
  );
}
