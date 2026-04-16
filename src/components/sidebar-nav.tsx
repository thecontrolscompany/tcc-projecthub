"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

export type NavRole = "admin" | "pm" | "lead" | "installer" | "ops_manager" | "customer";
type IconProps = { className?: string };
type NavItem = {
  label: string;
  href: string;
  roles: NavRole[];
  icon: (props: IconProps) => React.ReactNode;
  external?: boolean;
};

function GridIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function DocumentIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v6h6" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function DollarIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 3v18" />
      <path d="M16.5 7.5c0-1.93-2.01-3.5-4.5-3.5S7.5 5.57 7.5 7.5 9.51 11 12 11s4.5 1.57 4.5 3.5S14.49 18 12 18s-4.5-1.57-4.5-3.5" />
    </svg>
  );
}

function ChartIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20v-11" />
      <path d="M3 20h19" />
    </svg>
  );
}

function FolderIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-10Z" />
    </svg>
  );
}

function ClipboardIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4.5h6" />
      <path d="M9 10h6" />
      <path d="M9 14h6" />
    </svg>
  );
}

function WrenchIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M14.5 5.5a4 4 0 0 0-5.24 4.9L3.5 16.16a2 2 0 0 0 2.83 2.83l5.76-5.76a4 4 0 0 0 4.9-5.24l-2.24 2.24-2.83-2.83 2.58-1.9Z" />
    </svg>
  );
}

function UserIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.6-3 4.2-4.5 7-4.5s5.4 1.5 7 4.5" />
    </svg>
  );
}

function MessageIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M7 18.5H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H11l-4 3v-3Z" />
    </svg>
  );
}

function ClockIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ChevronLeftIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

function SharePointIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="9" cy="12" r="5" />
      <circle cx="17" cy="7" r="3" />
      <circle cx="17" cy="17" r="3" />
      <path d="M13.5 10.5 14.5 9" />
      <path d="M13.5 13.5 14.5 15" />
    </svg>
  );
}

function ExternalLinkIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="m10 14 11-11" />
    </svg>
  );
}

// Nav items in display order. TimeHub is first for field/PM roles.
export const NAV_LINKS: NavItem[] = [
  { label: "TimeHub",          href: "/time-hub",                 roles: ["pm", "lead", "installer"],                           icon: ClockIcon },
  { label: "TimeHub",          href: "/time",                     roles: ["ops_manager"],                                       icon: ClockIcon },
  { label: "Admin",            href: "/admin",                    roles: ["admin"],                                             icon: GridIcon },
  { label: "OperationsHub",    href: "/ops",                      roles: ["ops_manager"],                                       icon: GridIcon },
  { label: "Ops View",         href: "/admin/ops",                roles: ["admin"],                                             icon: GridIcon },
  { label: "Contacts",         href: "/admin/contacts",           roles: ["admin"],                                             icon: UserIcon },
  { label: "ProjectHub",       href: "/pm",                       roles: ["pm", "lead", "ops_manager"],                         icon: ClipboardIcon },
  { label: "OpportunityHub",   href: "/quotes",                   roles: ["admin", "ops_manager", "customer"],                  icon: DocumentIcon },
  { label: "Projects",         href: "/projects",                 roles: [],                                                    icon: FolderIcon },
  { label: "Installer",        href: "/installer",                roles: ["installer"],                                         icon: WrenchIcon },
  { label: "BillingHub",       href: "/billing",                  roles: ["admin"],                                             icon: DollarIcon },
  { label: "BillingHub",       href: "/admin",                    roles: ["ops_manager"],                                       icon: DollarIcon },
  { label: "Analytics",        href: "/admin/analytics",          roles: ["admin", "ops_manager"],                              icon: ChartIcon },
  { label: "SharePoint",       href: "https://controlsco.sharepoint.com/sites/TCCProjects", roles: ["admin", "pm", "lead", "installer", "ops_manager"], icon: SharePointIcon, external: true },
  { label: "SP Reconcile",     href: "/admin/migrate-sharepoint", roles: ["admin"],                                             icon: FolderIcon },
  { label: "My Portal",        href: "/customer",                 roles: ["customer"],                                          icon: UserIcon },
];

const PAGE_TITLE_OVERRIDES: Record<string, string> = {
  "/admin": "Admin",
  "/admin/analytics": "Analytics",
  "/admin/contacts": "Contacts & Users",
  "/admin/migrate-sharepoint": "SharePoint Reconcile",
  "/admin/ops": "Ops View",
  "/admin/users": "User Management",
  "/billing": "BillingHub",
  "/customer": "My Portal",
  "/estimating": "Estimating",
  "/feedback": "Feedback",
  "/installer": "Installer",
  "/ops": "OperationsHub",
  "/pm": "ProjectHub",
  "/pm/time": "TimeHub",
  "/time-hub": "TimeHub",
  "/projects": "Projects",
  "/quotes": "OpportunityHub",
  "/time/clock": "Time Clock",
  "/time/employees": "Time Employees",
  "/time/export": "Reports",
  "/time/projects": "Time Projects",
};

export function getUserInitials(userEmail: string) {
  const local = userEmail.split("@")[0] ?? "";
  const parts = local
    .split(/[.\-_ ]+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return (local.slice(0, 2) || "U").toUpperCase();
}

export function resolvePageTitle(pathname: string) {
  if (PAGE_TITLE_OVERRIDES[pathname]) {
    return PAGE_TITLE_OVERRIDES[pathname];
  }

  const matched = NAV_LINKS.find((item) => !item.external && item.href !== "/" && pathname.startsWith(item.href));
  return matched?.label ?? "ProjectHub";
}

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  role,
  userEmail,
  collapsed,
  onToggle,
}: {
  role: string;
  userEmail: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createBrowserClient();
  const effectiveRole = role as NavRole;
  const links = NAV_LINKS.filter((link) => link.roles.includes(effectiveRole));
  const initials = getUserInitials(userEmail);

  return (
    <aside
      className={[
        "fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-border-default bg-surface-raised transition-[width] duration-200",
        "max-w-[calc(100vw-2rem)]",
        collapsed ? "w-16" : "w-56",
      ].join(" ")}
    >
      {/* Logo header */}
      <div className="flex h-14 items-center border-b border-border-default px-3">
        <div className={["flex items-center gap-3 overflow-hidden", collapsed ? "justify-center w-full" : ""].join(" ")}>
          <img
            src="/logo.png"
            alt="TCC ProjectHub"
            className="h-8 w-8 shrink-0 rounded-lg object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling?.removeAttribute("hidden");
            }}
          />
          <span hidden className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10 text-sm font-bold text-brand-primary">
            TC
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">TCC ProjectHub</p>
              <p className="text-xs text-text-tertiary">Internal Portal</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-1">
          {links.map((link) => {
            const isActive = !link.external && isActivePath(pathname, link.href);
            const Icon = link.icon;

            if (link.external) {
              return (
                <a
                  key={`${link.href}-${link.label}`}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={collapsed ? link.label : undefined}
                  className={[
                    "flex items-center rounded-xl px-3 py-2.5 text-sm transition-colors text-text-secondary hover:bg-surface-overlay hover:text-text-primary",
                    collapsed ? "justify-center" : "gap-3",
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && (
                    <span className="flex flex-1 items-center justify-between truncate">
                      {link.label}
                      <ExternalLinkIcon className="h-3 w-3 shrink-0 opacity-50" />
                    </span>
                  )}
                </a>
              );
            }

            return (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                title={collapsed ? link.label : undefined}
                className={[
                  "flex items-center rounded-xl px-3 py-2.5 text-sm transition-colors",
                  collapsed ? "justify-center" : "gap-3",
                  isActive
                    ? "bg-surface-overlay text-text-primary font-medium"
                    : "text-text-secondary hover:bg-surface-overlay hover:text-text-primary",
                ].join(" ")}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{link.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer: user info + feedback + sign out */}
      <div className="border-t border-border-default p-2">
        <div className={["rounded-2xl bg-surface-overlay/70 p-2", collapsed ? "space-y-2" : "space-y-3"].join(" ")}>
          <div className={["flex items-center", collapsed ? "justify-center" : "gap-3"].join(" ")}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/15 text-sm font-semibold text-brand-primary">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{userEmail}</p>
                <p className="text-xs uppercase tracking-wide text-text-tertiary">{String(effectiveRole).replace("_", " ")}</p>
              </div>
            )}
          </div>

          <div className={["flex items-center gap-1", collapsed ? "flex-col" : "justify-between"].join(" ")}>
            {!collapsed && (
              <button
                onClick={onToggle}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-tertiary transition hover:bg-surface-raised hover:text-text-primary"
                title="Collapse sidebar"
              >
                <ChevronLeftIcon />
                Collapse
              </button>
            )}

            <div className={["flex items-center gap-1", collapsed ? "flex-col" : ""].join(" ")}>
              {/* Feedback tucked in footer */}
              <Link
                href="/feedback"
                title="Feedback"
                className="inline-flex items-center justify-center rounded-lg px-2 py-2 text-text-tertiary transition hover:bg-surface-raised hover:text-text-primary"
              >
                <MessageIcon className="h-4 w-4" />
              </Link>

              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push("/login");
                }}
                title="Sign Out"
                className={[
                  "inline-flex items-center rounded-lg text-sm text-text-secondary transition hover:bg-surface-raised hover:text-text-primary",
                  collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
                ].join(" ")}
              >
                <UserIcon className="h-4 w-4" />
                {!collapsed && <span className="ml-2">Sign Out</span>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
