"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";

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
  const [schools, setSchools] = useState<School[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The school whose row has its confirm-delete UI open, what's been typed
  // to confirm it, and whether the delete request for it is in flight.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/platform/schools")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load schools");
        setSchools(data.schools);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load schools"));
  }, []);

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

  const totalStudents = schools?.reduce((sum, s) => sum + s.studentCount, 0) ?? 0;
  const totalTeachers = schools?.reduce((sum, s) => sum + s.teacherCount, 0) ?? 0;

  return (
    <div className="min-h-screen bg-surface-bg">
      <header className="gradient-navy px-6 py-8 relative overflow-hidden">
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="max-w-5xl mx-auto relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
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

      <div className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="card-quiet p-6 text-center space-y-2">
            <p className="text-status-error-text font-semibold">{error}</p>
            <p className="text-ink-muted text-sm">
              This page is restricted to the platform operator. If you believe this is a mistake, make sure your
              account has <code className="text-ink">is_platform_admin</code> set in Supabase.
            </p>
          </div>
        )}

        {!error && !schools && <p className="text-ink-muted text-sm">Loading…</p>}

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
                  <tr className="border-b border-surface-border text-left text-xs text-ink-muted uppercase tracking-wide">
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
                      <td className="px-5 py-4 text-right">
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
