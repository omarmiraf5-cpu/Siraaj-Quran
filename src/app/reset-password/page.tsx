"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

// Reached from the "Reset your password" email. The link's token is spent
// when the new password is submitted, not when the page opens: mail
// scanners that open links before the reader does would otherwise use it
// up, and the reader would find a dead link.
export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  const [tokenHash, setTokenHash] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.search).get("token_hash");
    setTokenHash(hash);
    setLinkInvalid(!hash);
    setReady(true);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t("changePassword.tooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("changePassword.mismatch"));
      return;
    }

    setSaving(true);
    // Spending the token signs them in. It only works once, so a second
    // try (after Supabase turned down the password itself, say) skips it.
    if (!verified) {
      const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash ?? "", type: "recovery" });
      if (verifyError) {
        setSaving(false);
        setLinkInvalid(true);
        return;
      }
      setVerified(true);
    }

    const { data, error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    if (updateError || !data.user) {
      setSaving(false);
      setError(updateError?.message ?? "That didn't go through. Please try again.");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    router.replace(profile?.role ? `/${profile.role}` : "/login");
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <p className="text-ink-muted text-sm">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center px-4 py-12">
      <div className="card-quiet w-full max-w-sm p-8 space-y-5">
        {linkInvalid ? (
          <>
            <div>
              <h1 className="text-xl font-bold text-ink">{t("forgot.title")}</h1>
              <p className="text-ink-muted text-sm mt-1.5 leading-relaxed">{t("reset.linkInvalid")}</p>
            </div>
            <Link
              href="/forgot-password"
              className="block w-full text-center gradient-emerald text-white font-semibold py-3 rounded-2xl hover:opacity-90 active:scale-[.98] transition-all"
            >
              {t("reset.getNewLink")}
            </Link>
            <Link
              href="/login"
              className="block text-center text-sm font-semibold text-ink-muted hover:text-ink transition-colors"
            >
              {t("forgot.backToSignIn")}
            </Link>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-xl font-bold text-ink">{t("reset.title")}</h1>
              <p className="text-ink-muted text-sm mt-1.5">{t("reset.subtitle")}</p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">
                  {t("changePassword.newPassword")}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("changePassword.newPasswordPlaceholder")}
                  autoFocus
                  className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">
                  {t("changePassword.confirmPassword")}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t("changePassword.confirmPlaceholder")}
                  className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                />
              </div>

              {error && <p className="text-sm text-status-error-text font-semibold">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-50 hover:opacity-90 active:scale-[.98] transition-all"
              >
                {saving ? t("changePassword.saving") : t("changePassword.submit")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
