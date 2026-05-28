const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const REPORTS_MAILBOX = process.env.GRAPH_REPORTS_MAILBOX ?? "tccprojecthub@controlsco.net";

export type GraphSendMailInput = {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  text: string;
};

export type GraphSendMailError = {
  status: number;
  body: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

async function getGraphAppToken() {
  const tenantId = requiredEnv("MICROSOFT_GRAPH_TENANT_ID");
  const clientId = requiredEnv("MICROSOFT_GRAPH_CLIENT_ID");
  const clientSecret = requiredEnv("MICROSOFT_GRAPH_CLIENT_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || typeof json?.access_token !== "string") {
    throw new Error(
      typeof json?.error_description === "string"
        ? json.error_description
        : `Microsoft token request failed with status ${response.status}.`
    );
  }

  return json.access_token as string;
}

export async function sendReportsMailboxMail({
  to,
  cc,
  subject,
  html,
  text,
}: GraphSendMailInput): Promise<void> {
  const token = await getGraphAppToken();

  const ccAddresses = (cc ?? []).filter((addr) => addr && addr.toLowerCase() !== to.toLowerCase());
  const ccRecipients = ccAddresses.map((addr) => ({ emailAddress: { address: addr } }));

  const response = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(REPORTS_MAILBOX)}/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject,
        body: {
          contentType: "HTML",
          content: html,
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
        ...(ccRecipients.length > 0 ? { ccRecipients } : {}),
      },
      saveToSentItems: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Microsoft Graph sendMail failed with status ${response.status}.`) as Error & {
      graphError?: GraphSendMailError;
    };
    error.graphError = {
      status: response.status,
      body,
    };
    throw error;
  }

  void text;
}
