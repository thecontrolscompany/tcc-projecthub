import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOutlookDraft } from "@/lib/graph/client";

interface EmailDraft {
  pmEmail: string;
  pmName: string;
  subject: string;
  body: string;
}

/**
 * POST /api/generate-emails
 * Body: { drafts: EmailDraft[] }
 *
 * Creates Outlook drafts in Timothy's mailbox for each PM.
 * Mirrors legacy Module5 GenerateBillingEmailText.
 *
 * Drafts are NOT sent automatically — Timothy reviews and sends from Outlook.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const providerToken = session.provider_token;
  if (!providerToken) {
    return NextResponse.json(
      {
        message:
          "Microsoft access token not available. Please sign out and sign back in with Microsoft to create Outlook drafts.",
      },
      { status: 400 }
    );
  }

  const { drafts }: { drafts: EmailDraft[] } = await request.json();

  if (!drafts?.length) {
    return NextResponse.json({ message: "No drafts to create." }, { status: 400 });
  }

  let created = 0;
  let failed = 0;

  for (const draft of drafts) {
    const result = await createOutlookDraft(
      providerToken,
      draft.pmEmail,
      draft.subject,
      draft.body
    );

    if (result) {
      created++;
    } else {
      failed++;
    }
  }

  return NextResponse.json({
    message: `${created} draft${created !== 1 ? "s" : ""} created in Outlook.${failed > 0 ? ` ${failed} failed.` : ""} Open Outlook to review and send.`,
    created,
    failed,
  });
}
