"use client";

import Link from "next/link";

export default function TeacherDashboard() {
  return (
    <div className="space-y-6 pt-4">
      <div>
        <h1 className="text-3xl font-bold text-ink mb-1">📖 Quranic Portal</h1>
        <p className="text-ink-muted">Manage your students&apos; Quranic assignments</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Link
          href="/teacher/quran-assignments"
          className="bg-surface-card rounded-3xl border border-surface-border p-6 hover:shadow-lg transition-all"
        >
          <p className="text-4xl mb-3">📖</p>
          <h2 className="text-xl font-bold text-ink mb-1">Quranic Assignments</h2>
          <p className="text-sm text-ink-muted">Create and manage Surah assignments for your students</p>
        </Link>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/25 rounded-2xl border border-blue-200 dark:border-blue-800/40 p-4">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          💡 Create assignments by selecting a Surah, Ayah range, student, and due date. Students will see the highlighted Ayahs with Tajweed color coding.
        </p>
      </div>
    </div>
  );
}
