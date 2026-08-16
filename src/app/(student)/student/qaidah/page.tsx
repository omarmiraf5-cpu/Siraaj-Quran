"use client";

import { QAIDAH_LESSONS } from "@/data/qaidah";
import { QaidahBook, QaidahSummary } from "@/components/QaidahBook";

export default function StudentQaidahPage() {
  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <header className="gradient-navy rounded-[22px] px-6 py-6 relative overflow-hidden animate-rise">
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative">
          <p className="eyebrow text-white/45">Learning to read</p>
          <h1 className="page-title text-white text-[30px] mt-1 leading-tight">Qa&apos;idah</h1>
          <p
            className="font-calligraphy text-[26px] text-brand-gold-light mt-1.5 leading-tight"
            dir="rtl"
            lang="ar"
          >
            الْقَاعِدَةُ النُّورَانِيَّةُ
          </p>
          <p className="text-[13px] text-white/55 mt-2.5">
            {QAIDAH_LESSONS.length} lessons
            <span className="text-white/25 mx-2">·</span>
            letters to fluency
          </p>
        </div>
      </header>

      <QaidahSummary />
      <QaidahBook />
    </div>
  );
}
