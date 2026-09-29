"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { LanguageToggle } from "@/components/LanguageToggle";

interface Welcome {
  name: string;
  email: string;
  role: string;
  school: string;
}

/** Why the form can't be shown: a dead link, a switched-off account, or no answer. */
type Problem = "link" | "off" | "network";

// Reached from the welcome email a new teacher or parent gets
// (lib/accountWelcome). They choose a password and are signed straight in.
// The link is spent when the password is saved, not when the page opens:
// mail scanners that open links before the reader does would otherwise use
// it up.
export default function WelcomePage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  const [token, setToken] = useState("");
  const [account, setAccount] = useState<Welcome | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // A translation key where there is one, so it follows a change of language.
  const [error, setError] = useState<{ key: string } | { text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const found = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(found);
    if (!found) {
      setProblem("link");
      return;
    }
    fetch(`/api/auth/welcome?token=${encodeURIComponent(found)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) setAccount(data);
        else setProblem(data.error === "off" ? "off" : "link");
      })
      .catch(() => setProblem("network"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Trimmed, as the sign-in page trims what's typed there.
    const chosen = password.trim();
    if (chosen.length < 8) {
      setError({ key: "changePassword.tooShort" });
      return;
    }
    if (chosen !== confirm.trim()) {
      setError({ key: "changePassword.mismatch" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: chosen }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (["invalid", "expired", "used"].includes(data.error)) setProblem("link");
        else if (data.error === "off") setProblem("off");
        else setError(data.error ? { text: data.error } : { key: "welcome.failed" });
        return;
      }
      // Out of the sample portal, if this browser was in it, and into theirs.
      try {
        localStorage.removeItem("demo_user");
      } catch {
        /* private mode */
      }
      document.cookie = "demo_mode=; path=/; max-age=0";
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.email, password: chosen });
      router.replace(signInError ? "/login" : `/${data.role}`);
    } catch {
      setError({ key: "welcome.failed" });
    } finally {
      setSaving(false);
    }
  };

  const firstName = account?.name.trim().split(/\s+/)[0] ?? "";
  const field =
    "w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition";

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center px-4 py-12">
      <div className="card-quiet w-full max-w-sm p-8 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold text-ink">{t("welcome.title")}</h1>
          <LanguageToggle
            variant="pill"
            className="flex-shrink-0 bg-surface-card border border-surface-border text-ink-muted hover:text-ink"
          />
        </div>

        {problem ? (
          <>
            <p className="text-ink-muted text-sm leading-relaxed">
              {problem === "off"
                ? t("welcome.accountOff")
                : problem === "network"
                  ? t("welcome.failed")
                  : t("welcome.linkInvalid")}
            </p>
            <Link
              href="/login"
              className="block w-full text-center gradient-emerald text-white font-semibold py-3 rounded-2xl hover:opacity-90 active:scale-[.98] transition-all"
            >
              {t("welcome.signIn")}
            </Link>
            {problem !== "off" && (
              <Link
                href="/forgot-password"
                className="block text-center text-sm font-semibold text-ink-muted hover:text-ink transition-colors"
              >
                {t("login.forgotPassword")}
              </Link>
            )}
          </>
        ) : !account ? (
          <p className="text-ink-muted text-sm">{t("common.loading")}</p>
        ) : (
          <>
            <div className="space-y-1.5 text-sm leading-relaxed">
              <p className="text-ink font-semibold">
                {t("welcome.salam")}
                {firstName ? ` ${firstName}` : ""}
              </p>
              <p className="text-ink-muted">
                {t("welcome.addedTo")}{" "}
                <strong className="text-ink">
                  <bdi>{account.school}</bdi>
                </strong>
                .
              </p>
              <p className="text-ink-muted">
                {t("welcome.passwordFor")}
                <span className="block font-semibold text-ink [overflow-wrap:anywhere]">
                  <bdi>{account.email}</bdi>
                </span>
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="welcome-password" className="block text-sm font-semibold text-ink mb-1.5">
                  {t("changePassword.newPassword")}
                </label>
                <input
                  id="welcome-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("changePassword.newPasswordPlaceholder")}
                  autoFocus
                  className={field}
                />
              </div>
              <div>
                <label htmlFor="welcome-confirm" className="block text-sm font-semibold text-ink mb-1.5">
                  {t("changePassword.confirmPassword")}
                </label>
                <input
                  id="welcome-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t("changePassword.confirmPlaceholder")}
                  className={field}
                />
              </div>

              {error && (
                <p className="text-sm text-status-error-text font-semibold">
                  {"key" in error ? t(error.key) : error.text}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-50 hover:opacity-90 active:scale-[.98] transition-all"
              >
                {saving ? t("changePassword.saving") : t("welcome.submit")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
