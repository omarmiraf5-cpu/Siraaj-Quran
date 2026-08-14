"use client";

import {
  DEMO_CURRENT_STUDENT,
  DEMO_ATTENDANCE,
  ATTENDANCE_STYLES,
  ATTENDANCE_LABELS,
  summariseAttendance,
  formatDay,
} from "@/data/demo";

export default function StudentAttendancePage() {
  const days = DEMO_ATTENDANCE[DEMO_CURRENT_STUDENT.id];
  const s = summariseAttendance(days);

  // Days attended in a row, counting back from the most recent.
  let streak = 0;
  for (const d of days) {
    if (d.status === "absent") break;
    streak++;
  }

  return (
    <div className="px-4 pt-4 pb-24 space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-ink mb-1">✅ My Attendance</h1>
        <p className="text-ink-muted">Keep showing up — it adds up fast</p>
      </div>

      {/* Headline */}
      <div className="rounded-3xl p-6 text-white text-center student-gradient-teal">
        <p className="text-5xl font-bold mb-1 tabular-nums">{s.rate}%</p>
        <p className="text-sm opacity-90 font-semibold">of the last {s.total} days</p>
        {streak > 1 && (
          <p className="text-xs opacity-80 mt-3">
            🔥 {streak} days in a row without missing
          </p>
        )}
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-4 gap-2">
        {(["present", "late", "absent", "excused"] as const).map((k) => (
          <div key={k} className={`rounded-2xl px-2 py-3 text-center ${ATTENDANCE_STYLES[k]}`}>
            <p className="text-2xl font-bold tabular-nums">{s[k]}</p>
            <p className="text-[11px] font-semibold mt-0.5">{ATTENDANCE_LABELS[k]}</p>
          </div>
        ))}
      </div>

      {/* Day by day */}
      <div className="space-y-2">
        <h2 className="font-bold text-ink text-sm">Recent days</h2>
        <div className="bg-surface-card rounded-2xl border border-surface-border divide-y divide-surface-border overflow-hidden">
          {days.map((d) => (
            <div key={d.date} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-ink">{formatDay(d.date)}</span>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${ATTENDANCE_STYLES[d.status]}`}>
                {ATTENDANCE_LABELS[d.status]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
