"use client";

import { StudentClassWork, StudentWorkSwitch } from "@/components/class-work-ui";
import { useLanguage } from "@/components/LanguageProvider";
import { StudentPageHeader } from "@/components/student-ui";

/** A child's Islamic Studies and Arabic work, behind the same Work tab as their Qur'an. */
export default function StudentClassWorkPage() {
  const { t } = useLanguage();
  return (
    <div className="px-4 pt-4 pb-4 space-y-5">
      <StudentPageHeader emoji="🕌" eyebrow={t("nav.work")} title={t("cw.title")} />
      <StudentWorkSwitch current="classWork" />
      <StudentClassWork />
    </div>
  );
}
