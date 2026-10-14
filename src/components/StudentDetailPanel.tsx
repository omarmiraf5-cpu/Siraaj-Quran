"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DEMO_STUDENTS,
  DEMO_ATTENDANCE,
  DEMO_CREATED_ASSIGNMENTS_KEY,
  demoAssignmentsFor,
  summariseAttendance,
  formatDay,
  dueLabel,
  initials,
  ASSIGNMENT_STYLES,
  type AttendanceDay,
} from "@/data/demo";
import { getSurahById } from "@/data/mushaf-index";
import {
  Modal,
  AttendanceStrip,
  AttendanceLegend,
  ProgressBar,
  EmptyNote,
  TeacherNote,
} from "@/components/portal-ui";
import { readDemoStore } from "@/lib/demoStore";
import type { QuranicAssignment } from "@/hooks/useQuranicAssignments";
import { useLanguage } from "@/components/LanguageProvider";
import { countLabel } from "@/lib/i18n/phrases";
import { ASSIGNMENT_STATUS_KEY } from "@/lib/i18n/translations";

/**
 * One student at a glance: attendance and their work. In the sample school
 * it reads the sample data; a real school's page passes what it has
 * already loaded for the student (`real`), so opening it costs nothing.
 */
export function StudentDetailPanel({
  studentId,
  onClose,
  real,
  registerHref,
}: {
  studentId: string;
  onClose: () => void;
  real?: {
    student: { id: string; name: string; halaqa: string };
    attendance: AttendanceDay[];
    assignments: QuranicAssignment[];
  };
  /** Where "Take register" goes — their halaqa's register. */
  registerHref?: string;
}) {
  const { t, language, tr } = useLanguage();
  const student = real ? real.student : DEMO_STUDENTS.find((s) => s.id === studentId);
  const [createdAssignments, setCreatedAssignments] = useState<QuranicAssignment[]>([]);

  useEffect(() => {
    if (!real) setCreatedAssignments(readDemoStore(DEMO_CREATED_ASSIGNMENTS_KEY, []));
  }, [real]);

  if (!student) return null;

  // Newest first, as the strip reads them.
  const attendance = real
    ? [...real.attendance].sort((a, b) => b.date.localeCompare(a.date))
    : DEMO_ATTENDANCE[student.id] ?? [];
  const summary = summariseAttendance(attendance);
  const assignments = real ? real.assignments.filter((a) => a.student_id === student.id) : demoAssignmentsFor(student.id, createdAssignments);
  const open = assignments.filter((a) => a.status !== "completed").length;

  return (
    <Modal
      title={student.name}
      subtitle={student.halaqa}
      badge={initials(student.name)}
      onClose={onClose}
    >
      <div className="space-y-5">
        {/* Three numbers first: how often they come, what's open, what's done. */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: `${summary.rate}%`, label: t("common.attendanceStat") },
            { value: open, label: t("common.openWork") },
            { value: assignments.length - open, label: t("assignment.completed") },
          ].map((x) => (
            <div key={x.label} className="rounded-2xl border border-surface-border bg-surface-bg-warm px-3 py-2.5">
              <p className="text-[20px] font-bold text-ink tabular-nums leading-none">{x.value}</p>
              <p className="text-[11px] text-ink-muted mt-1.5 leading-tight">{x.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={registerHref ?? "/teacher/attendance"}
            className="inline-flex items-center rounded-full gradient-emerald text-white text-[12.5px] font-semibold px-4 py-2 hover:opacity-90 transition-opacity"
          >
            {t("teacher.dashboard.takeRegister")}
          </Link>
          <Link
            href="/teacher/quran-assignments"
            className="inline-flex items-center rounded-full border border-surface-border text-ink text-[12.5px] font-semibold px-4 py-2 hover:border-brand-navy transition-colors"
          >
            {t("common.assign")}
          </Link>
        </div>

        {/* Attendance */}
        <div>
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">{t("common.attendanceStat")}</p>
            <span className="text-[11px] text-ink-muted tabular-nums">
              {summary.rate}% {t("common.thisTerm")}
            </span>
          </div>

          <div className="mt-3">
            <AttendanceLegend counts={summary} />
          </div>

          <div className="mt-3.5">
            <AttendanceStrip days={attendance} />
          </div>
        </div>

        <div className="gold-rule" />

        {/* Assignments — the same records the review queue and the
            assignments page draw from, filtered to this student. */}
        <div>
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">{t("nav.assignments")}</p>
            <span className="text-[11px] text-ink-muted tabular-nums">
              {countLabel("{count} total", assignments.length, `${assignments.length} ${t("common.total")}`)}
            </span>
          </div>

          {assignments.length === 0 ? (
            <EmptyNote>{t("common.noAssignmentsYet")}</EmptyNote>
          ) : (
            <ul className="space-y-4 mt-3">
              {assignments.map((a) => {
                const surah = getSurahById(a.surah);
                const surahEnd = a.surah_end !== a.surah ? getSurahById(a.surah_end) : null;
                const due = a.status === "completed" ? null : dueLabel(a.due_date);
                return (
                  <li key={a.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="eyebrow underline decoration-2 underline-offset-2 text-ink">
                          {t(`portion.${a.portion}`)}
                        </p>
                        <p className="text-[13px] font-semibold text-ink mt-0.5">
                          {surahEnd ? (
                            `${surah?.englishName ?? `Surah ${a.surah}`} ${a.ayah_start} – ${surahEnd.englishName} ${a.ayah_end}`
                          ) : (
                            <>
                              {surah ? surah.englishName : tr("Surah {surah}", { surah: a.surah })}
                              <span className="font-normal text-ink-muted">
                                {" "}
                                · {t("common.ayahs")} {a.ayah_start}–{a.ayah_end}
                              </span>
                            </>
                          )}
                        </p>
                        {due && a.due_date && (
                          <p
                            className={`text-[11px] mt-0.5 ${
                              due.urgent
                                ? "text-red-700 dark:text-red-300 font-semibold"
                                : "text-ink-muted"
                            }`}
                          >
                            {due.text} · {formatDay(a.due_date, language)}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap ${ASSIGNMENT_STYLES[a.status]}`}
                      >
                        {t(ASSIGNMENT_STATUS_KEY[a.status])}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 mt-2">
                      <div className="flex-1">
                        <ProgressBar value={a.memorization_level} />
                      </div>
                      <span className="text-[11px] font-semibold text-ink-muted tabular-nums w-8 text-end">
                        {a.memorization_level}%
                      </span>
                    </div>

                    {a.teacher_notes && <TeacherNote>{a.teacher_notes}</TeacherNote>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
