"use client";

// What the dashboard's four numbers open onto. They used to scroll the page to
// a section that was already visible on desktop, which looked like nothing
// happened; each one now opens the list it is counting.

import {
  DEMO_STUDENTS,
  DEMO_ASSIGNMENTS,
  DEMO_ATTENDANCE,
  summariseAttendance,
  studentName,
  formatDay,
  dueLabel,
  initials,
  ASSIGNMENT_LABELS,
  ASSIGNMENT_STYLES,
  PORTION_LABELS,
} from "@/data/demo";
import { getSurahById } from "@/data/mushaf-index";
import { Modal, ProgressBar, EmptyNote, AttendanceStrip } from "@/components/portal-ui";

export type DrilldownView = "students" | "active" | "review" | "attendance";

const TITLES: Record<DrilldownView, { title: string; subtitle: string }> = {
  students: { title: "All students", subtitle: "Tap a name for their full record" },
  active: { title: "Active work", subtitle: "Everything not yet completed" },
  review: { title: "Waiting on you", subtitle: "Marked as needing review" },
  attendance: { title: "Attendance", subtitle: "This term, weakest first" },
};

export function TeacherDrilldown({
  view,
  onClose,
  onSelectStudent,
}: {
  view: DrilldownView;
  onClose: () => void;
  onSelectStudent: (id: string) => void;
}) {
  const { title, subtitle } = TITLES[view];

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      {view === "students" && <StudentList onSelect={onSelectStudent} />}
      {view === "attendance" && <AttendanceList onSelect={onSelectStudent} />}
      {(view === "active" || view === "review") && (
        <AssignmentList
          assignments={DEMO_ASSIGNMENTS.filter((a) =>
            view === "review" ? a.status === "needs_review" : a.status !== "completed"
          )}
          onSelect={onSelectStudent}
        />
      )}
    </Modal>
  );
}

function Row({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 text-left rounded-xl px-2 py-2.5 -mx-2 hover:bg-surface-bg-warm transition-colors"
      >
        {children}
      </button>
    </li>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="w-8 h-8 rounded-full bg-surface-bg-warm border border-surface-border flex items-center justify-center text-[11px] font-bold text-ink-muted flex-shrink-0">
      {initials(name)}
    </span>
  );
}

function StudentList({ onSelect }: { onSelect: (id: string) => void }) {
  const byHalaqa = [...new Set(DEMO_STUDENTS.map((s) => s.halaqa))];

  return (
    <div className="space-y-5">
      {byHalaqa.map((halaqa) => (
        <div key={halaqa}>
          <p className="eyebrow">{halaqa}</p>
          <ul className="mt-2 space-y-0.5">
            {DEMO_STUDENTS.filter((s) => s.halaqa === halaqa).map((s) => {
              const rate = summariseAttendance(DEMO_ATTENDANCE[s.id] ?? []).rate;
              const open = DEMO_ASSIGNMENTS.filter(
                (a) => a.student_id === s.id && a.status !== "completed"
              ).length;
              return (
                <Row key={s.id} onClick={() => onSelect(s.id)}>
                  <Avatar name={s.name} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold text-ink truncate">
                      {s.name}
                    </span>
                    <span className="block text-[11px] text-ink-muted">
                      {open === 0 ? "nothing open" : open === 1 ? "1 open" : `${open} open`}
                    </span>
                  </span>
                  <span className="text-[12px] font-semibold text-ink-muted tabular-nums flex-shrink-0">
                    {rate}%
                  </span>
                </Row>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AttendanceList({ onSelect }: { onSelect: (id: string) => void }) {
  // Weakest first, because that is the list a teacher acts on.
  const rows = DEMO_STUDENTS.map((s) => ({
    student: s,
    days: DEMO_ATTENDANCE[s.id] ?? [],
    summary: summariseAttendance(DEMO_ATTENDANCE[s.id] ?? []),
  })).sort((a, b) => a.summary.rate - b.summary.rate);

  return (
    <ul className="space-y-3">
      {rows.map(({ student, days, summary }) => (
        <li key={student.id}>
          <button
            type="button"
            onClick={() => onSelect(student.id)}
            className="w-full text-left rounded-xl px-2 py-2 -mx-2 hover:bg-surface-bg-warm transition-colors"
          >
            <div className="flex items-center gap-3">
              <Avatar name={student.name} />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold text-ink truncate">
                  {student.name}
                </span>
                <span className="block text-[11px] text-ink-muted">{student.halaqa}</span>
              </span>
              <span
                className={`text-[13px] font-bold tabular-nums flex-shrink-0 ${
                  summary.rate >= 95
                    ? "text-green-800 dark:text-green-300"
                    : summary.rate >= 85
                      ? "text-amber-800 dark:text-amber-300"
                      : "text-red-800 dark:text-red-300"
                }`}
              >
                {summary.rate}%
              </span>
            </div>
            <div className="mt-2">
              <AttendanceStrip days={days} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function AssignmentList({
  assignments,
  onSelect,
}: {
  assignments: typeof DEMO_ASSIGNMENTS;
  onSelect: (id: string) => void;
}) {
  if (assignments.length === 0) {
    return <EmptyNote>Nothing here — all clear.</EmptyNote>;
  }

  // Soonest due first; undated work sinks to the bottom.
  const sorted = [...assignments].sort((a, b) =>
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")
  );

  return (
    <ul className="space-y-4">
      {sorted.map((a) => {
        const surah = getSurahById(a.surah);
        const name = studentName(a.student_id);
        const due = dueLabel(a.due_date);

        return (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onSelect(a.student_id)}
              className="w-full text-left rounded-xl px-2 py-2 -mx-2 hover:bg-surface-bg-warm transition-colors"
            >
              <div className="flex items-start gap-3">
                <Avatar name={name} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">
                    {name}
                    <span className="font-normal text-ink-muted">
                      {" · "}
                      {PORTION_LABELS[a.portion]}
                    </span>
                  </p>
                  <p className="text-[12px] text-ink-body">
                    {surah ? surah.englishName : `Surah ${a.surah}`}
                    <span className="text-ink-muted">
                      {" "}
                      · ayahs {a.ayah_start}–{a.ayah_end}
                    </span>
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

              <div className="flex items-center gap-2.5 mt-2 pl-11">
                <div className="flex-1">
                  <ProgressBar value={a.memorization_level} />
                </div>
                <span className="text-[11px] font-semibold text-ink-muted tabular-nums w-8 text-right">
                  {a.memorization_level}%
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
