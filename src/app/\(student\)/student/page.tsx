"use client";

import { useState } from "react";
import Link from "next/link";
import { useDemoUser } from "@/hooks/useDemoUser";
import { useStudentTheme } from "@/hooks/useStudentTheme";

export default function StudentHome() {
  const demoUser = useDemoUser();
  const theme = useStudentTheme();
  const displayName = demoUser?.name ?? "Student";
  const firstName = displayName.split(" ")[0];

  return (
    <div className="px-4 pt-4 pb-6 space-y-6">
      {/* Hero */}
      <div className={`${theme.hero} rounded-3xl px-5 py-5 text-white relative overflow-hidden shadow-lg`}>
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl font-bold border border-white/25">
              {displayName[0]}
            </div>
            <div className="flex-1">
              <p className="text-white/75 text-sm">Asalamu alaykum 👋</p>
              <p className="font-bold text-xl">{firstName}!</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dua */}
      <div className="rounded-3xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-800/40 px-5 py-5 text-center">
        <p className="font-arabic text-2xl md:text-3xl text-amber-900 dark:text-amber-100 leading-[2] mb-2" dir="rtl" lang="ar">
          اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا
        </p>
        <p className="text-sm md:text-base text-amber-800/90 dark:text-amber-200/80 italic">
          &ldquo;O Allah, nothing is easy except what You make easy.&rdquo;
        </p>
      </div>

      {/* Quranic Journey */}
      <div className="space-y-3">
        <h2 className="text-[11px] font-bold text-ink-muted uppercase tracking-[0.12em] px-1">📖 Your Quranic Journey</h2>

        <Link
          href="/student/quran"
          className="group flex items-center gap-4 bg-surface-card rounded-3xl border border-surface-border shadow-card p-4 hover:shadow-card-hover hover:-translate-y-0.5 active:scale-[0.99] transition-all"
        >
          <div className="w-16 h-16 rounded-2xl student-gradient-blue flex items-center justify-center text-3xl flex-shrink-0 shadow-md">
            📖
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-subject-blue font-bold tracking-wide">QURAN</p>
            <p className="font-bold text-base text-ink">Read Your Assignments</p>
            <p className="text-xs text-ink-muted mt-0.5">See what your teacher assigned</p>
          </div>
          <div className="w-11 h-11 rounded-full student-gradient-blue flex items-center justify-center text-white flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
          </div>
        </Link>

        <Link
          href="/student/tajweed"
          className="group flex items-center gap-4 bg-surface-card rounded-3xl border border-surface-border shadow-card p-4 hover:shadow-card-hover hover:-translate-y-0.5 active:scale-[0.99] transition-all"
        >
          <div className="w-16 h-16 rounded-2xl student-gradient-purple flex items-center justify-center text-3xl flex-shrink-0 shadow-md">
            🎨
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-subject-purple font-bold tracking-wide">TAJWEED</p>
            <p className="font-bold text-base text-ink">Learn Recitation Rules</p>
            <p className="text-xs text-ink-muted mt-0.5">Master the art of Quranic recitation</p>
          </div>
          <div className="w-11 h-11 rounded-full student-gradient-purple flex items-center justify-center text-white flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
          </div>
        </Link>
      </div>

      {/* Motivation */}
      <div className="bg-gradient-to-r from-subject-blue to-subject-blue/70 rounded-3xl p-6 text-white text-center">
        <p className="text-lg font-bold mb-2">🌟 Keep Going!</p>
        <p className="text-sm opacity-90">
          Every Ayah you memorize brings you closer to a beautiful connection with the Quran.
        </p>
      </div>
    </div>
  );
}
