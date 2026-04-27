import { AppShell } from "@/components/app-shell";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const identity = await getShellIdentity("customer");
  if (!["admin", "ops_manager", "pm", "lead"].includes(identity.role)) {
    redirect("/");
  }
  return (
    <AppShell role={identity.role} userEmail={identity.email} hasPortalAccess={identity.hasPortalAccess}>
      {children}
    </AppShell>
  );
}
