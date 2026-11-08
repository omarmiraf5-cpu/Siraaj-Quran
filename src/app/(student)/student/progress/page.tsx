"use client";

import { DEMO_CURRENT_STUDENT, DEMO_TODAY } from "@/data/demo";
import { usePortalRoster } from "@/hooks/usePortalRoster";
import { useRecitationLog } from "@/hooks/useRecitationLog";
import { LoadingNote } from "@/components/portal-ui";
import { StudentPageHeader } from "@/components/student-ui";
import { ProgressCharts } from "@/components/ProgressCharts";
import { RecitationHistory } from "@/components/portal-ui";
import { todayIso } from "@/lib/finance";
import { useLanguage } from "@/components/LanguageProvider";

export default function StudentProgressPage() {
  const { tr } = useLanguage();
  const { mode, students } = usePortalRoster([DEMO_CURRENT_STUDENT]);
  const me = students[0];
  const log = useRecitationLog(me?.id ?? null, mode);

  return (
    <div className="px-4 pt-4 pb-4 space-y-5">
      <StudentPageHeader
        emoji="📈"
        eyebrow={tr("How I'm doing")}
        title={tr("My progress")}
        subtitle={tr("Every time you recite, it counts.")}
      />
      {mode === "loading" || !me ? (
        <LoadingNote />
      ) : (
        <>
          <section className="bg-surface-card rounded-3xl border border-surface-border shadow-card p-4">
            <ProgressCharts entries={log} today={mode === "demo" ? DEMO_TODAY : todayIso()} name={me.name} />
          </section>
          <section className="bg-surface-card rounded-3xl border border-surface-border shadow-card p-4">
            <p className="eyebrow mb-3">{tr("My recitation log")}</p>
            <RecitationHistory entries={log} />
          </section>
        </>
      )}
    </div>
  );
}
