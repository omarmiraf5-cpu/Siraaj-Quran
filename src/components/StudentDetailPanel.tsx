"use client";

import { useEffect, useState } from "react";
import {
  DEMO_STUDENTS,
  DEMO_ATTENDANCE,
  DEMO_CREATED_ASSIGNMENTS_KEY,
  demoAssignmentsFor,
  summariseAttendance,
  formatDay,
  dueLabel,
  initials,
  ASSIGNMENT_LABELS,
  ASSIGNMENT_STYLES,
  PORTION_LABELS,
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

export function StudentDetailPanel({
  studentId,
  onClose,
}: {
  studentId: string;
  onClose: () => void;
}) {
  const student = DEMO_STUDENTS.find((s) => s.id === studentId);
  const [createdAssignments, setCreatedAssignments] = useState<QuranicAssignment[]>([]);

  useEffect(() => {
    setCreatedAssignments(readDemoStore(DEMO_CREATED_ASSIGNMENTS_KEY, []));
  }, []);

  if (!student) return null;

  const attendance = DEMO_ATTENDANCE[student.id] ?? [];
  const summary = summariseAttendance(attendance);
  const assignments = demoAssignmentsFor(student.id, createdAssignments);

  return (
    <Modal
      title={student.name}
      subtitle={student.halaqa}
      badge={initials(student.name)}
      onClose={onClose}
    >
      <div className="space-y-5">
        {/* Attendance */}
        <div>
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">Attendance</p>
            <span className="text-[11px] text-ink-muted tabular-nums">
              {summary.rate}% this term
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
            <p className="eyebrow">Assignments</p>
            <span className="text-[11px] text-ink-muted tabular-nums">
              {assignments.length} total
            </span>
          </div>

          {assignments.length === 0 ? (
            <EmptyNote>No assignments yet.</EmptyNote>
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
                          {PORTION_LABELS[a.portion]}
                        </p>
                        <p className="text-[13px] font-semibold text-ink mt-0.5">
                          {surahEnd ? (
                            `${surah?.englishName ?? `Surah ${a.surah}`} ${a.ayah_start} – ${surahEnd.englishName} ${a.ayah_end}`
                          ) : (
                            <>
                              {surah ? surah.englishName : `Surah ${a.surah}`}
                              <span className="font-normal text-ink-muted">
                                {" "}
                                · ayahs {a.ayah_start}–{a.ayah_end}
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
                            {due.text} · {formatDay(a.due_date)}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap ${ASSIGNMENT_STYLES[a.status]}`}
                      >
                        {ASSIGNMENT_LABELS[a.status]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 mt-2">
                      <div className="flex-1">
                        <ProgressBar value={a.memorization_level} />
                      </div>
                      <span className="text-[11px] font-semibold text-ink-muted tabular-nums w-8 text-right">
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
