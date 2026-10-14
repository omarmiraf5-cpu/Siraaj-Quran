"use client";

import { ARBAEEN } from "@/data/arbaeen";
import { ArbaeenBook, ArbaeenSummary } from "@/components/ArbaeenBook";
import { PortalHero } from "@/components/PortalHero";
import { useLanguage } from "@/components/LanguageProvider";

export default function TeacherHadithPage() {
  const { tr } = useLanguage();
  return (
    <div className="max-w-5xl mx-auto space-y-4 pt-2">
      <PortalHero
        eyebrow={tr("Al-Arba'un an-Nawawiyyah")}
        title={tr("Forty Hadith")}
        meta={[tr("{count} hadith|{count} hadith", { count: ARBAEEN.length }), tr("Arabic and English")]}
      />
      <ArbaeenSummary />
      <ArbaeenBook />
    </div>
  );
}
