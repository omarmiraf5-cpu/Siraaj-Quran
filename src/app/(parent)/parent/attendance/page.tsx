"use client";

import { useState } from "react";
import {
  DEMO_STUDENTS,
  DEMO_ATTENDANCE,
  ATTENDANCE_STYLES,
  ATTENDANCE_LABELS,
  summariseAttendance,
  formatDay,
} from "@/data/demo";

// A parent normally sees only their own children; two are shown here so the
// switcher is visible.
const CHILDREN = DEMO_STUDENTS.slice(0, 2);

export default function ParentAttendancePage() {
  const [childId, setChildId] = useState(CHILDREN[0].id);
  const child = CHILDREN.find((c) => c.id === childId)!;
  const days = DEMO_ATTENDANCE[childId];
  const s = summariseAttendance(days);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink mb-1">Attendance</h1>
        <p className="text-sm text-ink-muted">Last {s.total} school days</p>
      </div>

      {CHILDREN.length > 1 && (
        <div className="grid grid-cols-2 gap-2">
          {CHILDREN.map((c) => (
            <button
              key={c.id}
              onClick={() => setChildId(c.id)}
              className={`p-3 rounded-2xl text-sm font-semibold transition-all active:scale-[.98] ${
                childId === c.id
                  ? "bg-brand-navy text-white"
                  : "bg-surface-card border border-surface-border text-ink hover:bg-surface-bg"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Headline rate */}
      <div className="bg-surface-card rounded-2xl border border-surface-border p-5">
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-sm font-semibold text-ink">{child.name}&apos;s attendance</span>
          <span className="text-3xl font-bold text-ink tabular-nums">{s.rate}%</span>
        </div>
        <div className="h-3 bg-surface-bg rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              s.rate >= 95 ? "bg-green-600" : s.rate >= 85 ? "bg-amber-500" : "bg-red-600"
            }`}
            style={{ width: `${s.rate}%` }}
          />
        </div>
        <p className="text-xs text-ink-muted mt-2">
          {s.rate >= 95
            ? "Excellent attendance — thank you for your support."
            : s.rate >= 85
              ? "Good, with a little room to improve."
              : "Below the school's target of 85%. Please contact the teacher."}
        </p>
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
      <div>
        <h2 className="font-bold text-ink mb-2 text-sm">Recent days</h2>
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
