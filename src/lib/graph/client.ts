/**
 * Microsoft Graph API client helpers.
 *
 * Authentication flow:
 * - Admin/PM users sign in with Microsoft SSO via Supabase OAuth (azure provider).
 * - Supabase stores the provider token (access token for Graph API).
 * - We retrieve it from the Supabase session and pass it to Graph API calls.
 *
 * Azure AD App Registration requirements:
 *   Redirect URI: {APP_URL}/auth/callback
 *   Scopes: openid email profile offline_access Files.ReadWrite Mail.ReadWrite
 */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export interface OneDriveItem {
  id: string;
  name: string;
  createdDateTime: string;
  folder: { childCount: number };
}

export interface SharePointItem {
  id: string;
  name: string;
  createdDateTime: string;
  folder: { childCount: number };
}

/**
 * Make an authenticated Graph API request using the user's provider token.
 * providerToken comes from: supabase.auth.getSession() -> session.provider_token
 */
export async function graphFetch(
  path: string,
  providerToken: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${providerToken}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

export async function getSharePointSiteId(providerToken: string): Promise<string> {
  const res = await graphFetch("/sites/controlsco.sharepoint.com:/sites/TCCProjects", providerToken);

  if (!res.ok) {
    throw new Error("SharePoint site not found at https://controlsco.sharepoint.com/sites/TCCProjects");
  }

  const data = await res.json();
  if (!data?.id) {
    throw new Error("SharePoint site ID was not returned by Microsoft Graph.");
  }

  return data.id as string;
}

export async function getSharePointDriveId(providerToken: string, siteId: string): Promise<string> {
  const res = await graphFetch(`/sites/${siteId}/drive`, providerToken);

  if (!res.ok) {
    throw new Error("SharePoint default document library drive was not found.");
  }

  const data = await res.json();
  if (!data?.id) {
    throw new Error("SharePoint drive ID was not returned by Microsoft Graph.");
  }

  return data.id as string;
}

export async function listOneDriveFolders(providerToken: string, path: string): Promise<OneDriveItem[]> {
  const encodedPath = path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const res = await graphFetch(
    `/me/drive/root:/${encodedPath}:/children?$select=id,name,folder,createdDateTime&$filter=folder ne null`,
    providerToken
  );

  if (!res.ok) {
    throw new Error(`Failed to list OneDrive folders for ${path}.`);
  }

  const data = await res.json();
  const items: Array<{
    id: string;
    name: string;
    createdDateTime: string;
    folder?: { childCount: number };
  }> = Array.isArray(data?.value) ? data.value : [];

  return items
    .filter((item): item is OneDriveItem => Boolean(item.folder))
    .map((item) => ({
      id: item.id,
      name: item.name,
      createdDateTime: item.createdDateTime,
      folder: item.folder,
    }));
}

export async function listSharePointFolders(
  providerToken: string,
  driveId: string,
  parentPath: string
): Promise<SharePointItem[]> {
  const normalizedPath = parentPath.replace(/^\/+|\/+$/g, "");
  const encodedPath = normalizedPath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  const path = encodedPath
    ? `/drives/${driveId}/root:/${encodedPath}:/children?$select=id,name,folder,createdDateTime&$filter=folder ne null`
    : `/drives/${driveId}/root/children?$select=id,name,folder,createdDateTime&$filter=folder ne null`;

  const res = await graphFetch(path, providerToken);

  if (res.status === 404) {
    return [];
  }

  if (!res.ok) {
    throw new Error(`Failed to list SharePoint folders for ${parentPath || "/"}.`);
  }

  const data = await res.json();
  const items: Array<{
    id: string;
    name: string;
    createdDateTime: string;
    folder?: { childCount: number };
  }> = Array.isArray(data?.value) ? data.value : [];

  return items
    .filter((item): item is SharePointItem => Boolean(item.folder))
    .map((item) => ({
      id: item.id,
      name: item.name,
      createdDateTime: item.createdDateTime,
      folder: item.folder,
    }));
}

export async function createSharePointFolder(
  providerToken: string,
  driveId: string,
  parentPath: string,
  folderName: string
): Promise<string> {
  const normalizedParent = parentPath.replace(/^\/+|\/+$/g, "");
  const encodedParent = normalizedParent
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  const url = encodedParent
    ? `/drives/${driveId}/root:/${encodedParent}:/children`
    : `/drives/${driveId}/root/children`;

  const res = await graphFetch(url, providerToken, {
    method: "POST",
    body: JSON.stringify({
      name: folderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail",
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to create SharePoint folder "${folderName}" in "${parentPath || "/"}": ${res.status} ${errBody}`);
  }

  const data = await res.json();
  if (!data?.id) {
    throw new Error(`SharePoint folder ${folderName} was created without an item ID.`);
  }

  return data.id as string;
}

export async function getSharePointFolderIdByPath(
  providerToken: string,
  driveId: string,
  path: string
): Promise<string> {
  const encodedPath = path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  const res = await graphFetch(`/drives/${driveId}/root:/${encodedPath}`, providerToken);

  if (!res.ok) {
    throw new Error(`SharePoint folder not found at ${path}.`);
  }

  const data = await res.json();
  if (!data?.id) {
    throw new Error(`SharePoint folder ID not returned for ${path}.`);
  }

  return data.id as string;
}

export async function deleteSharePointItem(
  providerToken: string,
  driveId: string,
  itemId: string
): Promise<void> {
  const res = await graphFetch(`/drives/${driveId}/items/${itemId}`, providerToken, {
    method: "DELETE",
  });

  if (res.status !== 204) {
    throw new Error(`Failed to delete SharePoint item ${itemId}.`);
  }
}

export async function copyOneDriveItemToSharePoint(
  providerToken: string,
  itemId: string,
  destinationDriveId: string,
  destinationParentId: string,
  newName: string
): Promise<void> {
  const res = await graphFetch(`/me/drive/items/${encodeURIComponent(itemId)}/copy`, providerToken, {
    method: "POST",
    body: JSON.stringify({
      parentReference: { driveId: destinationDriveId, id: destinationParentId },
      name: newName,
    }),
  });

  if (res.status !== 202) {
    const body = await res.text();
    throw new Error(`Failed to queue OneDrive copy for "${newName}": ${res.status} ${body}`);
  }
  // 202 Accepted - copy runs async on Microsoft's servers, no polling needed
}

/**
 * Read a specific cell from an Excel workbook on OneDrive.
 * Used to read C5 (% complete) from each project's POC Sheet.xlsx.
 *
 * @param providerToken  MS Graph access token
 * @param filePath       OneDrive path relative to root, e.g.
 *                       "Projects/Crestview K-8/Crestview K-8 POC Sheet.xlsx"
 * @param sheetName      Worksheet name (default "Sheet1")
 * @param cellAddress    Cell address (default "C5" - the POC % complete cell)
 */
export async function readOneDriveCell(
  providerToken: string,
  filePath: string,
  sheetName = "Sheet1",
  cellAddress = "C5"
): Promise<number | null> {
  const encodedPath = encodeURIComponent(filePath);
  const res = await graphFetch(
    `/me/drive/root:/${encodedPath}:/workbook/worksheets/${encodeURIComponent(sheetName)}/range(address='${cellAddress}')`,
    providerToken
  );

  if (!res.ok) {
    console.error(`Graph API cell read failed for ${filePath}: ${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json();
  const value = data?.values?.[0]?.[0];
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace("%", ""));
    return isNaN(parsed) ? null : parsed > 1 ? parsed / 100 : parsed;
  }
  return null;
}

/**
 * Create an Outlook draft email.
 * Mirrors legacy Module5 GenerateBillingEmailText.
 *
 * @param providerToken  MS Graph access token
 * @param to             Recipient email address
 * @param subject        Email subject
 * @param body           Plain text body
 */
export async function createOutlookDraft(
  providerToken: string,
  to: string,
  subject: string,
  body: string
): Promise<{ id: string } | null> {
  const res = await graphFetch("/me/messages", providerToken, {
    method: "POST",
    body: JSON.stringify({
      subject,
      body: {
        contentType: "Text",
        content: body,
      },
      toRecipients: [
        {
          emailAddress: { address: to },
        },
      ],
      isDraft: true,
    }),
  });

  if (!res.ok) {
    console.error(`Failed to create Outlook draft for ${to}: ${res.status}`);
    return null;
  }

  return res.json();
}

/**
 * Upload a file to OneDrive.
 * Used for monthly billing Excel backup.
 *
 * @param providerToken  MS Graph access token
 * @param uploadPath     OneDrive destination path, e.g.
 *                       "Projects/_Billing Archives/2026-03.xlsx"
 * @param fileBuffer     File content as ArrayBuffer
 */
export async function uploadToOneDrive(
  providerToken: string,
  uploadPath: string,
  fileBuffer: ArrayBuffer
): Promise<boolean> {
  const encodedPath = encodeURIComponent(uploadPath);
  const res = await graphFetch(
    `/me/drive/root:/${encodedPath}:/content`,
    providerToken,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      body: fileBuffer,
    }
  );

  return res.ok;
}
