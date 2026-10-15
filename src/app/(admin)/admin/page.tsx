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
  halaqaTeacherIds,
  schoolAttendanceRate,
  studentsInHalaqa,
  type StudentOverride,
  type TeacherOverride,
  type HalaqaOverride,
} from "@/data/demo";
import { DEMO_SCHOOL } from "@/lib/demo";
import type { DemoTeacher, DemoHalaqa } from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, StatTile, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { IconArrow } from "@/components/icons";
import { readDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";
import { loadSchoolTeachers } from "@/lib/schoolTeachers";
import { useLanguage } from "@/components/LanguageProvider";
import { countLabel } from "@/lib/i18n/phrases";
import { NoticesPanel, useAttendanceApi } from "@/components/attendance-ui";
import { AgreementsBanner } from "@/components/AgreementsBanner";
import { Users, GraduationCap, BookOpen, CalendarCheck } from "lucide-react";

type ReviewItem = { id: string; halaqaName: string };
type AbsenceItem = { id: string; body: string; authorName: string; absenceDate: string | null };

export default function AdminDashboard() {
  const supabase = createClient();
  const { t, language } = useLanguage();
  const { mode: noticeMode, api: noticeApi } = useAttendanceApi("admin");
  const [ready, setReady] = useState(false);

  // Unknown until it's loaded: starting from the sample school's name put
  // "Siraaj Academy" on a real school's dashboard for the moment that took.
  const [school, setSchool] = useState<{ name: string; city: string | null; province: string | null } | null>(null);
  const [today, setToday] = useState(DEMO_TODAY);
  const [isDemoSchool, setIsDemoSchool] = useState(true);
  const [studentCount, setStudentCount] = useState(0);
  const [activeStudentCount, setActiveStudentCount] = useState(0);
  const [teachers, setTeachers] = useState<DemoTeacher[]>([]);
  const [halaqas, setHalaqas] = useState<DemoHalaqa[]>([]);
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [absenceItems, setAbsenceItems] = useState<AbsenceItem[]>([]);

  const loadRealHalaqas = async (): Promise<DemoHalaqa[]> => {
    const [{ data }, { data: others }] = await Promise.all([
      supabase.from("classes").select("id, name, teacher_id, schedule").order("name"),
      supabase.from("class_teachers").select("class_id, teacher_id"),
    ]);
    const othersOf = new Map<string, string[]>();
    for (const o of others ?? []) othersOf.set(o.class_id, [...(othersOf.get(o.class_id) ?? []), o.teacher_id]);
    return (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      teacherId: c.teacher_id,
      coTeacherIds: othersOf.get(c.id) ?? [],
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
      halaqaName: halaqaByStudent.get(a.student_id) ?? t("common.aHalaqa"),
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
        t("common.unknown"),
      absenceDate: m.absence_date,
    }));
  };

  // Counted by the database rather than every mark downloaded and counted
  // here: two numbers come back instead of thousands of rows (which were
  // also cut off at 1,000, so a big school's rate was off).
  const loadRealAttendanceRate = async (): Promise<number | null> => {
    const [all, present] = await Promise.all([
      supabase.from("attendance").select("student_id", { count: "exact", head: true }),
      supabase.from("attendance").select("student_id", { count: "exact", head: true }).in("status", ["present", "late"]),
    ]);
    if (!all.count) return null;
    return Math.round(((present.count ?? 0) / all.count) * 100);
  };

  useEffect(() => {
    const load = async () => {
      const user = await sessionUser(supabase);

      if (!user) {
        setSchool({ name: DEMO_SCHOOL.name, city: DEMO_SCHOOL.city, province: DEMO_SCHOOL.province });
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
              )?.name ?? t("common.aHalaqa"),
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

      setToday(new Date().toLocaleDateString("en-CA"));
      setIsDemoSchool(false);
      // The school they're signed in to, by its id: an admin can see more
      // than one school (a teacher's other school), so "the one school I
      // can see" isn't a question with one answer.
      const { data: me } = await supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle();
      const { data: schoolRow } = me?.school_id
        ? await supabase.from("schools").select("name, city, province").eq("id", me.school_id).maybeSingle()
        : { data: null };
      setSchool(schoolRow ?? { name: "", city: null, province: null });

      const { data: studentRows } = await supabase.from("students").select("active");
      setStudentCount(studentRows?.length ?? 0);
      setActiveStudentCount((studentRows ?? []).filter((s) => s.active !== false).length);

      const [realTeachers, realHalaqas, realReview, realAbsences, realAttendance] =
        await Promise.all([
          loadSchoolTeachers(supabase),
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
    load().finally(() => setReady(true));
  }, []);

  const activeTeachers = teachers.filter((t) => t.active !== false);
  const unassignedHalaqas = halaqas.filter((h) => !h.teacherId);

  if (!school) {
    return (
      <div className="max-w-7xl mx-auto pt-10">
        <LoadingNote stats rows={5}>{t("common.loadingDashboard")}</LoadingNote>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 pt-2">
      <PortalHero
        eyebrow={t("common.schoolOverview")}
        title={school.name || t("common.schoolOverview")}
        meta={[
          [school.city, school.province].filter(Boolean).join(", "),
          formatDay(today, language),
          countLabel(
            "{count} open item|{count} open items",
            reviewItems.length + unassignedHalaqas.length,
            `${reviewItems.length + unassignedHalaqas.length} ${t("common.openItems")}`,
          ),
        ]}
      />

      <AgreementsBanner enabled={!isDemoSchool} />

      {/* Notices the portal raised on its own — a child absent five school
          days running, a teacher reporting an absence. */}
      {noticeMode !== "loading" && <NoticesPanel api={noticeApi} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={Users} tone="navy" value={activeStudentCount} label={t("nav.students")} sub={countLabel("{count} inactive|{count} inactive", studentCount - activeStudentCount, `${studentCount - activeStudentCount} ${t("common.inactive").toLowerCase()}`)} />
        <StatTile icon={GraduationCap} tone="gold" value={activeTeachers.length} label={t("nav.teachers")} sub={countLabel("{count} halaqa|{count} halaqas", halaqas.length, `${halaqas.length} ${t("nav.halaqas").toLowerCase()}`)} />
        <StatTile icon={BookOpen} tone="green" value={halaqas.length} label={t("nav.halaqas")} sub={unassignedHalaqas.length ? countLabel("{count} unassigned|{count} unassigned", unassignedHalaqas.length, `${unassignedHalaqas.length} ${t("common.unassigned")}`) : t("common.allAssigned")} />
        <StatTile icon={CalendarCheck} tone="amber" value={attendanceRate == null ? "—" : `${attendanceRate}%`} label={t("common.attendanceStat")} sub={t("common.schoolWide")} />
      </div>

      <div className="grid md:grid-cols-2 gap-3 items-start">
        <SectionCard title={t("common.needsReview")} note={countLabel("{count} assignment|{count} assignments", reviewItems.length, `${reviewItems.length} ${t("common.assignmentsCount")}`)}>
          {reviewItems.length === 0 ? (
            <EmptyNote>{t("common.nothingWaitingOnTeacherReview")}</EmptyNote>
          ) : (
            <ul className="divide-y divide-surface-border -my-1">
              {reviewItems.map((r) => (
                <li key={r.id} className="py-2.5 text-[13px] text-ink">
                  {t("common.aStudentInPrefix")} {r.halaqaName} {t("common.hasWorkFlagged")}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t("common.recentAbsences")} note={countLabel("{count} reported|{count} reported", absenceItems.length, `${absenceItems.length} ${t("common.reportedCount")}`)}>
          {absenceItems.length === 0 ? (
            <EmptyNote>{t("common.noAbsencesRecently")}</EmptyNote>
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

      <SectionCard title={t("nav.teachers")} note={countLabel("{count} total", teachers.length, `${teachers.length} ${t("common.total")}`)}>
        <ul className="divide-y divide-surface-border -my-1">
          {teachers.map((teacher) => {
            const theirHalaqas = halaqas.filter((h) => halaqaTeacherIds(h).includes(teacher.id));
            return (
              <li key={teacher.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink [overflow-wrap:anywhere]">{teacher.name}</p>
                  <p className="text-[11px] text-ink-muted [overflow-wrap:anywhere]">
                    {theirHalaqas.length > 0
                      ? theirHalaqas.map((h) => h.name).join(", ")
                      : t("common.noHalaqaAssigned")}
                  </p>
                </div>
                {teacher.active === false && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {t("common.inactive")}
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
          {t("common.manageTeachers")}
          <span className="group-hover:translate-x-0.5 transition-transform">
            <IconArrow size={14} />
          </span>
        </Link>
      </SectionCard>
    </div>
  );
}
