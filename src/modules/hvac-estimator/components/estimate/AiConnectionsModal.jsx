import { useEffect } from "react";
import { AiConnectionsContent } from "./AiConnectionsContent.jsx";

export function AiConnectionsModal({ open, onClose, organizationId }) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

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
              Keys stay server-side and are stored per organization. You can connect multiple providers, but only one key per provider per organization.
            </div>
            <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">How to add a connection</div>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Choose a provider such as OpenAI, Claude, Gemini, xAI, or Azure OpenAI.</li>
                <li>Enter a label so your team knows what the connection is for.</li>
                <li>Enter the model name or deployment name.</li>
                <li>Paste the API key and save.</li>
              </ol>
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

        <AiConnectionsContent organizationId={organizationId} />
      </div>
    </div>
  );
}
