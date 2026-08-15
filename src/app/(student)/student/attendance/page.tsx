"use client";

import { useStudentTheme } from "@/hooks/useStudentTheme";
import {
  DEMO_CURRENT_STUDENT,
  DEMO_ATTENDANCE,
  ATTENDANCE_STYLES,
  ATTENDANCE_LABELS,
  summariseAttendance,
  formatDay,
} from "@/data/demo";
import { SectionCard, AttendanceStrip } from "@/components/portal-ui";
import { IconFlame } from "@/components/icons";

export default function StudentAttendancePage() {
  const theme = useStudentTheme();
  const days = DEMO_ATTENDANCE[DEMO_CURRENT_STUDENT.id];
  const s = summariseAttendance(days);

  // Days attended in a row, counting back from the most recent.
  let streak = 0;
  for (const d of days) {
    if (d.status === "absent") break;
    streak++;
  }

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      {/* The rate, given the room it deserves. */}
      <header className={`${theme.hero} rounded-[18px] px-6 py-7 relative overflow-hidden text-center`}>
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative">
          <p className="eyebrow text-white/45">Your register</p>
          <p className="text-white text-[52px] font-bold tabular-nums leading-none mt-3">
            {s.rate}%
          </p>
          <p className="text-[13px] text-white/55 mt-2">of the last {s.total} school days</p>
          {streak > 1 && (
            <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-gold-light mt-4 px-3 py-1.5 rounded-full bg-white/10">
              <IconFlame size={13} />
              {streak} days in a row
            </p>
          )}
        </div>
      </header>

      <div className="grid grid-cols-4 gap-2">
        {(["present", "late", "absent", "excused"] as const).map((k) => (
          <div key={k} className={`rounded-2xl px-2 py-3.5 text-center ${ATTENDANCE_STYLES[k]}`}>
            <p className="text-[22px] font-bold tabular-nums leading-none">{s[k]}</p>
            <p className="text-[10px] font-semibold mt-1.5 uppercase tracking-wider">
              {ATTENDANCE_LABELS[k]}
            </p>
          </div>
        ))}
      </div>

      <SectionCard title="At a glance" note={`last ${Math.min(14, days.length)} days`}>
        <AttendanceStrip days={days} />
      </SectionCard>

      <SectionCard title="Day by day" note={`${s.total} days`}>
        <ul className="divide-y divide-surface-border -my-1">
          {days.map((d) => (
            <li key={d.date} className="flex items-center justify-between py-2.5">
              <span className="text-[13px] text-ink">{formatDay(d.date)}</span>
              <span
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${ATTENDANCE_STYLES[d.status]}`}
              >
                {ATTENDANCE_LABELS[d.status]}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
