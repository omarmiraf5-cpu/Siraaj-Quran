"use client";

import { ARBAEEN } from "@/data/arbaeen";
import { ArbaeenBook, ArbaeenSummary } from "@/components/ArbaeenBook";

export default function StudentHadithPage() {
  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <header className="gradient-navy rounded-[22px] px-6 py-6 relative overflow-hidden animate-rise">
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative">
          <p className="eyebrow text-white/45">Forty Hadith</p>
          <h1 className="page-title text-white text-[30px] mt-1 leading-tight">An-Nawawi</h1>
          <p
            className="font-calligraphy text-[26px] text-brand-gold-light mt-1.5 leading-tight"
            dir="rtl"
            lang="ar"
          >
            الْأَرْبَعُونَ النَّوَوِيَّةُ
          </p>
          <p className="text-[13px] text-white/55 mt-2.5">
            {ARBAEEN.length} hadith
            <span className="text-white/25 mx-2">·</span>
            Arabic and English
          </p>
        </div>
      </header>

      <ArbaeenSummary />
      <ArbaeenBook />
    </div>
  );
}
