"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

// "Forgot your password?" from the sign-in page. Whatever address is
// entered, the answer is the same "check your email": the server only
// sends to real admin, teacher and parent accounts, and doesn't say which
// addresses those are.
export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whatever was already typed on the sign-in page, handed over through
  // sessionStorage (the key the sign-in page writes).
  useEffect(() => {
    try {
      const typed = sessionStorage.getItem("mydiiwaan_reset_email");
      sessionStorage.removeItem("mydiiwaan_reset_email");
      if (typed) setEmail(typed);
    } catch {
      /* private mode */
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "That didn't go through. Please try again.");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't go through. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center px-4 py-12">
      <div className="card-quiet w-full max-w-sm p-8 space-y-5">
        {sent ? (
          <>
            <div>
              <h1 className="text-xl font-bold text-ink">{t("forgot.sentTitle")}</h1>
              <p className="text-ink-muted text-sm mt-1.5 leading-relaxed">{t("forgot.sentBody")}</p>
            </div>
            <Link
              href="/login"
              className="block w-full text-center gradient-emerald text-white font-semibold py-3 rounded-2xl hover:opacity-90 active:scale-[.98] transition-all"
            >
              {t("forgot.backToSignIn")}
            </Link>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-xl font-bold text-ink">{t("forgot.title")}</h1>
              <p className="text-ink-muted text-sm mt-1.5 leading-relaxed">{t("forgot.subtitle")}</p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">{t("login.emailAddress")}</label>
                <input
                  type="email"
                  required
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                />
              </div>

              {error && <p className="text-sm text-status-error-text font-semibold">{error}</p>}

              <button
                type="submit"
                disabled={sending}
                className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-50 hover:opacity-90 active:scale-[.98] transition-all"
              >
                {sending ? t("forgot.sending") : t("forgot.send")}
              </button>

              <Link
                href="/login"
                className="block text-center text-sm font-semibold text-ink-muted hover:text-ink transition-colors"
              >
                {t("forgot.backToSignIn")}
              </Link>
            </form>

            <p className="text-xs text-ink-muted leading-relaxed border-t border-surface-border pt-4">
              {t("forgot.students")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
