import { useEffect, useMemo, useState } from "react";
import { AI_PROVIDERS } from "../../ai/providerRegistry.js";

const emptyForm = {
  provider: AI_PROVIDERS[0]?.id || "openai",
  label: "",
  model: "",
  endpoint: "",
  apiKey: "",
};

export function AiConnectionsModal({ open, onClose, organizationId }) {
  const [connections, setConnections] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const connectionByProvider = useMemo(() => {
    const map = new Map();
    for (const connection of connections) {
      map.set(connection.provider, connection);
    }
    return map;
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
    if (!open) return;
    if (!organizationId) return;

    let cancelled = false;
    async function loadConnections() {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch(`/api/estimating/ai-connections?organizationId=${encodeURIComponent(organizationId)}`);
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error || "Unable to load AI connections.");
        if (!cancelled) {
          setConnections(Array.isArray(json.connections) ? json.connections : []);
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
    const current = connectionByProvider.get(form.provider);
    setForm((state) => ({
      ...state,
      label: current?.label ?? state.label,
      model: current?.model ?? state.model,
      endpoint: current?.endpoint ?? state.endpoint,
    }));
  }, [connectionByProvider, form.provider, open]);

  if (!open) return null;

  const tabButtonStyle = (isActive) => ({
    backgroundColor: isActive ? "#1f3c5a" : "#ffffff",
    color: isActive ? "#ffffff" : "#334155",
    border: `1px solid ${isActive ? "#1f3c5a" : "#cbd5e1"}`,
  });

  async function saveConnection(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/estimating/ai-connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, organizationId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Unable to save AI connection.");
      setConnections((current) => {
        const next = current.filter((connection) => connection.provider !== json.connection.provider);
        return [...next, json.connection].sort((a, b) => a.provider.localeCompare(b.provider));
      });
      setForm((state) => ({ ...state, apiKey: "" }));
      setMessage("AI connection saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save AI connection.");
    } finally {
      setSaving(false);
    }
  }

  async function removeConnection(provider) {
    if (!window.confirm(`Remove the ${provider} connection?`)) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/estimating/ai-connections", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, provider }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Unable to remove AI connection.");
      setConnections((current) => current.filter((connection) => connection.provider !== provider));
      setMessage("AI connection removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove AI connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">AI Connections</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              Connect a provider key for estimator takeoff and scope parsing
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Keys stay server-side and are stored per user. This first pass supports key-based providers only.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-800">Saved connections</div>
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Loading...</div>
            ) : connections.length ? (
              <div className="space-y-3">
                {connections.map((connection) => (
                  <div key={connection.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {AI_PROVIDERS.find((provider) => provider.id === connection.provider)?.label || connection.provider}
                        </div>
                        <div className="text-sm text-slate-600">
                          {connection.label || "No label"} {connection.model ? `· ${connection.model}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setForm((state) => ({
                            ...state,
                            provider: connection.provider,
                            label: connection.label || "",
                            model: connection.model || "",
                            endpoint: connection.endpoint || "",
                            apiKey: "",
                          }))}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => removeConnection(connection.provider)}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                      Key hint: {connection.key_hint || "stored securely"} {connection.last_used_at ? `· Last used ${new Date(connection.last_used_at).toLocaleString()}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                No AI connections yet.
              </div>
            )}
          </div>

          <form onSubmit={saveConnection} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-sm font-semibold text-slate-800">Add or update connection</div>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Provider</span>
                <select
                  value={form.provider}
                  onChange={(event) => setForm((state) => ({ ...state, provider: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500"
                >
                  {AI_PROVIDERS.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Label</span>
                <input
                  value={form.label}
                  onChange={(event) => setForm((state) => ({ ...state, label: event.target.value }))}
                  placeholder="Jones Hall Claude key"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Model</span>
                <input
                  value={form.model}
                  onChange={(event) => setForm((state) => ({ ...state, model: event.target.value }))}
                  placeholder="Optional model name"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Endpoint / Base URL</span>
                <input
                  value={form.endpoint}
                  onChange={(event) => setForm((state) => ({ ...state, endpoint: event.target.value }))}
                  placeholder="Optional for OpenAI-compatible providers; required for Azure OpenAI"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">API Key</span>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(event) => setForm((state) => ({ ...state, apiKey: event.target.value }))}
                  placeholder="Paste the provider API key"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500"
                />
              </label>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setForm(emptyForm)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={tabButtonStyle(true)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Saving..." : "Save connection"}
                </button>
              </div>
            </div>

            {message && <div className="mt-4 text-sm text-slate-600">{message}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}
