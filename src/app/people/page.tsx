import { AppShell } from "@/components/app-shell";
import { AdminContactsPage } from "@/components/admin-contacts";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const identity = await getShellIdentity("admin");

  if (!["admin", "ops_manager"].includes(identity.role)) {
    redirect("/");
  }

  return (
    <AppShell role={identity.role} userEmail={identity.email} hasPortalAccess={identity.hasPortalAccess}>
      <AdminContactsPage role={identity.role} />
    </AppShell>
  );
}
