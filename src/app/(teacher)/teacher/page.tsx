"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDemoUser } from "@/hooks/useDemoUser";
import {
  DEMO_STUDENTS,
  DEMO_ASSIGNMENTS,
  DEMO_ATTENDANCE,
  DEMO_TODAY,
  summariseAttendance,
  formatDay,
  daysFromToday,
  initials,
  type AttendanceStatus,
  type AttendanceDay,
} from "@/data/demo";
import { getSurahById } from "@/data/mushaf-index";
import { StudentDetailPanel } from "@/components/StudentDetailPanel";
import { TeacherDrilldown, type DrilldownView } from "@/components/TeacherDrilldown";
import { PortalHero, HeroButtonPrimary, HeroButtonGhost } from "@/components/PortalHero";
import {
  SectionCard,
  StatTile,
  AttendanceLegend,
  EmptyNote,
  LoadingNote,
} from "@/components/portal-ui";
import { IconBook, IconCalendar, IconPen, IconArrow } from "@/components/icons";
import { AnnouncementsFeed } from "@/components/AnnouncementsFeed";
import { createClient } from "@/lib/supabase/client";
import type { QuranicAssignment } from "@/hooks/useQuranicAssignments";
import { useLanguage } from "@/components/LanguageProvider";
import { SignInCard, useAttendanceApi } from "@/components/attendance-ui";

const STATUS_TEXT: Record<AttendanceStatus, string> = {
  present: "text-green-800 dark:text-green-300",
  late: "text-amber-800 dark:text-amber-300",
  absent: "text-red-800 dark:text-red-300",
  excused: "text-slate-600 dark:text-slate-300",
};

interface RosterStudent {
  id: string;
  name: string;
  halaqa: string;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// daysFromToday (from @/data/demo) measures against the fixed demo
// timeline's DEMO_TODAY, which is what every sample due_date is anchored
// to — a real school's due dates need measuring against the actual date.
function daysFromReal(iso: string, todayStr: string): number {
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${todayStr}T00:00:00Z`)) / DAY_MS);
}

export default function TeacherDashboard() {
  const supabase = createClient();
  const { t, language } = useLanguage();
  const demoUser = useDemoUser();
  const { mode: staffMode, api: staffApi } = useAttendanceApi("teacher");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownView | null>(null);

  const [ready, setReady] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [today, setToday] = useState(DEMO_TODAY);
  const [teacherName, setTeacherName] = useState<string | null>(null);
  // Start empty rather than seeded with the demo roster: this dashboard can
  // load into either a real teacher's session or the demo, and showing the
  // sample class first — then swapping to the real one a moment later —
  // briefly puts one school's data on screen inside another's session.
  // Nothing renders below until `ready`, once we actually know which one
  // this is.
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [assignments, setAssignments] = useState<QuranicAssignment[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<Record<string, AttendanceDay[]>>({});
  const [todayStatus, setTodayStatus] = useState<Record<string, AttendanceStatus> | null>(null);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsDemo(true);
        setStudents(DEMO_STUDENTS);
        setAssignments(DEMO_ASSIGNMENTS);
        setAttendanceHistory(DEMO_ATTENDANCE);
        return;
      }

      const todayStr = todayIso();
      setToday(todayStr);

      const [{ data: profile }, { data: studentRows }, { data: assignmentRows }, { data: attendanceRows }] =
        await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", user.id).single(),
          supabase.from("students").select("id, full_name, grade").eq("active", true).order("full_name"),
          supabase.from("quranic_assignments").select("*").eq("teacher_id", user.id),
          supabase.from("attendance").select("student_id, class_date, status").eq("teacher_id", user.id),
        ]);

      setTeacherName(profile?.full_name ?? null);
      setStudents((studentRows ?? []).map((s) => ({ id: s.id, name: s.full_name, halaqa: `Grade ${s.grade}` })));
      setAssignments((assignmentRows ?? []) as QuranicAssignment[]);

      const history: Record<string, AttendanceDay[]> = {};
      const todayMarks: Record<string, AttendanceStatus> = {};
      for (const row of attendanceRows ?? []) {
        const day: AttendanceDay = { date: row.class_date, status: row.status as AttendanceStatus };
        (history[row.student_id] ??= []).push(day);
        if (row.class_date === todayStr) todayMarks[row.student_id] = day.status;
      }
      setAttendanceHistory(history);
      setTodayStatus(todayMarks);
    };

    load().finally(() => setReady(true));
  }, []);

  // Today's register: in demo mode every student always has a status
  // (fixed sample data), but a real school may not have taken attendance
  // yet — so only students actually marked today show up here at all.
  const register = isDemo
    ? DEMO_STUDENTS.map((s) => ({ student: s, status: DEMO_ATTENDANCE[s.id][0].status }))
    : students
        .filter((s) => todayStatus && todayStatus[s.id])
        .map((s) => ({ student: s, status: todayStatus![s.id] }));
  const tally = (s: AttendanceStatus) => register.filter((r) => r.status === s).length;
  const inToday = tally("present") + tally("late");
  // Everyone the teacher may need to do something about; present needs nothing.
  const exceptions = register.filter((r) => r.status !== "present");
  const nothingMarkedYet = !isDemo && todayStatus !== null && Object.keys(todayStatus).length === 0;

  const todayCounts = {
    present: tally("present"),
    late: tally("late"),
    absent: tally("absent"),
    excused: tally("excused"),
    total: students.length,
    rate: 0,
  };

  const review = assignments.filter((a) => a.status === "needs_review");
  const active = assignments.filter((a) => a.status !== "completed");
  const dueThisWeek = active.filter((a) => {
    if (!a.due_date) return false;
    const d = isDemo ? daysFromToday(a.due_date) : daysFromReal(a.due_date, today);
    return d >= 0 && d <= 7;
  }).length;

  const reviewDue = review
    .map((a) => a.due_date)
    .filter((d): d is string => Boolean(d))
    .sort()[0];

  const avgAttendance =
    students.length > 0
      ? Math.round(
          students.reduce((sum, s) => sum + summariseAttendance(attendanceHistory[s.id] ?? []).rate, 0) /
            students.length
        )
      : 0;

  const halaqas = [...new Set(students.map((s) => s.halaqa))];

  if (!ready) {
    return (
      <div className="max-w-6xl mx-auto pt-10">
        <LoadingNote>{t("common.loadingDashboard")}</LoadingNote>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 pt-2">
      {/* Greeting — carries the day's actual state and the two things a
          teacher opens this page to do, rather than standing empty. */}
      <PortalHero
        eyebrow={t("common.asalaamuAlaykum")}
        title={(isDemo ? demoUser?.name : teacherName) ?? t("role.teacher")}
        meta={[
          formatDay(today, language),
          `${inToday} ${t("common.of")} ${students.length} ${t("common.inToday")}`,
          `${review.length} ${t("common.toReview")}`,
        ]}
        actions={
          <>
            <HeroButtonPrimary href="/teacher/attendance" icon={<IconCalendar />}>
              {t("common.register")}
            </HeroButtonPrimary>
            <HeroButtonGhost href="/teacher/quran-assignments" icon={<IconPen />}>
              {t("common.assign")}
            </HeroButtonGhost>
          </>
        }
      />

      {/* Signing in on arrival — the first thing a teacher does, so it sits
          straight under the greeting rather than on a page of its own. */}
      {staffMode !== "loading" && <SignInCard api={staffApi} />}

      {/* At a glance — each number carries the context that makes it mean
          something, and opens the list it is counting. Opening a list is a
          demo-only affordance for now: the drilldown panels below always
          read from the sample dataset, so a real teacher's tap would show
          the wrong students. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          value={students.length}
          label={t("nav.students")}
          sub={halaqas
            .map((h) => `${students.filter((s) => s.halaqa === h).length} ${t("common.in")} ${h.replace("Halaqa ", "")}`)
            .join(" · ")}
          onClick={isDemo ? () => setDrilldown("students") : undefined}
        />
        <StatTile
          value={active.length}
          label={t("common.activeWork")}
          sub={dueThisWeek > 0 ? `${dueThisWeek} ${t("common.dueThisWeek")}` : t("common.nothingDueThisWeek")}
          onClick={isDemo ? () => setDrilldown("active") : undefined}
        />
        <StatTile
          value={review.length}
          label={t("common.toReview")}
          sub={reviewDue ? `${t("common.oldestDue")} ${formatDay(reviewDue, language)}` : t("common.allClear")}
          onClick={isDemo ? () => setDrilldown("review") : undefined}
        />
        <StatTile
          value={`${avgAttendance}%`}
          label={t("common.attendanceStat")}
          sub={`${inToday} ${t("common.of")} ${students.length} ${t("common.inToday")}`}
          onClick={isDemo ? () => setDrilldown("attendance") : undefined}
        />
      </div>

      <AnnouncementsFeed audience="teachers" />

      <div className="grid md:grid-cols-2 gap-3 items-start">
        {/* Today's register — the outcome and the exceptions, so the teacher
            can see who needs chasing without opening the page. */}
        <SectionCard title={t("common.todaysRegister")} note={formatDay(today, language)}>
          <div className="-mt-1 mb-4">
            <AttendanceLegend counts={todayCounts} />
          </div>

          {exceptions.length === 0 ? (
            <EmptyNote>
              {nothingMarkedYet ? t("common.attendanceNotTakenYet") : t("common.everyonePresentToday")}
            </EmptyNote>
          ) : (
            <ul className="space-y-1">
              {exceptions.map(({ student, status }) =>
                isDemo ? (
                  <li key={student.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(student.id)}
                      className="w-full flex items-center gap-3 text-start rounded-xl px-2 py-1.5 -mx-2 hover:bg-surface-bg-warm transition-colors"
                    >
                      <span className="w-8 h-8 rounded-full bg-surface-bg-warm border border-surface-border flex items-center justify-center text-[11px] font-bold text-ink-muted flex-shrink-0">
                        {initials(student.name)}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold text-ink truncate">
                          {student.name}
                        </span>
                        <span className="block text-[11px] text-ink-muted">{student.halaqa}</span>
                      </span>
                      <span
                        className={`text-[12px] font-semibold capitalize flex-shrink-0 ${STATUS_TEXT[status]}`}
                      >
                        {t(`common.${status}`)}
                      </span>
                    </button>
                  </li>
                ) : (
                  <li
                    key={student.id}
                    className="w-full flex items-center gap-3 rounded-xl px-2 py-1.5 -mx-2"
                  >
                    <span className="w-8 h-8 rounded-full bg-surface-bg-warm border border-surface-border flex items-center justify-center text-[11px] font-bold text-ink-muted flex-shrink-0">
                      {initials(student.name)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold text-ink truncate">
                        {student.name}
                      </span>
                      <span className="block text-[11px] text-ink-muted">{student.halaqa}</span>
                    </span>
                    <span className={`text-[12px] font-semibold capitalize flex-shrink-0 ${STATUS_TEXT[status]}`}>
                      {t(`common.${status}`)}
                    </span>
                  </li>
                )
              )}
            </ul>
          )}

          <Link
            href="/teacher/attendance"
            className="group mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            {t("common.openRegister")}
            <span className="group-hover:translate-x-0.5 transition-transform">
              <IconArrow size={14} />
            </span>
          </Link>
        </SectionCard>

        {/* The review queue itself, not a link to where it lives. */}
        <SectionCard title={t("common.needsReview")} note={`${review.length} ${t("common.waiting")}`}>
          {review.length === 0 ? (
            <EmptyNote>{t("common.nothingWaitingOnYou")}</EmptyNote>
          ) : (
            <ul className="space-y-1">
              {review.map((a) => {
                const surah = getSurahById(a.surah);
                const student = students.find((s) => s.id === a.student_id);
                const content = (
                  <>
                    <span className="w-8 h-8 rounded-full bg-surface-bg-warm border border-surface-border flex items-center justify-center text-[11px] font-bold text-ink-muted flex-shrink-0">
                      {initials(student?.name ?? "?")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-ink truncate">
                        {student?.name ?? t("role.student")}
                      </p>
                      <p className="text-[12px] text-ink-body">
                        {surah ? surah.englishName : `Surah ${a.surah}`}
                        <span className="text-ink-muted">
                          {" "}
                          · {t("common.ayahs")} {a.ayah_start}–{a.ayah_end}
                        </span>
                      </p>
                      {a.teacher_notes && (
                        <p className="text-[11px] text-ink-muted mt-1 line-clamp-2 leading-snug">
                          {a.teacher_notes}
                        </p>
                      )}
                    </div>
                    {a.due_date && (
                      <span className="text-[11px] text-ink-muted flex-shrink-0 whitespace-nowrap">
                        {formatDay(a.due_date, language)}
                      </span>
                    )}
                  </>
                );
                return (
                  <li key={a.id}>
                    {isDemo ? (
                      <button
                        type="button"
                        onClick={() => student && setSelectedStudentId(student.id)}
                        className="w-full flex gap-3 text-start rounded-xl px-2 py-1.5 -mx-2 hover:bg-surface-bg-warm transition-colors"
                      >
                        {content}
                      </button>
                    ) : (
                      <div className="w-full flex gap-3 rounded-xl px-2 py-1.5 -mx-2">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href="/teacher/quran-assignments"
            className="group mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            {t("common.openAssignments")}
            <span className="group-hover:translate-x-0.5 transition-transform">
              <IconArrow size={14} />
            </span>
          </Link>
        </SectionCard>
      </div>

      {/* The Mushaf has no state to summarise, so it stays a link — but a
          quiet one, rather than a card the size of the work above it. */}
      <Link
        href="/teacher/mushaf"
        className="card-quiet card-feature group flex items-center gap-3.5 px-5 py-4 transition-all hover:-translate-y-0.5 hover:shadow-lg"
      >
        <span className="icon-tile flex-shrink-0">
          <IconBook size={19} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block page-title text-[15px]">{t("nav.mushaf")}</span>
          <span className="block text-[12px] text-ink-muted">
            {t("teacher.dashboard.mushafBlurb")}
          </span>
        </span>
        <span className="text-ink-muted group-hover:translate-x-0.5 group-hover:text-ink transition-all flex-shrink-0">
          <IconArrow size={14} />
        </span>
      </Link>

      {/* Hadith — a quiet feature panel rather than a green alert box */}
      <section className="card-quiet px-6 py-8 text-center">
        <p className="eyebrow">{t("common.dailyReflection")}</p>
        <p
          className="font-calligraphy text-[28px] md:text-[34px] text-ink mt-4 leading-[2.1]"
          dir="rtl"
          lang="ar"
        >
          خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ
        </p>
        <div className="gold-rule w-20 mx-auto my-5" />
        <p className="font-serif text-[15px] text-ink-body italic" dir="ltr">
          &ldquo;The best among you are those who learn the Qur&apos;an and teach it.&rdquo;
        </p>
        <p className="text-[11px] text-ink-muted mt-2" dir="ltr">Prophet Muhammad &#xFDFA;</p>
      </section>

      {/* A stat opens its list; a name in that list opens the student.
          Picking a student clears `drilldown` too — leaving it set meant
          closing the student panel dropped `selectedStudentId` but not
          `drilldown`, so the list this student came from popped back open
          underneath. From the outside that looked exactly like the X on the
          student panel doing nothing: click it, and a screen appears again.
          Demo-only: both panels below always read the sample dataset, and
          `drilldown`/`selectedStudentId` can only be set from the demo-mode
          click handlers above, so this never fires for a real session. */}
      {drilldown && !selectedStudentId && (
        <TeacherDrilldown
          view={drilldown}
          onClose={() => setDrilldown(null)}
          onSelectStudent={(id) => {
            setDrilldown(null);
            setSelectedStudentId(id);
          }}
        />
      )}

      {selectedStudentId && (
        <StudentDetailPanel
          studentId={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
        />
      )}
    </div>
  );
}
