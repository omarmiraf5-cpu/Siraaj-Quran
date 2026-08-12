"use client";

import Link from "next/link";
import { useDemoUser } from "@/hooks/useDemoUser";

export default function TeacherDashboard() {
  const demoUser = useDemoUser();

  return (
    <div className="space-y-6 pt-4">
      <div className="gradient-navy rounded-card-lg px-6 py-5">
        <p className="text-white/55 text-sm font-medium">Asalamu alaykum,</p>
        <h1 className="text-white text-xl font-bold mt-0.5">{demoUser?.name ?? "Teacher"}</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Link
          href="/teacher/quran-assignments"
          className="bg-surface-card rounded-3xl border border-surface-border p-6 hover:shadow-lg transition-all hover:-translate-y-0.5"
        >
          <p className="text-4xl mb-3">📖</p>
          <h2 className="text-xl font-bold text-ink mb-1">Quranic Assignments</h2>
          <p className="text-sm text-ink-muted">Create and manage Surah assignments for your students</p>
        </Link>

        <div className="bg-surface-card rounded-3xl border border-surface-border p-6">
          <p className="text-4xl mb-3">📊</p>
          <h2 className="text-xl font-bold text-ink mb-1">Student Progress</h2>
          <p className="text-sm text-ink-muted">View memorization levels and assignment status</p>
        </div>
      </div>

      <div className="bg-emerald-50 dark:bg-emerald-950/25 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 p-5 text-center space-y-2">
        <p className="font-arabic text-lg text-emerald-800 dark:text-emerald-200 leading-loose" dir="rtl" lang="ar">
          «خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ»
        </p>
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          &ldquo;The best among you are those who learn the Qur&apos;an and teach it.&rdquo;
        </p>
        <p className="text-xs text-emerald-600 dark:text-emerald-400">— Prophet Muhammad &#xFDFA;</p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/25 rounded-2xl border border-blue-200 dark:border-blue-800/40 p-4">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Create assignments by selecting a Surah, Ayah range, student, and due date. Students will see the highlighted Ayahs with Tajweed color coding.
        </p>
      </div>
    </div>
  );
}
