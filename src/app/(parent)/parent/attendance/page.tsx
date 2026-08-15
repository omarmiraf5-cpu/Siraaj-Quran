"use client";

import { useState } from "react";
import {
  DEMO_CHILDREN,
  DEMO_ATTENDANCE,
  ATTENDANCE_STYLES,
  ATTENDANCE_LABELS,
  summariseAttendance,
  formatDay,
} from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import {
  SectionCard,
  AttendanceStrip,
  AttendanceLegend,
  SegmentedSwitch,
} from "@/components/portal-ui";

export default function ParentAttendancePage() {
  const [childId, setChildId] = useState(DEMO_CHILDREN[0].id);
  const child = DEMO_CHILDREN.find((c) => c.id === childId) ?? DEMO_CHILDREN[0];
  const days = DEMO_ATTENDANCE[childId] ?? [];
  const s = summariseAttendance(days);

  const firstName = child.name.split(" ")[0];

  return (
    <div className="max-w-4xl mx-auto space-y-4 pt-2">
      <PortalHero
        eyebrow="Attendance"
        title={firstName}
        meta={[child.halaqa, `last ${s.total} school days`, `${s.rate}% present`]}
      />

      {DEMO_CHILDREN.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="eyebrow">Viewing</span>
          <SegmentedSwitch
            label="Select child"
            value={childId}
            onChange={setChildId}
            options={DEMO_CHILDREN.map((c) => ({ value: c.id, label: c.name.split(" ")[0] }))}
          />
        </div>
      )}

      <SectionCard title="Overall" note={`${s.total} days`}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[40px] font-bold text-ink tabular-nums leading-none">{s.rate}%</p>
            <p className="text-[12px] text-ink-muted mt-2 max-w-xs">
              {s.rate >= 95
                ? "Excellent attendance — thank you for your support."
                : s.rate >= 85
                  ? "Good, with a little room to improve."
                  : "Below the school's target of 85%. Please contact the teacher."}
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
              {ATTENDANCE_LABELS[k]}
            </p>
          </div>
        ))}
      </div>

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
