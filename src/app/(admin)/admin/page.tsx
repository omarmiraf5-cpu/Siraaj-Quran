"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DEMO_STUDENTS,
  DEMO_CREATED_STUDENTS_KEY,
  DEMO_STUDENT_OVERRIDES_KEY,
  DEMO_TEACHERS,
  DEMO_CREATED_TEACHERS_KEY,
  DEMO_TEACHER_OVERRIDES_KEY,
  DEMO_HALAQAS,
  DEMO_CREATED_HALAQAS_KEY,
  DEMO_HALAQA_OVERRIDES_KEY,
  DEMO_ASSIGNMENTS,
  DEMO_MESSAGES,
  DEMO_TODAY,
  formatDay,
  allStudents,
  allTeachers,
  allHalaqas,
  schoolAttendanceRate,
  studentsInHalaqa,
  type StudentOverride,
  type TeacherOverride,
  type HalaqaOverride,
} from "@/data/demo";
import { DEMO_SCHOOL } from "@/lib/demo";
import type { DemoStudent, DemoTeacher, DemoHalaqa } from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, StatTile, EmptyNote } from "@/components/portal-ui";
import { IconArrow } from "@/components/icons";
import { readDemoStore } from "@/lib/demoStore";

export default function AdminDashboard() {
  const [students, setStudents] = useState<DemoStudent[]>(DEMO_STUDENTS);
  const [teachers, setTeachers] = useState<DemoTeacher[]>(DEMO_TEACHERS);
  const [halaqas, setHalaqas] = useState<DemoHalaqa[]>(DEMO_HALAQAS);

  useEffect(() => {
    setStudents(
      allStudents(
        readDemoStore(DEMO_CREATED_STUDENTS_KEY, []),
        readDemoStore<Record<string, StudentOverride>>(DEMO_STUDENT_OVERRIDES_KEY, {})
      )
    );
    setTeachers(
      allTeachers(
        readDemoStore(DEMO_CREATED_TEACHERS_KEY, []),
        readDemoStore<Record<string, TeacherOverride>>(DEMO_TEACHER_OVERRIDES_KEY, {})
      )
    );
    setHalaqas(
      allHalaqas(
        readDemoStore(DEMO_CREATED_HALAQAS_KEY, []),
        readDemoStore<Record<string, HalaqaOverride>>(DEMO_HALAQA_OVERRIDES_KEY, {})
      )
    );
  }, []);

  const activeStudents = students.filter((s) => s.active !== false);
  const activeTeachers = teachers.filter((t) => t.active !== false);
  const attendanceRate = schoolAttendanceRate(activeStudents);
  const needsReview = DEMO_ASSIGNMENTS.filter((a) => a.status === "needs_review");
  const recentAbsences = DEMO_MESSAGES.filter((m) => m.kind === "absence").slice(-4).reverse();
  const unassignedHalaqas = halaqas.filter((h) => !h.teacherId);

  return (
    <div className="max-w-5xl mx-auto space-y-4 pt-2">
      <PortalHero
        eyebrow="School overview"
        title={DEMO_SCHOOL.name}
        meta={[
          `${DEMO_SCHOOL.city}, ${DEMO_SCHOOL.province}`,
          formatDay(DEMO_TODAY),
          `${needsReview.length + unassignedHalaqas.length} open items`,
        ]}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile value={activeStudents.length} label="Students" sub={`${students.length - activeStudents.length} inactive`} />
        <StatTile value={activeTeachers.length} label="Teachers" sub={`${halaqas.length} halaqas`} />
        <StatTile value={halaqas.length} label="Halaqas" sub={unassignedHalaqas.length ? `${unassignedHalaqas.length} unassigned` : "all assigned"} />
        <StatTile value={`${attendanceRate}%`} label="Attendance" sub="school-wide" />
      </div>

      <div className="grid md:grid-cols-2 gap-3 items-start">
        <SectionCard title="Needs review" note={`${needsReview.length} assignments`}>
          {needsReview.length === 0 ? (
            <EmptyNote>Nothing waiting on a teacher's review.</EmptyNote>
          ) : (
            <ul className="divide-y divide-surface-border -my-1">
              {needsReview.map((a) => (
                <li key={a.id} className="py-2.5 text-[13px] text-ink">
                  A student in {halaqas.find((h) => studentsInHalaqa(h.name, students).some((s) => s.id === a.student_id))?.name ?? "a halaqa"} has work flagged for review.
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Recent absences" note={`${recentAbsences.length} reported`}>
          {recentAbsences.length === 0 ? (
            <EmptyNote>No absences reported recently.</EmptyNote>
          ) : (
            <ul className="divide-y divide-surface-border -my-1">
              {recentAbsences.map((m) => (
                <li key={m.id} className="py-2.5">
                  <p className="text-[13px] text-ink">{m.body}</p>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    {m.author_name} · {m.absence_date}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Teachers" note={`${teachers.length} total`}>
        <ul className="divide-y divide-surface-border -my-1">
          {teachers.map((t) => {
            const theirHalaqas = halaqas.filter((h) => h.teacherId === t.id);
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">{t.name}</p>
                  <p className="text-[11px] text-ink-muted truncate">
                    {theirHalaqas.length > 0
                      ? theirHalaqas.map((h) => h.name).join(", ")
                      : "No halaqa assigned"}
                  </p>
                </div>
                {t.active === false && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 flex-shrink-0">
                    Inactive
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <Link
          href="/admin/teachers"
          className="group mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          Manage teachers
          <span className="group-hover:translate-x-0.5 transition-transform">
            <IconArrow size={14} />
          </span>
        </Link>
      </SectionCard>
    </div>
  );
}
