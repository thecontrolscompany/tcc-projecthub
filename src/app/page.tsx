import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role ?? "customer";
    const destinations: Record<string, string> = {
      admin: "/admin",
      pm: "/pm",
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
