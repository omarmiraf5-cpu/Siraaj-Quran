"use client";

import { useState } from "react";
import {
  DEMO_STUDENTS,
  DEMO_ATTENDANCE,
  ATTENDANCE_STYLES,
  ATTENDANCE_LABELS,
  summariseAttendance,
  initials,
  formatDay,
  type AttendanceStatus,
} from "@/data/demo";

const TODAY = "2026-08-13";

const MARKS: { status: AttendanceStatus; letter: string; on: string; off: string }[] = [
  { status: "present", letter: "P", on: "bg-green-600 border-green-600 text-white", off: "hover:border-green-600 hover:text-green-700" },
  { status: "late", letter: "L", on: "bg-amber-500 border-amber-500 text-white", off: "hover:border-amber-500 hover:text-amber-600" },
  { status: "absent", letter: "A", on: "bg-red-600 border-red-600 text-white", off: "hover:border-red-600 hover:text-red-700" },
  { status: "excused", letter: "E", on: "bg-blue-600 border-blue-600 text-white", off: "hover:border-blue-600 hover:text-blue-700" },
];

export default function TeacherAttendancePage() {
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [saved, setSaved] = useState(false);

  const mark = (id: string, status: AttendanceStatus) => {
    setSaved(false);
    setRecords((r) => {
      const next = { ...r };
      // Tapping the same mark again clears it, so a mis-tap is undoable.
      if (next[id] === status) delete next[id];
      else next[id] = status;
      return next;
    });
  };

  const markAllPresent = () => {
    setSaved(false);
    setRecords(Object.fromEntries(DEMO_STUDENTS.map((s) => [s.id, "present" as const])));
  };

  const count = (s: AttendanceStatus) =>
    Object.values(records).filter((v) => v === s).length;
  const marked = Object.keys(records).length;
  const remaining = DEMO_STUDENTS.length - marked;

  return (
    <div className="max-w-2xl mx-auto pb-28 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink mb-1">Attendance</h1>
        <p className="text-sm text-ink-muted">{formatDay(TODAY)} · {DEMO_STUDENTS.length} students</p>
      </div>

      {/* Today's tally */}
      <div className="grid grid-cols-4 gap-2">
        {MARKS.map((m) => (
          <div key={m.status} className={`rounded-2xl px-2 py-3 text-center ${ATTENDANCE_STYLES[m.status]}`}>
            <p className="text-2xl font-bold tabular-nums">{count(m.status)}</p>
            <p className="text-[11px] font-semibold mt-0.5">{ATTENDANCE_LABELS[m.status]}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-muted">
          {remaining > 0 ? `${remaining} still to mark` : "Everyone marked"}
        </p>
        <button
          onClick={markAllPresent}
          className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
        >
          Mark all present
        </button>
      </div>

      {/* Roster */}
      <div className="bg-surface-card rounded-2xl border border-surface-border divide-y divide-surface-border overflow-hidden">
        {DEMO_STUDENTS.map((s) => {
          const history = summariseAttendance(DEMO_ATTENDANCE[s.id]);
          return (
            <div key={s.id} className="flex items-center gap-3 px-3 py-3">
              <div className="w-9 h-9 rounded-xl bg-brand-navy/10 text-brand-navy dark:text-brand-gold flex items-center justify-center font-bold text-xs flex-shrink-0">
                {initials(s.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-ink truncate">{s.name}</p>
                <p className="text-[11px] text-ink-muted">
                  {s.halaqa} · {history.rate}% this term
                </p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                {MARKS.map((m) => {
                  const active = records[s.id] === m.status;
                  return (
                    <button
                      key={m.status}
                      onClick={() => mark(s.id, m.status)}
                      aria-label={`${ATTENDANCE_LABELS[m.status]} — ${s.name}`}
                      aria-pressed={active}
                      className={`w-9 h-9 rounded-full text-xs font-bold border-2 transition-all active:scale-95 ${
                        active ? m.on : `border-surface-border text-ink-muted ${m.off}`
                      }`}
                    >
                      {m.letter}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky save — clears the sidebar on desktop */}
      <div className="fixed bottom-0 left-0 right-0 md:left-56 p-3 bg-surface-card border-t border-surface-border z-30">
        <button
          onClick={() => setSaved(true)}
          disabled={marked === 0}
          className="w-full max-w-2xl mx-auto block gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-[.98] transition-all"
        >
          {saved
            ? "✓ Attendance saved"
            : marked === 0
              ? "Mark a student to save"
              : `Save attendance · ${count("present")} present`}
        </button>
      </div>
    </div>
  );
}
