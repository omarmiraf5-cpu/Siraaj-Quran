"use client";

import { StudentPageHeader } from "@/components/student-ui";
import { Mushaf } from "@/components/Mushaf";
import { useLanguage } from "@/components/LanguageProvider";

export default function StudentQuranPage() {
  const { tr } = useLanguage();
  // The Mushaf is the page. Chrome above it is kept to a single line so the
  // spread gets the height it needs on a phone.
  return (
    <div className="px-3 pt-4 pb-2 space-y-3">
      <StudentPageHeader compact emoji="📖" eyebrow={tr("Madinah script")} title={tr("Mushaf")} />
      <Mushaf />
    </div>
  );
}
