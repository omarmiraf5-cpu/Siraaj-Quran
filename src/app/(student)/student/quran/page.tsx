"use client";

import { Mushaf } from "@/components/Mushaf";
import { useLanguage } from "@/components/LanguageProvider";

export default function StudentQuranPage() {
  const { tr } = useLanguage();
  // The Mushaf is the page. Chrome above it is kept to a single line so the
  // spread gets the height it needs on a phone.
  return (
    <div className="px-3 pt-4 pb-2 space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h1 className="page-title text-xl">{tr("Mushaf")}</h1>
        <span className="eyebrow">{tr("Madinah script")}</span>
      </div>
      <Mushaf />
    </div>
  );
}
