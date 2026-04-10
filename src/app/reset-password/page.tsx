"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkRecoverySession() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      if (!data.session) {
        setError("This password reset link is no longer valid. Please request a new one.");
      }

      setCheckingSession(false);
    }

    void checkRecoverySession();

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setError(null);
        setCheckingSession(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setMessage("Password updated. Redirecting to sign in...");
    setLoading(false);
    window.setTimeout(() => {
      router.replace("/login");
    }, 1200);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-base px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-primary">
            The Controls Company
          </p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">Set a New Password</h1>
        </div>

        <div className="rounded-3xl border border-border-default bg-surface-raised p-8">
          <p className="mb-5 text-sm text-text-secondary">
            Enter your new password below. After saving, you can sign back in with the updated password.
          </p>

          {checkingSession ? (
            <p className="rounded-xl bg-surface-overlay px-4 py-3 text-sm text-text-secondary">
              Verifying reset link...
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">New password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">Confirm password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
                />
              </div>

              {error && (
                <p className="rounded-xl bg-status-danger/10 px-4 py-2.5 text-sm text-status-danger">{error}</p>
              )}

              {message && (
                <p className="rounded-xl bg-status-success/10 px-4 py-2.5 text-sm text-status-success">{message}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save new password"}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="mt-4 w-full text-center text-xs text-text-tertiary hover:text-text-secondary"
          >
            Back to sign in
          </button>
        </div>
      </div>
    </main>
  );
}
