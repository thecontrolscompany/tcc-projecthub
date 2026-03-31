export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { createClient as createServerClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let profile: { role?: string | null; email?: string | null } | null = null;

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("role, email")
        .eq("id", user.id)
        .single();

      profile = data;
    }
  } catch {
    // Supabase not configured â€” render shell with defaults
  }

  return (
    <AppShell role={profile?.role ?? "admin"} userEmail={profile?.email ?? "dev@localhost"}>
      {children}
    </AppShell>
  );
}
