import { AppShell } from "@/components/app-shell";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";

export const dynamic = "force-dynamic";

export default async function EstimatingLayout({ children }: { children: React.ReactNode }) {
  const identity = await getShellIdentity("customer");
  return <AppShell role={identity.role} userEmail={identity.email} hasPortalAccess={identity.hasPortalAccess}>{children}</AppShell>;
}
