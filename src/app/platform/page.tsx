"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface School {
  id: string;
  name: string;
  slug: string;
  city: string;
  province: string;
  plan: string;
  active: boolean;
  created_at: string;
  studentCount: number;
  teacherCount: number;
  adminContact: { full_name: string; email: string } | null;
}

const PLAN_STYLES: Record<string, string> = {
  starter: "bg-surface-border text-ink-muted",
  growth: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  premium: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function PlatformPage() {
  const router = useRouter();
  const supabase = createClient();
  const [schools, setSchools] = useState<School[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set when the list was refused: nobody signed in (401), or someone who
  // isn't the platform owner (403, with their email), so the page can offer
  // to sign in as the owner instead of dead-ending.
  const [refused, setRefused] = useState<{ status: 401 | 403; email: string | null } | null>(null);
  // The school whose row has its confirm-delete UI open, what's been typed
  // to confirm it, and whether the delete request for it is in flight.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Per school: a welcome email being re-sent, and how that went.
  const [welcome, setWelcome] = useState<Record<string, { sending: boolean; ok?: boolean; message?: string }>>({});

  useEffect(() => {
    fetch("/api/platform/schools")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
          setRefused({ status: res.status, email: data.user?.email ?? null });
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load schools");
        setSchools(data.schools);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load schools"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Out of whichever account this is, then back here once signed in.
  const signInAsOwner = async () => {
    try { localStorage.removeItem("demo_user"); } catch { /* private mode */ }
    document.cookie = "demo_mode=; path=/; max-age=0";
    await supabase.auth.signOut().catch(() => {});
    router.push("/login?next=/platform");
  };

  const startConfirm = (id: string) => {
    setConfirmingId(id);
    setConfirmText("");
    setDeleteError(null);
  };

  const cancelConfirm = () => {
    setConfirmingId(null);
    setConfirmText("");
    setDeleteError(null);
  };

  const deleteSchool = async (school: School) => {
    setDeletingId(school.id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/platform/schools/${school.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete school");
      setSchools((prev) => (prev ?? []).filter((s) => s.id !== school.id));
      setConfirmingId(null);
      setConfirmText("");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete school");
    } finally {
      setDeletingId(null);
    }
  };

  const sendWelcome = async (school: School) => {
    setWelcome((prev) => ({ ...prev, [school.id]: { sending: true } }));
    try {
      const res = await fetch(`/api/platform/schools/${school.id}/welcome`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The welcome email didn't send");
      setWelcome((prev) => ({ ...prev, [school.id]: { sending: false, ok: true, message: `Welcome email sent to ${data.sentTo}.` } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "The welcome email didn't send";
      setWelcome((prev) => ({ ...prev, [school.id]: { sending: false, ok: false, message } }));
    }
  };

  const totalStudents = schools?.reduce((sum, s) => sum + s.studentCount, 0) ?? 0;
  const totalTeachers = schools?.reduce((sum, s) => sum + s.teacherCount, 0) ?? 0;

  return (
    <div className="min-h-screen bg-surface-bg">
      <header className="gradient-navy px-6 py-8 relative overflow-hidden">
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="max-w-7xl mx-auto relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-white/45 text-xs font-semibold uppercase tracking-widest">Platform</p>
            <h1 className="font-display text-3xl font-bold text-white mt-1">All Schools</h1>
            {schools && (
              <p className="text-white/60 text-sm mt-2">
                {schools.length} school{schools.length === 1 ? "" : "s"} · {totalStudents} students · {totalTeachers} teachers
              </p>
            )}
          </div>
          <Link
            href="/onboard"
            className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-4 py-2.5 text-[13px] font-semibold text-[#20180a] hover:brightness-105 active:scale-[.98] transition self-start"
          >
            + Onboard a school
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {refused && (
          <div className="card-quiet p-8 text-center space-y-3 max-w-xl mx-auto">
            <p className="text-ink font-semibold">
              {refused.status === 401 ? "Sign in to see all schools" : "This page is for the platform owner"}
            </p>
            <p className="text-ink-muted text-sm">
              {refused.status === 401 ? (
                "Use the account that's set up as the platform owner."
              ) : refused.email ? (
                <>
                  You&apos;re signed in as <strong className="text-ink">{refused.email}</strong>, which isn&apos;t
                  the platform owner&apos;s account.
                </>
              ) : (
                "The account you're signed in with isn't the platform owner's."
              )}
            </p>
            <button
              type="button"
              onClick={signInAsOwner}
              className="inline-block mt-1 bg-brand-navy text-white text-[13px] font-semibold py-2.5 px-5 rounded-xl hover:opacity-90 active:scale-[.98] transition-all"
            >
              {refused.status === 401 ? "Sign in" : "Sign in with another account"}
            </button>
            {refused.status === 403 && (
              <p className="text-ink-muted text-xs pt-1">
                If this is your own account, make sure it has <code className="text-ink">is_platform_admin</code> set
                in Supabase.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="card-quiet p-6 text-center space-y-2">
            <p className="text-status-error-text font-semibold">{error}</p>
          </div>
        )}

        {!error && !refused && !schools && <p className="text-ink-muted text-sm">Loading…</p>}

        {!error && schools && schools.length === 0 && (
          <div className="card-quiet p-8 text-center space-y-3">
            <p className="text-ink font-semibold">No schools yet.</p>
            <p className="text-ink-muted text-sm">Onboard your first school to see it show up here.</p>
          </div>
        )}

        {!error && schools && schools.length > 0 && (
          <div className="card-quiet overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-start text-xs text-ink-muted uppercase tracking-wide">
                    <th className="px-5 py-3 font-semibold">School</th>
                    <th className="px-5 py-3 font-semibold">Plan</th>
                    <th className="px-5 py-3 font-semibold">Students</th>
                    <th className="px-5 py-3 font-semibold">Teachers</th>
                    <th className="px-5 py-3 font-semibold">Admin Contact</th>
                    <th className="px-5 py-3 font-semibold">Signed Up</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {schools.map((s) => (
                    <Fragment key={s.id}>
                    <tr className="hover:bg-surface-bg-warm transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-ink">{s.name}</p>
                        <p className="text-ink-muted text-xs">
                          {s.city}, {s.province} · {s.slug}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`text-[11px] font-semibold px-2 py-1 rounded-full capitalize ${
                            PLAN_STYLES[s.plan] ?? PLAN_STYLES.starter
                          }`}
                        >
                          {s.plan}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-ink">{s.studentCount}</td>
                      <td className="px-5 py-4 text-ink">{s.teacherCount}</td>
                      <td className="px-5 py-4">
                        {s.adminContact ? (
                          <>
                            <p className="text-ink">{s.adminContact.full_name}</p>
                            <p className="text-ink-muted text-xs">{s.adminContact.email}</p>
                          </>
                        ) : (
                          <span className="text-ink-muted text-xs">No admin found</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-ink-muted">{formatDate(s.created_at)}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                            s.active
                              ? "bg-status-success-bg text-status-success-text"
                              : "bg-status-error-bg text-status-error-text"
                          }`}
                        >
                          {s.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-end whitespace-nowrap">
                        {s.adminContact && (
                          <button
                            type="button"
                            onClick={() => sendWelcome(s)}
                            disabled={welcome[s.id]?.sending}
                            className="text-[11px] font-semibold text-ink hover:underline disabled:opacity-50 me-4"
                          >
                            {welcome[s.id]?.sending ? "Sending…" : "Send welcome email"}
                          </button>
                        )}
                        {confirmingId !== s.id && (
                          <button
                            type="button"
                            onClick={() => startConfirm(s.id)}
                            className="text-[11px] font-semibold text-status-error-text hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                    {welcome[s.id]?.message && (
                      <tr>
                        <td
                          colSpan={8}
                          className={`px-5 py-3 text-[12px] ${
                            welcome[s.id].ok
                              ? "bg-status-success-bg text-status-success-text"
                              : "bg-status-error-bg/40 text-status-error-text"
                          }`}
                        >
                          {welcome[s.id].message}
                        </td>
                      </tr>
                    )}
                    {confirmingId === s.id && (
                      <tr>
                        <td colSpan={8} className="px-5 py-4 bg-status-error-bg/40">
                          <div className="space-y-2.5">
                            <p className="text-[13px] text-ink">
                              This permanently deletes <strong>{s.name}</strong> — every student, staff
                              account, attendance record and message. Their login emails are freed up
                              too. This can&apos;t be undone.
                            </p>
                            <p className="text-[12px] text-ink-muted">
                              Type <strong>{s.name}</strong> to confirm:
                            </p>
                            <div className="flex items-center gap-2">
                              <input
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder={s.name}
                                className="flex-1 max-w-xs bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-status-error-text focus:ring-1 focus:ring-status-error-text/40 transition"
                              />
                              <button
                                type="button"
                                onClick={() => deleteSchool(s)}
                                disabled={
                                  confirmText.trim().toLowerCase() !== s.name.trim().toLowerCase() ||
                                  deletingId === s.id
                                }
                                className="px-3.5 py-2 rounded-lg bg-status-error-text text-white text-[12px] font-semibold disabled:opacity-40 hover:opacity-90 active:scale-[.98] transition-all"
                              >
                                {deletingId === s.id ? "Deleting…" : "Permanently delete"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelConfirm}
                                className="text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                            {deleteError && (
                              <p className="text-[12px] text-status-error-text font-semibold">{deleteError}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
