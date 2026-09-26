"use client";

import { StudentClassWork, StudentWorkSwitch } from "@/components/class-work-ui";
import { useLanguage } from "@/components/LanguageProvider";

/** A child's Islamic Studies and Arabic work, behind the same Work tab as their Qur'an. */
export default function StudentClassWorkPage() {
  const { t } = useLanguage();
  return (
    <div className="px-4 pt-4 pb-4 space-y-5">
      <header className="gradient-navy rounded-[22px] px-6 py-6 relative overflow-hidden animate-rise">
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative">
          <p className="eyebrow text-white/45">{t("nav.work")}</p>
          <h1 className="page-title text-white text-[28px] mt-1 leading-tight">{t("cw.title")}</h1>
        </div>
      </header>
      <StudentWorkSwitch current="classWork" />
      <StudentClassWork />
    </div>
  );
}
