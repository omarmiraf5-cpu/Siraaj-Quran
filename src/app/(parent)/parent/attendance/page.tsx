"use client";

import { useEffect, useState } from "react";
import {
  ATTENDANCE_STYLES,
  summariseAttendance,
  formatDay,
} from "@/data/demo";
import { usePortalRoster, useStudentRecord } from "@/hooks/usePortalRoster";
import { PortalHero } from "@/components/PortalHero";
import {
  SectionCard,
  AttendanceStrip,
  AttendanceLegend,
  SegmentedSwitch,
  EmptyNote,
  LoadingNote,
} from "@/components/portal-ui";
import { useLanguage } from "@/components/LanguageProvider";

export default function ParentAttendancePage() {
  const { t, language } = useLanguage();
  // RLS narrows this to the signed-in parent's own children; in demo mode
  // it's the two sample ones.
  const { mode, students: children } = usePortalRoster();
  const [childId, setChildId] = useState<string | null>(null);
  const child = children.find((c) => c.id === childId) ?? children[0] ?? null;

  useEffect(() => {
    if (!childId && children.length > 0) setChildId(children[0].id);
  }, [children, childId]);

  const { attendance: days, ready } = useStudentRecord(child?.id ?? null, mode);
  const s = summariseAttendance(days);

  if (mode === "loading" || !child) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 pt-2">
        <PortalHero eyebrow={t("nav.attendance")} title="…" />
        <SectionCard title={t("common.yourChildren")}>
          {mode === "loading" ? (
            <LoadingNote />
          ) : (
            <EmptyNote>{t("common.noChildrenLinked")}</EmptyNote>
          )}
        </SectionCard>
      </div>
    );
  }

  const firstName = child.name.split(" ")[0];
  const lastDays = [t("common.last"), String(s.total), t("common.schoolDays")]
    .filter((x) => x !== "")
    .join(" ");

  return (
    <div className="max-w-4xl mx-auto space-y-4 pt-2">
      <PortalHero
        eyebrow={t("nav.attendance")}
        title={firstName}
        meta={[child.halaqa, lastDays, `${s.rate}% ${t("common.present").toLowerCase()}`]}
      />

      {children.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="eyebrow">{t("common.viewing")}</span>
          <SegmentedSwitch
            label={t("common.selectChild")}
            value={child.id}
            onChange={setChildId}
            options={children.map((c) => ({ value: c.id, label: c.name.split(" ")[0] }))}
          />
        </div>
      )}

      {!ready && <LoadingNote>{t("common.loadingAttendance")}</LoadingNote>}

      <SectionCard title={t("common.overall")} note={`${s.total} ${t("common.days")}`}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[40px] font-bold text-ink tabular-nums leading-none">{s.rate}%</p>
            <p className="text-[12px] text-ink-muted mt-2 max-w-xs">
              {s.rate >= 95
                ? t("parent.attendance.excellent")
                : s.rate >= 85
                  ? t("parent.attendance.good")
                  : t("parent.attendance.belowTarget")}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <AttendanceStrip days={days} />
        </div>

        <div className="mt-4">
          <AttendanceLegend counts={s} />
        </div>
      </SectionCard>

      <div className="grid grid-cols-4 gap-2">
        {(["present", "late", "absent", "excused"] as const).map((k) => (
          <div key={k} className={`rounded-2xl px-2 py-3.5 text-center ${ATTENDANCE_STYLES[k]}`}>
            <p className="text-[22px] font-bold tabular-nums leading-none">{s[k]}</p>
            <p className="text-[10px] font-semibold mt-1.5 uppercase tracking-wider">
              {t(`common.${k}`)}
            </p>
          </div>
        ))}
      </div>

      <SectionCard title={t("common.dayByDay")} note={`${s.total} ${t("common.days")}`}>
        <ul className="divide-y divide-surface-border -my-1">
          {days.map((d) => (
            <li key={d.date} className="flex items-center justify-between py-2.5">
              <span className="text-[13px] text-ink">{formatDay(d.date, language)}</span>
              <span
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${ATTENDANCE_STYLES[d.status]}`}
              >
                {t(`common.${d.status}`)}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
