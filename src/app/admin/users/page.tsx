export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminUsersPage } from "@/components/admin-users-page";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";

export default async function AdminUsersRoute() {
  const identity = await getShellIdentity("admin");

  if (identity.role !== "admin") {
    redirect("/");
  }

  return (
    <AppShell role={identity.role} userEmail={identity.email} hasPortalAccess={identity.hasPortalAccess}>
      <AdminUsersPage />
    </AppShell>
  );
}
