"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// Reached two ways: forced right after signing in with a temporary password
// (teacher/parent accounts created by an admin or by /api/onboard carry
// must_change_password in their auth metadata), or visited on purpose later
// from the portal nav to change a password that's already their own choice.
// Same form either way — only the framing text and whether "cancel" is
// offered depend on which one this is.
export default function ChangePasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [required, setRequired] = useState(false);
  const [role, setRole] = useState<string>("login");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setRequired(Boolean(user.user_metadata?.must_change_password));
      setRole((user.user_metadata?.role as string) ?? "login");
      setReady(true);
    });
  }, [router, supabase]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push(`/${role}`);
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <p className="text-ink-muted text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center px-4 py-12">
      <div className="card-quiet w-full max-w-sm p-8 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-ink">
            {required ? "Set your password" : "Change your password"}
          </h1>
          <p className="text-ink-muted text-sm mt-1.5">
            {required
              ? "You're signing in with a temporary password. Choose your own before continuing."
              : "Choose a new password for your account."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoFocus
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type it again"
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            />
          </div>

          {error && <p className="text-sm text-status-error-text font-semibold">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-50 hover:opacity-90 active:scale-[.98] transition-all"
          >
            {saving ? "Saving…" : "Set password"}
          </button>

          {!required && (
            <Link
              href={`/${role}`}
              className="block text-center text-sm font-semibold text-ink-muted hover:text-ink transition-colors"
            >
              Cancel
            </Link>
          )}
        </form>
      </div>
    </div>
  );
}
