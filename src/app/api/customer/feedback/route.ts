import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { sendCustomerFeedbackNotification } from "@/lib/email/notifications";
import { listFeedbackNotificationRecipients } from "@/lib/feedback/notification-recipients";

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const profile = await resolveUserRole(user);
  if (profile?.role !== "customer") {
    return NextResponse.json({ error: "Customer access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const projectId = typeof body?.project_id === "string" ? body.project_id : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!projectId) {
    return NextResponse.json({ error: "Project id is required." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await adminClient
    .from("customer_feedback")
    .insert({
      project_id: projectId,
      profile_id: user.id,
      message,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    const [projectResult, recipients] = await Promise.all([
      adminClient.from("projects").select("name").eq("id", projectId).maybeSingle(),
      listFeedbackNotificationRecipients({ excludeEmail: user.email ?? null }),
    ]);

    await sendCustomerFeedbackNotification({
      projectName: projectResult.data?.name ?? projectId,
      customerEmail: user.email ?? null,
      message,
      recipientEmails: recipients,
    });
  } catch (notificationError) {
    console.warn("[feedback] unable to send customer feedback notification", notificationError);
  }

  return NextResponse.json({ feedback: data }, { status: 201 });
}
