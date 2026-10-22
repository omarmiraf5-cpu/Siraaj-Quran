"use client";

import { ARBAEEN } from "@/data/arbaeen";
import { ArbaeenBook, ArbaeenSummary } from "@/components/ArbaeenBook";
import { StudentPageHeader } from "@/components/student-ui";
import { useLanguage } from "@/components/LanguageProvider";

export default function StudentHadithPage() {
  const { tr } = useLanguage();
  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <StudentPageHeader
        emoji="📜"
        eyebrow={tr("Forty Hadith")}
        title={tr("An-Nawawi")}
        arabic="الْأَرْبَعُونَ النَّوَوِيَّةُ"
        back={{ href: "/student/learn", label: tr("Learn") }}
        subtitle={<>{tr("{count} hadith", { count: ARBAEEN.length })} · {tr("Arabic and English")}</>}
      />

      <ArbaeenSummary />
      <ArbaeenBook />
    </div>
  );
}
