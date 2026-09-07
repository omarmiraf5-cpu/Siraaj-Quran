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
import type { DemoTeacher, DemoHalaqa } from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, StatTile, EmptyNote } from "@/components/portal-ui";
import { IconArrow } from "@/components/icons";
import { readDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";

type ReviewItem = { id: string; halaqaName: string };
type AbsenceItem = { id: string; body: string; authorName: string; absenceDate: string | null };

export default function AdminDashboard() {
  const supabase = createClient();

  const [school, setSchool] = useState({
    name: DEMO_SCHOOL.name,
    city: DEMO_SCHOOL.city,
    province: DEMO_SCHOOL.province,
  });
  const [studentCount, setStudentCount] = useState(0);
  const [activeStudentCount, setActiveStudentCount] = useState(0);
  const [teachers, setTeachers] = useState<DemoTeacher[]>(DEMO_TEACHERS);
  const [halaqas, setHalaqas] = useState<DemoHalaqa[]>(DEMO_HALAQAS);
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [absenceItems, setAbsenceItems] = useState<AbsenceItem[]>([]);

  const loadRealTeachers = async (): Promise<DemoTeacher[]> => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, active")
      .eq("role", "teacher")
      .order("full_name");
    return (data ?? []).map((p) => ({ id: p.id, name: p.full_name, email: "", active: p.active }));
  };

  const loadRealHalaqas = async (): Promise<DemoHalaqa[]> => {
    const { data } = await supabase
      .from("classes")
      .select("id, name, teacher_id, schedule")
      .order("name");
    return (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      teacherId: c.teacher_id,
      schedule: c.schedule ?? "",
    }));
  };

  const loadRealReviewItems = async (): Promise<ReviewItem[]> => {
    const { data: assignments } = await supabase
      .from("quranic_assignments")
      .select("id, student_id")
      .eq("status", "needs_review");
    if (!assignments || assignments.length === 0) return [];

    const studentIds = [...new Set(assignments.map((a) => a.student_id))];
    const { data: enrollments } = await supabase
      .from("class_enrollments")
      .select("student_id, classes(name)")
      .in("student_id", studentIds);
    const halaqaByStudent = new Map<string, string>();
    for (const e of enrollments ?? []) {
      const className = (e as unknown as { classes: { name: string } | null }).classes?.name;
      if (className) halaqaByStudent.set(e.student_id, className);
    }
    return assignments.map((a) => ({
      id: a.id,
      halaqaName: halaqaByStudent.get(a.student_id) ?? "a halaqa",
    }));
  };

  const loadRealAbsences = async (): Promise<AbsenceItem[]> => {
    const { data } = await supabase
      .from("messages")
      .select("id, body, absence_date, profiles(full_name)")
      .eq("kind", "absence")
      .order("created_at", { ascending: false })
      .limit(4);
    return (data ?? []).map((m) => ({
      id: m.id,
      body: m.body,
      authorName:
        (m as unknown as { profiles: { full_name: string } | null }).profiles?.full_name ??
        "Unknown",
      absenceDate: m.absence_date,
    }));
  };

  const loadRealAttendanceRate = async (): Promise<number | null> => {
    const { data } = await supabase.from("attendance").select("status");
    if (!data || data.length === 0) return null;
    const present = data.filter((a) => a.status === "present" || a.status === "late").length;
    return Math.round((present / data.length) * 100);
  };

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const students = allStudents(
          readDemoStore(DEMO_CREATED_STUDENTS_KEY, []),
          readDemoStore<Record<string, StudentOverride>>(DEMO_STUDENT_OVERRIDES_KEY, {})
        );
        const demoTeachers = allTeachers(
          readDemoStore(DEMO_CREATED_TEACHERS_KEY, []),
          readDemoStore<Record<string, TeacherOverride>>(DEMO_TEACHER_OVERRIDES_KEY, {})
        );
        const demoHalaqas = allHalaqas(
          readDemoStore(DEMO_CREATED_HALAQAS_KEY, []),
          readDemoStore<Record<string, HalaqaOverride>>(DEMO_HALAQA_OVERRIDES_KEY, {})
        );
        const activeStudents = students.filter((s) => s.active !== false);
        setStudentCount(students.length);
        setActiveStudentCount(activeStudents.length);
        setTeachers(demoTeachers);
        setHalaqas(demoHalaqas);
        setAttendanceRate(schoolAttendanceRate(activeStudents));
        setReviewItems(
          DEMO_ASSIGNMENTS.filter((a) => a.status === "needs_review").map((a) => ({
            id: a.id,
            halaqaName:
              demoHalaqas.find((h) =>
                studentsInHalaqa(h.name, students).some((s) => s.id === a.student_id)
              )?.name ?? "a halaqa",
          }))
        );
        setAbsenceItems(
          DEMO_MESSAGES.filter((m) => m.kind === "absence")
            .slice(-4)
            .reverse()
            .map((m) => ({
              id: m.id,
              body: m.body,
              authorName: m.author_name,
              absenceDate: m.absence_date ?? null,
            }))
        );
        return;
      }

      const { data: schoolRow } = await supabase
        .from("schools")
        .select("name, city, province")
        .single();
      if (schoolRow) setSchool(schoolRow);

      const { data: studentRows } = await supabase.from("students").select("active");
      setStudentCount(studentRows?.length ?? 0);
      setActiveStudentCount((studentRows ?? []).filter((s) => s.active !== false).length);

      const [realTeachers, realHalaqas, realReview, realAbsences, realAttendance] =
        await Promise.all([
          loadRealTeachers(),
          loadRealHalaqas(),
          loadRealReviewItems(),
          loadRealAbsences(),
          loadRealAttendanceRate(),
        ]);
      setTeachers(realTeachers);
      setHalaqas(realHalaqas);
      setReviewItems(realReview);
      setAbsenceItems(realAbsences);
      setAttendanceRate(realAttendance);
    };
    load();
  }, []);

  const activeTeachers = teachers.filter((t) => t.active !== false);
  const unassignedHalaqas = halaqas.filter((h) => !h.teacherId);

  return (
    <div className="max-w-5xl mx-auto space-y-4 pt-2">
      <PortalHero
        eyebrow="School overview"
        title={school.name}
        meta={[
          `${school.city}, ${school.province}`,
          formatDay(DEMO_TODAY),
          `${reviewItems.length + unassignedHalaqas.length} open items`,
        ]}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile value={activeStudentCount} label="Students" sub={`${studentCount - activeStudentCount} inactive`} />
        <StatTile value={activeTeachers.length} label="Teachers" sub={`${halaqas.length} halaqas`} />
        <StatTile value={halaqas.length} label="Halaqas" sub={unassignedHalaqas.length ? `${unassignedHalaqas.length} unassigned` : "all assigned"} />
        <StatTile value={attendanceRate == null ? "—" : `${attendanceRate}%`} label="Attendance" sub="school-wide" />
      </div>

      <div className="grid md:grid-cols-2 gap-3 items-start">
        <SectionCard title="Needs review" note={`${reviewItems.length} assignments`}>
          {reviewItems.length === 0 ? (
            <EmptyNote>Nothing waiting on a teacher&apos;s review.</EmptyNote>
          ) : (
            <ul className="divide-y divide-surface-border -my-1">
              {reviewItems.map((r) => (
                <li key={r.id} className="py-2.5 text-[13px] text-ink">
                  A student in {r.halaqaName} has work flagged for review.
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Recent absences" note={`${absenceItems.length} reported`}>
          {absenceItems.length === 0 ? (
            <EmptyNote>No absences reported recently.</EmptyNote>
          ) : (
            <ul className="divide-y divide-surface-border -my-1">
              {absenceItems.map((m) => (
                <li key={m.id} className="py-2.5">
                  <p className="text-[13px] text-ink">{m.body}</p>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    {m.authorName} · {m.absenceDate}
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
