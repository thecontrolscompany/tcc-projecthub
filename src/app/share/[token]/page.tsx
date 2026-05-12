import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DirectoryView } from "./directory-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Contact Directory — The Controls Company", robots: "noindex,nofollow" };
}

type Contact = {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  role_type: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  account: {
    id: string;
    company_name: string;
    type: string;
    types: string[];
    territory: string | null;
    website: string | null;
  } | null;
};

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Use service role to bypass RLS for public read
  const supabase = await createClient();

  const { data: exported } = await supabase
    .from("crm_shared_exports")
    .select("id, title, snapshot, expires_at, view_count")
    .eq("token", token)
    .single();

  if (!exported) notFound();

  // Check expiry
  if (exported.expires_at && new Date(exported.expires_at) < new Date()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-800">This link has expired.</h1>
          <p className="mt-2 text-sm text-gray-500">Please request a new one from The Controls Company.</p>
        </div>
      </main>
    );
  }

  // Increment view count (fire-and-forget)
  supabase
    .from("crm_shared_exports")
    .update({ view_count: (exported.view_count ?? 0) + 1 })
    .eq("token", token)
    .then(() => {});

  const snapshot = exported.snapshot as { contacts: Contact[]; generated_at: string };

  return (
    <DirectoryView
      title={exported.title ?? "Contact Directory"}
      contacts={snapshot.contacts ?? []}
      generatedAt={snapshot.generated_at}
    />
  );
}
