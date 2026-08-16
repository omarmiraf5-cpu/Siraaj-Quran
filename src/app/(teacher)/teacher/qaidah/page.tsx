"use client";

import { QAIDAH_LESSONS } from "@/data/qaidah";
import { QaidahBook, QaidahSummary } from "@/components/QaidahBook";
import { PortalHero } from "@/components/PortalHero";

export default function TeacherQaidahPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-4 pt-2">
      <PortalHero
        eyebrow="Al-Qa'idah An-Nuraniyah"
        title="Qa'idah"
        meta={[`${QAIDAH_LESSONS.length} lessons`, "letters to fluency"]}
      />
      <QaidahSummary />
      <QaidahBook />
    </div>
  );
}
