"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SUPPORT_EMAIL } from "@/lib/site";

/**
 * Your account, for every role: who you are, your password, the privacy
 * policy and help, and deleting the account — which the app stores require
 * be possible from inside the app. What deleting means depends on the role;
 * see /api/account.
 */

interface Info {
  full_name: string;
  role: "admin" | "teacher" | "parent" | "student";
  email: string | null;
  school_name: string;
  sole_admin: boolean;
}

const ROLE_LABEL: Record<Info["role"], string> = {
  admin: "School admin",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

const input =
  "w-full bg-surface-card border border-surface-border rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/30 transition";

export default function AccountPage() {
  const router = useRouter();
  const supabase = createClient();
  const [info, setInfo] = useState<Info | null>(null);
  const [demo, setDemo] = useState<{ role: Info["role"]; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "deleted" | "school" | "requested">(null);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // The sample portal signs people in without a real account.
        try {
          const d = JSON.parse(localStorage.getItem("demo_user") ?? "null");
          if (d?.role) {
            setDemo({ role: d.role, name: d.name ?? d.full_name ?? ROLE_LABEL[d.role as Info["role"]] });
            return;
          }
        } catch {
          /* fall through */
        }
        router.replace("/login");
        return;
      }
      const res = await fetch("/api/account");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't load your account");
      setInfo(body);
    };
    load().catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your account"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const role = info?.role ?? demo?.role ?? null;

  const remove = async (deleteSchool = false) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm, deleteSchool }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "That didn't go through — please try again");
      if (body.requested) {
        setDone("requested");
        return;
      }
      setDone(body.deleted_school ? "school" : "deleted");
      await supabase.auth.signOut().catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through — please try again");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    try { localStorage.removeItem("demo_user"); } catch { /* private mode */ }
    document.cookie = "demo_mode=; path=/; max-age=0";
    await supabase.auth.signOut().catch(() => {});
    router.replace("/login");
  };

  if (done === "deleted" || done === "school") {
    return (
      <Shell>
        <section className="card-quiet p-6 text-center space-y-3">
          <p className="page-title text-xl">
            {done === "school" ? "Your school has been deleted" : "Your account has been deleted"}
          </p>
          <p className="text-[13px] text-ink-muted leading-relaxed">
            {done === "school"
              ? "The school, its records and every account in it have been removed from MyDiiwaan."
              : "Your login and your details have been removed. The school keeps the lessons, attendance and messages you recorded, without your name."}
          </p>
          <Link href="/login" className="inline-block mt-2 bg-brand-navy text-white text-[13px] font-semibold py-2.5 px-5 rounded-xl">
            Done
          </Link>
        </section>
      </Shell>
    );
  }

  return (
    <Shell back={role ? `/${role}` : "/login"}>
      {!info && !demo && !error && <p className="text-[13px] text-ink-muted text-center py-10">Loading your account…</p>}
      {error && !info && !demo && <p className="text-[13px] text-red-700 dark:text-red-300 text-center py-10">{error}</p>}

      {(info || demo) && (
        <>
          <section className="card-quiet p-5">
            <p className="eyebrow">Your account</p>
            <p className="page-title text-xl mt-1">{info?.full_name ?? demo?.name}</p>
            <p className="text-[13px] text-ink-muted mt-1">
              {role ? ROLE_LABEL[role] : ""}
              {info ? ` · ${info.school_name}` : " · Sample portal"}
            </p>
            {info?.email && <p className="text-[13px] text-ink-muted mt-0.5">{info.email}</p>}
          </section>

          <section className="card-quiet divide-y divide-surface-border">
            {role !== "student" && <Row href="/change-password" label="Change password" />}
            <Row href="/privacy" label="Privacy policy" />
            <Row href="/support" label="Help and support" />
            <button type="button" onClick={signOut} className="w-full text-start px-5 py-3.5 text-[14px] font-semibold text-ink hover:bg-surface-bg-warm transition">
              Sign out
            </button>
          </section>

          <section className="card-quiet p-5 space-y-3">
            <p className="eyebrow text-red-700 dark:text-red-300">Delete account</p>

            {demo && (
              <p className="text-[13px] text-ink-muted leading-relaxed">
                This is the sample portal, so there is no account to delete. On your school&apos;s portal you can
                delete your account here.
              </p>
            )}

            {info?.role === "student" && (
              done === "requested" ? (
                <p className="text-[13px] text-green-800 dark:text-green-300 leading-relaxed">
                  Sent. {info.school_name}&apos;s office has been asked to delete your account.
                </p>
              ) : (
                <>
                  <p className="text-[13px] text-ink leading-relaxed">
                    Your account was made by {info.school_name}, so the school deletes it. Tap below to ask them
                    to — it removes your name, your work and your sign-in.
                  </p>
                  <button
                    type="button"
                    onClick={() => remove()}
                    disabled={busy}
                    className="bg-red-700 text-white text-[13px] font-semibold py-2.5 px-4 rounded-xl disabled:opacity-50"
                  >
                    {busy ? "Sending…" : "Ask my school to delete my account"}
                  </button>
                </>
              )
            )}

            {info && info.role !== "student" && !info.sole_admin && (
              <>
                <p className="text-[13px] text-ink leading-relaxed">
                  This removes your login and your details from MyDiiwaan. The lessons, attendance and messages
                  you recorded stay with {info.school_name}, without your name. It can&apos;t be undone.
                </p>
                <label className="block">
                  <span className="text-[12px] text-ink-muted">Type DELETE to confirm</span>
                  <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="characters" className={`${input} mt-1`} />
                </label>
                <button
                  type="button"
                  onClick={() => remove()}
                  disabled={busy || confirm.trim().toLowerCase() !== "delete"}
                  className="bg-red-700 text-white text-[13px] font-semibold py-2.5 px-4 rounded-xl disabled:opacity-40"
                >
                  {busy ? "Deleting…" : "Delete my account"}
                </button>
              </>
            )}

            {info?.sole_admin && (
              <>
                <p className="text-[13px] text-ink leading-relaxed">
                  You&apos;re the only admin of {info.school_name}, so deleting your account deletes the school:
                  every student, teacher and parent account in it, and all of its records. It can&apos;t be undone.
                  To keep the school running without you, add another admin first, then come back and delete just
                  your own account.
                </p>
                <label className="block">
                  <span className="text-[12px] text-ink-muted">Type the school&apos;s name, {info.school_name}, to confirm</span>
                  <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`${input} mt-1`} />
                </label>
                <button
                  type="button"
                  onClick={() => remove(true)}
                  disabled={busy || confirm.trim().toLowerCase() !== info.school_name.trim().toLowerCase()}
                  className="bg-red-700 text-white text-[13px] font-semibold py-2.5 px-4 rounded-xl disabled:opacity-40"
                >
                  {busy ? "Deleting…" : "Delete the school and my account"}
                </button>
              </>
            )}

            {error && (info || demo) && <p role="alert" className="text-[12.5px] text-red-700 dark:text-red-300">{error}</p>}
            <p className="text-[11.5px] text-ink-muted">
              Questions about your data? Email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">{SUPPORT_EMAIL}</a>.
            </p>
          </section>
        </>
      )}
    </Shell>
  );
}

function Row({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between px-5 py-3.5 text-[14px] font-semibold text-ink hover:bg-surface-bg-warm transition">
      {label}
      <span aria-hidden className="text-ink-muted">›</span>
    </Link>
  );
}

function Shell({ children, back }: { children: React.ReactNode; back?: string }) {
  return (
    <div className="min-h-screen bg-surface-bg">
      <header className="gradient-navy text-white">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          {back && (
            <Link href={back} aria-label="Back" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            </Link>
          )}
          <p className="font-display text-lg font-bold">Account</p>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 py-5 space-y-4 pb-16">{children}</main>
    </div>
  );
}
