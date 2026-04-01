import { AppShell } from "@/components/app-shell";
import { AdminContactsPage } from "@/components/admin-contacts";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";

export const dynamic = "force-dynamic";

export default async function AdminContactsRoute() {
  const identity = await getShellIdentity("admin");

  return (
    <AppShell role={identity.role} userEmail={identity.email}>
      <AdminContactsPage />
    </AppShell>
  );
}
