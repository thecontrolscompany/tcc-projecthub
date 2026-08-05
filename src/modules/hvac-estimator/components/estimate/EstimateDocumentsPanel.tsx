import { useEffect, useMemo, useRef, useState } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { T } from "../../shared/tokens";

type EstimateDocument = {
  id: string;
  document_role: "proposal_docx" | "proposal_pdf" | "estimate_xlsm" | "addendum" | "supporting_scope" | "customer_upload" | "scope_of_work";
  file_name: string;
  file_ext: string | null;
  content_type: string | null;
  file_size_bytes: number | null;
  storage_web_url: string | null;
  uploaded_at: string;
  archived_for_customer: boolean;
  is_primary_source: boolean;
  extraction_status: "pending" | "completed" | "failed";
  extraction_notes: string | null;
};

type MailAttachmentSummary = {
  id: string;
  name: string;
  contentType: string | null;
  size: number;
};

type MailMessageWithAttachments = {
  id: string;
  subject: string;
  from: string | null;
  receivedDateTime: string;
  attachments: MailAttachmentSummary[];
};

type Props = {
  estimateId: string;
  sharepointFolder?: string | null;
  drawingBasis: string;
  onChangeDrawingBasis: (value: string) => void;
  onFolderProvisioned?: (folder: string) => void;
  embedded?: boolean;
  autoProvision?: boolean;
};

const ROLE_OPTIONS: Array<{ value: EstimateDocument["document_role"]; label: string; folder: string }> = [
  { value: "supporting_scope", label: "Reference / drawing", folder: "02 Internal Review" },
  { value: "customer_upload", label: "Customer upload", folder: "01 Customer Uploads" },
  { value: "scope_of_work", label: "Scope of Work", folder: "01 Customer Uploads" },
  { value: "addendum", label: "Addendum", folder: "03 Estimate Working" },
];

function sharePointUrl(folder: string) {
  const encodedPath = folder
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://controlsco.sharepoint.com/sites/TCCProjects/Shared%20Documents/${encodedPath}`;
}

function formatFileSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function EstimateDocumentsPanel({
  estimateId,
  sharepointFolder: sharepointFolderProp,
  drawingBasis,
  onChangeDrawingBasis,
  onFolderProvisioned,
  embedded = false,
  autoProvision = false,
}: Props) {
  const [documents, setDocuments] = useState<EstimateDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<EstimateDocument["document_role"]>("supporting_scope");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [batchNote, setBatchNote] = useState("");
  const [localFolder, setLocalFolder] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const [showEmailPicker, setShowEmailPicker] = useState(false);
  const [emailMessages, setEmailMessages] = useState<MailMessageWithAttachments[]>([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailAuthError, setEmailAuthError] = useState(false);
  const [importingKey, setImportingKey] = useState<string | null>(null);

  const sharepointFolder = localFolder ?? sharepointFolderProp ?? null;

  async function readErrorMessage(res: Response, fallback: string) {
    const text = await res.text().catch(() => "");
    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.error === "string" && parsed.error.trim()) {
          return parsed.error;
        }
      } catch {
        return text.slice(0, 500);
      }
    }

    try {
      const json = JSON.parse(text || "{}");
      if (typeof json?.error === "string" && json.error.trim()) {
        return json.error;
      }
    } catch {
      // Ignore parse failures and use the fallback below.
    }

    return fallback;
  }

  async function provisionFolder() {
    setProvisioning(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/estimates/${estimateId}/provision-folder`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Unable to provision SharePoint folder.");
      const folder = typeof json?.sharepointFolder === "string" ? json.sharepointFolder : null;
      if (folder) {
        setLocalFolder(folder);
        onFolderProvisioned?.(folder);
        setMessage("SharePoint folder provisioned successfully.");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unable to provision SharePoint folder.";
      if (/Microsoft access token/i.test(errorMessage)) {
        // Expired/missing provider token — skip the manual "Reconnect Microsoft" click and
        // send the user straight into the OAuth flow, resuming provisioning automatically on return.
        setMessage("Reconnecting to Microsoft…");
        setProvisioning(false);
        await reconnectMicrosoft({ auto: true });
        return;
      }
      setError(errorMessage);
    } finally {
      setProvisioning(false);
    }
  }

  async function reconnectMicrosoft(options?: { auto?: boolean }) {
    const supabase = createSupabaseClient();
    const next = `${window.location.pathname}?panel=documents${options?.auto ? "&autoProvision=1" : ""}`;
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  useEffect(() => {
    if (autoProvision && !sharepointFolder && !provisioning) {
      void provisionFolder();
    }
    // Only run once on mount in response to the autoProvision resume flag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.size > 0);
    if (files.length) setSelectedFiles(files);
  }

  async function requestUploadSession(file: File) {
    const res = await fetch(`/api/estimates/${estimateId}/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "prepare",
        documentRole: selectedRole,
        fileName: file.name,
        contentType: file.type || null,
        notes: batchNote.trim(),
      }),
    });

    if (!res.ok) {
      throw new Error(await readErrorMessage(res, `Unable to prepare upload for ${file.name}.`));
    }

    const json = await res.json().catch(() => null);
    const uploadUrl = typeof json?.uploadUrl === "string" ? json.uploadUrl : "";
    const storagePath = typeof json?.storagePath === "string" ? json.storagePath : "";

    if (!uploadUrl || !storagePath) {
      throw new Error("Upload session did not return a valid destination.");
    }

    return { uploadUrl, storagePath };
  }

  async function uploadFileDirectly(uploadUrl: string, file: File) {
    const buffer = await file.arrayBuffer();
    const chunkSize = 10 * 1024 * 1024;
    let response: Response | null = null;

    for (let start = 0; start < buffer.byteLength; start += chunkSize) {
      const end = Math.min(start + chunkSize, buffer.byteLength);
      const chunk = buffer.slice(start, end);
      response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "Content-Length": String(chunk.byteLength),
          "Content-Range": `bytes ${start}-${end - 1}/${buffer.byteLength}`,
        },
        body: chunk,
      });

      if (![200, 201, 202].includes(response.status)) {
        throw new Error(await readErrorMessage(response, `SharePoint upload failed for ${file.name}.`));
      }
    }

    const finalData = response ? await response.json().catch(() => null) : null;
    return {
      id: typeof finalData?.id === "string" ? finalData.id : "",
      webUrl: typeof finalData?.webUrl === "string" ? finalData.webUrl : null,
    };
  }

  async function commitUpload(file: File, storagePath: string, storageItemId: string, storageWebUrl: string | null) {
    const res = await fetch(`/api/estimates/${estimateId}/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "commit",
        documentRole: selectedRole,
        fileName: file.name,
        fileExt: file.name.includes(".") ? `.${file.name.split(".").pop() ?? ""}`.toLowerCase() : null,
        contentType: file.type || null,
        fileSizeBytes: file.size,
        storageItemId,
        storageWebUrl,
        storagePath,
        notes: batchNote.trim(),
      }),
    });

    if (!res.ok) {
      throw new Error(await readErrorMessage(res, `Unable to save metadata for ${file.name}.`));
    }
  }

  const sharepointLink = useMemo(
    () => (sharepointFolder ? sharePointUrl(sharepointFolder) : null),
    [sharepointFolder],
  );

  useEffect(() => {
    let active = true;

    async function loadDocuments() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/estimates/${estimateId}/documents`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(typeof json?.error === "string" ? json.error : "Unable to load documents.");
        }
        if (active) {
          setDocuments(Array.isArray(json?.documents) ? json.documents : []);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load documents.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDocuments();
    return () => {
      active = false;
    };
  }, [estimateId]);

  async function handleUpload() {
    if (!selectedFiles.length) {
      setError("Choose one or more files before uploading.");
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      for (const file of selectedFiles) {
        const session = await requestUploadSession(file);
        const uploaded = await uploadFileDirectly(session.uploadUrl, file);
        if (!uploaded.id) {
          throw new Error(`SharePoint did not return an item ID for ${file.name}.`);
        }
        await commitUpload(file, session.storagePath, uploaded.id, uploaded.webUrl);
      }

      setMessage(`Uploaded ${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"}.`);
      setSelectedFiles([]);
      setBatchNote("");

      const refreshed = await fetch(`/api/estimates/${estimateId}/documents`, { cache: "no-store" });
      const refreshedJson = await refreshed.json().catch(() => null);
      if (refreshed.ok && Array.isArray(refreshedJson?.documents)) {
        setDocuments(refreshedJson.documents);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function openEmailPicker() {
    setShowEmailPicker(true);
    setEmailError(null);
    setEmailAuthError(false);
    setEmailLoading(true);
    try {
      const res = await fetch(`/api/estimates/${estimateId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list-email-attachments" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401) setEmailAuthError(true);
        throw new Error(typeof json?.error === "string" ? json.error : "Unable to list email attachments.");
      }
      setEmailMessages(Array.isArray(json?.messages) ? json.messages : []);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Unable to list email attachments.");
    } finally {
      setEmailLoading(false);
    }
  }

  async function importEmailAttachment(messageId: string, attachmentId: string) {
    setImportingKey(`${messageId}:${attachmentId}`);
    setEmailError(null);
    try {
      const res = await fetch(`/api/estimates/${estimateId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import-email-attachment",
          documentRole: selectedRole,
          messageId,
          attachmentId,
          notes: batchNote.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401) setEmailAuthError(true);
        throw new Error(typeof json?.error === "string" ? json.error : "Unable to import attachment.");
      }

      setMessage("Imported attachment from email.");
      setShowEmailPicker(false);

      const refreshed = await fetch(`/api/estimates/${estimateId}/documents`, { cache: "no-store" });
      const refreshedJson = await refreshed.json().catch(() => null);
      if (refreshed.ok && Array.isArray(refreshedJson?.documents)) {
        setDocuments(refreshedJson.documents);
      }
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Unable to import attachment.");
    } finally {
      setImportingKey(null);
    }
  }

  const body = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Documents & References</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Upload drawings, emails, addenda, and zipped reference packages here. These stay with the estimate
            record and become the source list for future references.
          </p>
        </div>
        {sharepointLink && (
          <a
            href={sharepointLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-brand-primary/20 bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/20"
          >
            Open SharePoint Folder
          </a>
        )}
      </div>

      <div className="grid gap-4 border-b border-border-default px-5 py-4 lg:grid-cols-[1.3fr,1fr]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Reference Summary
          </span>
          <textarea
            rows={3}
            value={drawingBasis}
            onChange={(event) => onChangeDrawingBasis(event.target.value)}
            className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            placeholder="Short summary of the drawings/specs/emails reviewed"
          />
          <p className="mt-2 text-xs text-text-tertiary">
            Keep this concise. The detailed source documents live below in the upload list.
          </p>
        </label>

        <div className="rounded-xl border border-border-default bg-surface-overlay p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Upload Files</div>
          <div
            className="mt-3 space-y-3"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text-secondary">File type</span>
              <select
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value as EstimateDocument["document_role"]) }
                className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text-secondary">Notes</span>
              <input
                value={batchNote}
                onChange={(event) => setBatchNote(event.target.value)}
                className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                placeholder="Optional note for this batch"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text-secondary">Files</span>
              <div
                className={`rounded-xl border-2 border-dashed p-3 transition ${isDragOver ? "border-brand-primary bg-brand-primary/10" : "border-border-default bg-surface-base"}`}
              >
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.msg,.eml,.png,.jpg,.jpeg,.tif,.tiff"
                  onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
                  className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-surface-overlay file:px-3 file:py-2 file:text-sm file:font-medium file:text-text-primary"
                />
                <p className="mt-1 text-xs text-text-tertiary">
                  {isDragOver ? "Drop files here" : "Click to choose or drag and drop files here."}
                  {selectedFiles.length > 0 && ` — ${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} selected`}
                </p>
              </div>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={uploading || selectedFiles.length === 0 || !sharepointFolder}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload to Estimate Folder"}
              </button>
              <button
                type="button"
                onClick={() => void openEmailPicker()}
                disabled={!sharepointFolder}
                className="rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Attach from Email
              </button>
            </div>

            {!sharepointFolder && (
              <div className="space-y-2">
                <p className="text-xs text-status-warning">
                  SharePoint folder has not been provisioned yet for this estimate.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void provisionFolder()}
                    disabled={provisioning}
                    className="rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-3 py-2 text-xs font-semibold text-brand-primary transition hover:bg-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {provisioning ? "Provisioning..." : "Provision SharePoint Folder"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void reconnectMicrosoft({ auto: true })}
                    className="rounded-xl border border-border-default bg-surface-base px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-overlay"
                  >
                    Reconnect Microsoft
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showEmailPicker && (
        <div className="border-b border-border-default px-5 py-4">
          <div className="rounded-2xl border border-border-default bg-surface-overlay p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-text-primary">Attach from Email</div>
              <button
                type="button"
                onClick={() => setShowEmailPicker(false)}
                className="rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-raised"
              >
                Close
              </button>
            </div>

            {emailError && <p className="mt-3 text-sm text-status-danger">{emailError}</p>}

            {emailAuthError && (
              <button
                type="button"
                onClick={() => void reconnectMicrosoft()}
                className="mt-3 rounded-xl border border-border-default bg-surface-base px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-raised"
              >
                Reconnect Microsoft
              </button>
            )}

            {emailLoading ? (
              <p className="mt-3 text-sm text-text-secondary">Loading recent messages...</p>
            ) : emailMessages.length === 0 && !emailError ? (
              <p className="mt-3 text-sm text-text-secondary">No recent messages with attachments found.</p>
            ) : (
              <div className="mt-3 max-h-96 space-y-3 overflow-y-auto">
                {emailMessages.map((msg) => (
                  <div key={msg.id} className="rounded-xl border border-border-default bg-surface-base p-3">
                    <div className="text-sm font-medium text-text-primary">{msg.subject || "(no subject)"}</div>
                    <div className="text-xs text-text-tertiary">
                      {msg.from || "Unknown sender"} · {formatDate(msg.receivedDateTime)}
                    </div>
                    <div className="mt-2 space-y-1">
                      {msg.attachments.map((attachment) => {
                        const key = `${msg.id}:${attachment.id}`;
                        return (
                          <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-3 py-2">
                            <div className="text-xs text-text-secondary">
                              {attachment.name}
                              <span className="ml-2 text-text-tertiary">{formatFileSize(attachment.size)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => void importEmailAttachment(msg.id, attachment.id)}
                              disabled={importingKey === key}
                              className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {importingKey === key ? "Attaching..." : "Attach"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="border-b border-border-default px-5 py-3 text-sm text-status-danger">{error}</div>}
      {message && <div className="border-b border-border-default px-5 py-3 text-sm text-status-success">{message}</div>}

      <div className="px-5 py-4">
        {loading ? (
          <p className="text-sm text-text-secondary">Loading documents...</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-text-secondary">No documents uploaded yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border-default bg-surface-base">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-default bg-surface-overlay text-xs uppercase tracking-wide text-text-tertiary">
                <tr>
                  <th className="px-4 py-3 font-semibold">File</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Uploaded</th>
                  <th className="px-4 py-3 font-semibold">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {documents.map((document) => (
                  <tr key={document.id} className="hover:bg-surface-overlay/60">
                    <td className="px-4 py-3">
                      {document.storage_web_url ? (
                        <a
                          href={document.storage_web_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-brand-primary hover:underline"
                        >
                          {document.file_name}
                        </a>
                      ) : (
                        <span className="font-medium text-text-primary">{document.file_name}</span>
                      )}
                      {document.extraction_notes && (
                        <div className="mt-1 text-xs text-text-tertiary">{document.extraction_notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{document.document_role.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(document.uploaded_at)}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatFileSize(document.file_size_bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{body}</div>;
  }

  return <section className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised">{body}</section>;
}
