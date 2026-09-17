"use client";

import { Mushaf } from "@/components/Mushaf";
import { useLanguage } from "@/components/LanguageProvider";

export default function ParentMushafPage() {
  const { t } = useLanguage();
  return (
    <div className="px-3 pt-3 pb-16 space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h1 className="page-title text-2xl">{t("nav.mushaf")}</h1>
        <span className="eyebrow">{t("common.madinahScript")}</span>
      </div>
      <Mushaf />
    </div>
  );
}
