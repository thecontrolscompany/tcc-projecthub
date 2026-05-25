import { useEffect, useMemo, useRef, useState } from "react";
import { AI_PROVIDERS } from "../../ai/providerRegistry.js";

const DIRECT_UPLOAD_LIMIT = 4 * 1024 * 1024; // 4 MB — stay under Vercel's 4.5 MB payload cap

async function stageFileViaSharePoint(estimateId, file) {
  // Get a SharePoint upload session URL from our API
  const prepRes = await fetch(
    `/api/estimating/ai-takeoff?action=prepare-upload&estimateId=${encodeURIComponent(estimateId)}&fileName=${encodeURIComponent(file.name)}`,
  );
  const prepJson = await prepRes.json();
  if (!prepRes.ok) throw new Error(prepJson?.error || "Unable to prepare SharePoint upload.");

  const { uploadUrl, driveId } = prepJson;

  // Upload directly to Microsoft — bypasses Vercel payload limit
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(file.size),
      "Content-Range": `bytes 0-${file.size - 1}/${file.size}`,
    },
    body: file,
  });

  if (![200, 201].includes(uploadRes.status)) {
    const msg = await uploadRes.text();
    throw new Error(`SharePoint upload failed for ${file.name}: ${msg}`);
  }

  const data = await uploadRes.json();
  if (!data?.id) throw new Error(`SharePoint upload did not return an item ID for ${file.name}.`);
  return { driveId, itemId: data.id, name: file.name };
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

async function readResponseJson(response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export function AiTakeoffModal({ open, onClose, estimate, organizationId, onManageConnections, onImport }) {
  const [connections, setConnections] = useState([]);
  const [provider, setProvider] = useState("");
  const [scopeText, setScopeText] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const providerOptions = useMemo(() => {
    if (!connections.length) return AI_PROVIDERS;
    return connections.map((connection) => {
      const meta = AI_PROVIDERS.find((entry) => entry.id === connection.provider);
      return meta || connection;
    });
  }, [connections]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !organizationId) return;

    let cancelled = false;
    async function loadConnections() {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch(`/api/estimating/ai-connections?organizationId=${encodeURIComponent(organizationId)}`);
        const json = await readResponseJson(response);
        if (!response.ok) throw new Error(json?.error || "Unable to load AI connections.");
        const nextConnections = Array.isArray(json?.connections) ? json.connections : [];
        if (!cancelled) {
          setConnections(nextConnections);
          setProvider((current) => current || nextConnections[0]?.provider || "");
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load AI connections.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadConnections();
    return () => {
      cancelled = true;
    };
  }, [open, organizationId]);

  useEffect(() => {
    if (!open) return;
    setResult(null);
  }, [open]);

  if (!open) return null;

  async function runParser(event) {
    event.preventDefault();
    setParsing(true);
    setMessage("");
    setResult(null);
    try {
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      const useSharePoint = totalSize > DIRECT_UPLOAD_LIMIT && files.length > 0;

      const formData = new FormData();
      formData.set("estimateId", estimate.id);
      formData.set("provider", provider);
      formData.set("scopeText", scopeText);

      if (useSharePoint) {
        setMessage("Uploading large files to SharePoint…");
        const tempItems = await Promise.all(files.map((f) => stageFileViaSharePoint(estimate.id, f)));
        setMessage("");
        formData.set("tempItems", JSON.stringify(tempItems));
      } else {
        for (const file of files) {
          formData.append("files", file);
        }
      }

      const response = await fetch("/api/estimating/ai-takeoff", {
        method: "POST",
        body: formData,
      });
      const json = await readResponseJson(response);
      if (!response.ok) throw new Error(json?.error || "Unable to parse scope.");
      setResult(json || {});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to parse scope.");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!result) return;
    try {
      const payload = result.scopeImport || result;
      await onImport?.(payload);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import parsed scope.");
    }
  }

  const connection = connections.find((entry) => entry.provider === provider);
  const providerLabel = AI_PROVIDERS.find((entry) => entry.id === provider)?.label || provider || "Provider";
  const canImport = Boolean(result && onImport);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">AI Parser</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              Upload a scope or drawing set and derive estimator import JSON
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Uses the organization&apos;s saved AI connections and keeps the output aligned to the estimator schema.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              form="ai-parser-form"
              onClick={runParser}
              disabled={parsing || !provider || loading}
              className="rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                backgroundColor: parsing || !provider || loading ? "#94a3b8" : "#059669",
                color: "#ffffff",
                boxShadow: "0 8px 24px rgba(5, 150, 105, 0.18)",
                border: "1px solid rgba(4, 120, 87, 0.35)",
              }}
            >
              {parsing ? "Parsing..." : "Parse scope"}
            </button>
            {onImport && (
              <button
                type="button"
                onClick={handleImport}
                disabled={!result}
                className="rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: result ? "#1d4ed8" : "#94a3b8",
                  color: "#ffffff",
                  boxShadow: result ? "0 8px 24px rgba(29, 78, 216, 0.18)" : "none",
                  border: result ? "1px solid rgba(29, 78, 216, 0.35)" : "1px solid rgba(148, 163, 184, 0.35)",
                }}
              >
                Import into estimate
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[0.95fr_1.05fr]">
          <form id="ai-parser-form" onSubmit={runParser} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-800">Parser inputs</div>
                <button
                  type="button"
                  onClick={onManageConnections}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Manage connections
                </button>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Provider</span>
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500"
                >
                  <option value="">Select a provider</option>
                  {providerOptions.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                <div className="font-semibold text-slate-700">Selected connection</div>
                <div className="mt-1">
                  {connection ? (
                    <>
                      {connection.label || providerLabel}
                      {connection.model ? ` · ${connection.model}` : ""}
                      {connection.endpoint ? ` · ${connection.endpoint}` : ""}
                    </>
                  ) : (
                    "No saved connection selected yet."
                  )}
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Scope text</span>
                <textarea
                  value={scopeText}
                  onChange={(event) => setScopeText(event.target.value)}
                  rows={12}
                  placeholder="Paste the scope of work here."
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500"
                />
              </label>

              <div>
                <div className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Upload scope or drawings
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(event) => setFiles(Array.from(event.target.files || []))}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
                />
                <div className="mt-2 text-xs text-slate-500">
                  {files.length
                    ? `${files.length} file(s) selected${files.reduce((s, f) => s + f.size, 0) > DIRECT_UPLOAD_LIMIT ? " · large files will be staged via SharePoint" : ""}`
                    : "Accepted files are passed through text extraction when possible."}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setScopeText("");
                    setFiles([]);
                    setResult(null);
                    setMessage("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Clear
                </button>
              </div>

              {message && <div className="rounded-2xl border border-rose-200 bg-rose-100 px-4 py-3 text-sm font-medium text-rose-900">{message}</div>}
            </div>
          </form>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">Parsed output</div>
                <div className="mt-1 text-xs text-slate-500">
                  Validate this payload before importing it into the estimator.
                </div>
              </div>
            </div>

            {result && (
              <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(prettyJson(result.scopeImport || result))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
                >
                  Copy JSON
                </button>
                {canImport && (
                  <button
                    type="button"
                    onClick={handleImport}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 sm:w-auto"
                  >
                    Import into estimate
                  </button>
                )}
              </div>
            )}

            <div className="mt-4 min-h-[40vh] overflow-auto rounded-2xl border border-slate-200 bg-white p-4">
              {loading ? (
                <div className="text-sm text-slate-700">Loading saved connections...</div>
              ) : result ? (
                <div className="space-y-4">
                  <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-800">
                    {prettyJson(result.scopeImport || result)}
                  </pre>
                </div>
              ) : (
                <div className="text-sm text-slate-700">
                  Parsed JSON will appear here. The estimator schema expects systems, points, and assembly lists.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
