"use client";

import { useEffect } from "react";
import {
  DEMO_STUDENTS,
  DEMO_ATTENDANCE,
  demoAssignmentsFor,
  summariseAttendance,
  formatDay,
  initials,
  ATTENDANCE_LABELS,
  type AttendanceStatus,
} from "@/data/demo";
import { getSurahById } from "@/data/mushaf-index";

const STATUS_DOT: Record<AttendanceStatus, string> = {
  present: "bg-green-700",
  late: "bg-amber-600",
  absent: "bg-red-700",
  excused: "bg-slate-500",
};

const ASSIGNMENT_CHIP: Record<string, string> = {
  assigned: "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300",
  in_progress: "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
  completed: "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300",
  needs_review: "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300",
};

const IconClose = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export function StudentDetailPanel({
  studentId,
  onClose,
}: {
  studentId: string;
  onClose: () => void;
}) {
  const student = DEMO_STUDENTS.find((s) => s.id === studentId);

  // Escape closes, and the panel traps nothing else — a plain backdrop
  // click is the other way out, handled below.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!student) return null;

  const attendance = DEMO_ATTENDANCE[student.id] ?? [];
  const summary = summariseAttendance(attendance);
  const assignments = demoAssignmentsFor(student.id);
  // Oldest to newest, left to right, so the strip reads like a calendar.
  const recent = attendance.slice(0, 14).slice().reverse();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${student.name} details`}
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-surface-card border border-surface-border rounded-[18px] shadow-2xl"
      >
        <div className="gradient-navy rounded-t-[18px] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition"
          >
            {IconClose}
          </button>
          <div className="relative flex items-center gap-3.5">
            <span className="w-12 h-12 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-[15px] font-bold text-white flex-shrink-0">
              {initials(student.name)}
            </span>
            <div className="min-w-0">
              <h2 className="page-title text-white text-lg truncate">{student.name}</h2>
              <p className="text-[12px] text-white/55">{student.halaqa}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Attendance */}
          <div>
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">Attendance</p>
              <span className="text-[11px] text-ink-muted tabular-nums">{summary.rate}% this term</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
              {(["present", "late", "absent", "excused"] as AttendanceStatus[])
                .filter((s) => summary[s] > 0)
                .map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5 text-[12px]">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} />
                    <span className="tabular-nums font-semibold text-ink">{summary[s]}</span>
                    <span className="text-ink-muted">{s}</span>
                  </span>
                ))}
            </div>

            <div className="flex gap-1 mt-3.5">
              {recent.map((d) => (
                <span
                  key={d.date}
                  title={`${formatDay(d.date)} · ${ATTENDANCE_LABELS[d.status]}`}
                  className={`flex-1 h-1.5 rounded-full ${STATUS_DOT[d.status]}`}
                />
              ))}
            </div>
          </div>

          <div className="gold-rule" />

          {/* Assignments — the same records the review queue and the
              assignments page draw from, filtered to this student. */}
          <div>
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">Assignments</p>
              <span className="text-[11px] text-ink-muted tabular-nums">{assignments.length} total</span>
            </div>

            {assignments.length === 0 ? (
              <p className="text-[13px] text-ink-muted py-2">No assignments yet.</p>
            ) : (
              <ul className="space-y-3.5 mt-3">
                {assignments.map((a) => {
                  const surah = getSurahById(a.surah);
                  return (
                    <li key={a.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-ink">
                          {surah ? surah.englishName : `Surah ${a.surah}`}
                          <span className="font-normal text-ink-muted">
                            {" "}
                            · ayahs {a.ayah_start}–{a.ayah_end}
                          </span>
                        </p>
                        {a.teacher_notes && (
                          <p className="text-[11px] text-ink-muted mt-1 leading-snug">
                            {a.teacher_notes}
                          </p>
                        )}
                        {a.due_date && (
                          <p className="text-[11px] text-ink-muted mt-1">
                            due {formatDay(a.due_date)}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap ${ASSIGNMENT_CHIP[a.status]}`}
                      >
                        {a.status.replace("_", " ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
