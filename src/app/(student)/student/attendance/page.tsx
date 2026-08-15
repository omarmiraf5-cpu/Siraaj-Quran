"use client";

import { useStudentTheme } from "@/hooks/useStudentTheme";
import {
  DEMO_CURRENT_STUDENT,
  DEMO_ATTENDANCE,
  ATTENDANCE_LABELS,
  summariseAttendance,
  formatDay,
  type AttendanceStatus,
} from "@/data/demo";
import { SectionCard, AttendanceStrip } from "@/components/portal-ui";
import { ProgressRing, StreakBadge, ILLUM_CLASS } from "@/components/student-ui";
import { IconCheck, IconClock, IconX, IconNote } from "@/components/icons";

// Each mark gets a colour and a face of its own, so the row reads at a
// glance instead of as four numbers.
const MARKS: {
  status: AttendanceStatus;
  colour: keyof typeof ILLUM_CLASS;
  icon: React.ReactNode;
}[] = [
  { status: "present", colour: "verdigris", icon: <IconCheck size={15} /> },
  { status: "late", colour: "saffron", icon: <IconClock size={15} /> },
  { status: "absent", colour: "vermilion", icon: <IconX size={15} /> },
  { status: "excused", colour: "lapis", icon: <IconNote size={15} /> },
];

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
      {/* The rate as a ring, given the room it deserves. */}
      <header
        className={`${theme.hero} rounded-[22px] px-6 py-7 relative overflow-hidden text-center animate-rise`}
      >
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative flex flex-col items-center">
          <p className="eyebrow text-white/45">Your register</p>
          <div className="mt-4 rounded-full bg-white/10 p-2 backdrop-blur-sm">
            <div className="rounded-full bg-surface-card p-2">
              <ProgressRing value={s.rate} colour="saffron" size={104} label="here" />
            </div>
          </div>
          <p className="text-[13px] text-white/55 mt-3.5">
            of the last {s.total} school days
          </p>
          {streak > 1 && (
            <div className="mt-4">
              <StreakBadge days={streak} />
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-4 gap-2.5">
        {MARKS.map((m, i) => (
          <div
            key={m.status}
            className="card-quiet px-2 py-3.5 text-center animate-rise"
            style={{ animationDelay: `${60 + i * 60}ms` }}
          >
            <span className={`${ILLUM_CLASS[m.colour]} w-8 h-8 rounded-xl mx-auto mb-2`}>
              {m.icon}
            </span>
            <p className="text-[22px] font-bold tabular-nums leading-none text-ink">
              {s[m.status]}
            </p>
            <p className="eyebrow mt-1.5">{ATTENDANCE_LABELS[m.status]}</p>
          </div>
        ))}
      </div>

      <div className="animate-rise" style={{ animationDelay: "300ms" }}>
        <SectionCard title="At a glance" note={`last ${Math.min(14, days.length)} days`}>
          <AttendanceStrip days={days} />
          <p className="text-[12px] text-ink-muted mt-3">
            {streak > 1
              ? `${streak} days in a row without missing. Keep it going.`
              : "Every day you show up counts."}
          </p>
        </SectionCard>
      </div>

      <div className="animate-rise" style={{ animationDelay: "360ms" }}>
        <SectionCard title="Day by day" note={`${s.total} days`}>
          <ul className="divide-y divide-surface-border -my-1">
            {days.map((d) => {
              const mark = MARKS.find((m) => m.status === d.status)!;
              return (
                <li key={d.date} className="flex items-center gap-3 py-2.5">
                  <span className={`${ILLUM_CLASS[mark.colour]} w-7 h-7 rounded-lg flex-shrink-0`}>
                    {mark.icon}
                  </span>
                  <span className="text-[13px] text-ink flex-1">{formatDay(d.date)}</span>
                  <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wide">
                    {ATTENDANCE_LABELS[d.status]}
                  </span>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
