import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function EstimatingLayout({ children }: { children: React.ReactNode }) {
  let role = "admin";
  let email = "";
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, email")
        .eq("id", user.id)
        .single();
      role = profile?.role ?? "admin";
      email = profile?.email ?? "";
    }
  } catch {}
  return <AppShell role={role} userEmail={email}>{children}</AppShell>;
}
