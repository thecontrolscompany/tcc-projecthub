"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"login" | "reset">("login");
  const [resetSent, setResetSent] = useState(false);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (email.toLowerCase().endsWith("@controlsco.net")) {
      await handleMicrosoftLogin();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.refresh();
    }
  }

  async function handleMicrosoftLogin() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "openid email profile offline_access Files.ReadWrite Mail.ReadWrite Sites.ReadWrite.All",
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/reset-password`,
    });
    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
    }
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-base px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-primary">
            The Controls Company
          </p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">TCC ProjectHub</h1>
        </div>

        <div className="rounded-3xl border border-border-default bg-surface-raised p-8">
          {view === "login" ? (
            <>
              {/* Microsoft SSO -- primary for internal users */}
              <button
                onClick={handleMicrosoftLogin}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm font-semibold text-text-primary transition hover:border-brand-primary/40 hover:bg-surface-overlay disabled:opacity-50"
              >
                <MicrosoftIcon />
                Sign in with Microsoft
              </button>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-surface-overlay" />
                <span className="text-xs text-text-tertiary">or</span>
                <div className="h-px flex-1 bg-surface-overlay" />
              </div>

              {/* Email / password -- for customer portal accounts */}
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                    Email
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
                    placeholder="you@controlsco.net or customer@example.com"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                    Password
                  </label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <p className="rounded-xl bg-status-danger/10 px-4 py-2.5 text-sm text-status-danger">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-50"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <button
                onClick={() => {
                  setView("reset");
                  setError(null);
                }}
                className="mt-4 w-full text-center text-xs text-text-tertiary hover:text-text-secondary"
              >
                Forgot password?
              </button>
            </>
          ) : (
            /* Password reset view */
            <>
              <h2 className="mb-1 text-base font-semibold text-text-primary">
                Reset your password
              </h2>
              <p className="mb-5 text-sm text-text-secondary">
                We&apos;ll email you a link to set a new password.
              </p>

              {resetSent ? (
                <p className="rounded-xl bg-status-success/10 px-4 py-3 text-sm text-status-success">
                  Check your inbox -- reset link sent.
                </p>
              ) : (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
                    placeholder="you@example.com"
                  />
                  {error && (
                    <p className="rounded-xl bg-status-danger/10 px-4 py-2.5 text-sm text-status-danger">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-50"
                  >
                    {loading ? "Sending..." : "Send reset link"}
                  </button>
                </form>
              )}

              <button
                onClick={() => {
                  setView("login");
                  setError(null);
                  setResetSent(false);
                }}
                className="mt-4 w-full text-center text-xs text-text-tertiary hover:text-text-secondary"
              >
                &larr; Back to sign in
              </button>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-text-tertiary">
          Admin &amp; PMs sign in with Microsoft &nbsp;&middot;&nbsp; Customers use email + password
        </p>
      </div>
    </main>
  );
}

function MicrosoftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 21 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="10" height="10" fill="#F25022" />
      <rect x="11" y="0" width="10" height="10" fill="#7FBA00" />
      <rect x="0" y="11" width="10" height="10" fill="#00A4EF" />
      <rect x="11" y="11" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
