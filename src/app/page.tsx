import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return redirect("/login");

    const resolvedProfile = await resolveUserRole(user);
    const role = resolvedProfile?.role ?? "customer";
    const destinations: Record<string, string> = {
      admin: "/admin",
      pm: "/pm",
      lead: "/pm",
      installer: "/installer",
      ops_manager: "/ops",
      estimator: "/estimating",
      billing: "/billing",
      accounting: "/admin/analytics",
      executive: "/admin/analytics",
      customer: "/customer",
    };

    return redirect(destinations[role] ?? "/login");
  } catch {
    return redirect("/login");
  }
}
