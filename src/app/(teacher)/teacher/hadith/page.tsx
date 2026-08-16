"use client";

import { ARBAEEN } from "@/data/arbaeen";
import { ArbaeenBook, ArbaeenSummary } from "@/components/ArbaeenBook";
import { PortalHero } from "@/components/PortalHero";

export default function TeacherHadithPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-4 pt-2">
      <PortalHero
        eyebrow="Al-Arba'un an-Nawawiyyah"
        title="Forty Hadith"
        meta={[`${ARBAEEN.length} hadith`, "Arabic and English"]}
      />
      <ArbaeenSummary />
      <ArbaeenBook />
    </div>
  );
}
