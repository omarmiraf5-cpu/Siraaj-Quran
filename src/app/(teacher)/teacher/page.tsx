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
  AttendanceLegend,
  EmptyNote,
  LoadingNote,
} from "@/components/portal-ui";
import { IconBook, IconCalendar, IconClock, IconPen, IconArrow } from "@/components/icons";
import { AnnouncementsFeed } from "@/components/AnnouncementsFeed";
import { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";
import { fetchAll, daysAgoIso, ATTENDANCE_WINDOW_DAYS } from "@/lib/supabase/fetchAll";
import { readCache, writeCache } from "@/lib/pageCache";
import type { QuranicAssignment } from "@/hooks/useQuranicAssignments";
import { useLanguage } from "@/components/LanguageProvider";
import { countLabel } from "@/lib/i18n/phrases";
import { SignInCard, useAttendanceApi } from "@/components/attendance-ui";
import { myHalaqas, narrowToMine, type MyHalaqa } from "@/lib/teacherScope";
import { ByLanguage } from "@/components/ByLanguage";
import { MetricCard } from "@/components/MetricCard";
import { gradeLabel } from "@/lib/grades";
import { Users, BookOpen, ClipboardCheck, CalendarCheck } from "lucide-react";

// A child's chip on a halaqa card, by today's mark.
const CHIP_STYLE: Record<AttendanceStatus, string> = {
  present: "bg-green-50 border-green-300 text-green-900 hover:border-green-600 dark:bg-green-950/30 dark:border-green-800/60 dark:text-green-200",
  late: "bg-amber-50 border-amber-300 text-amber-900 hover:border-amber-600 dark:bg-amber-950/30 dark:border-amber-800/60 dark:text-amber-200",
  absent: "bg-red-50 border-red-300 text-red-900 hover:border-red-600 dark:bg-red-950/30 dark:border-red-800/60 dark:text-red-200",
  excused: "bg-slate-100 border-slate-300 text-slate-800 hover:border-slate-500 dark:bg-slate-800/40 dark:border-slate-600 dark:text-slate-200",
};
const CHIP_DOT: Record<AttendanceStatus, string> = {
  present: "bg-green-700",
  late: "bg-amber-600",
  absent: "bg-red-700",
  excused: "bg-slate-500",
};

const STATUS_TEXT: Record<AttendanceStatus, string> = {
  present: "text-green-800 dark:text-green-300",
  late: "text-amber-800 dark:text-amber-300",
  absent: "text-red-800 dark:text-red-300",
  excused: "text-slate-600 dark:text-slate-300",
};

const SNAPSHOT_KEY = "teacher-dashboard";
interface DashboardSnapshot {
  today: string;
  teacherName: string | null;
  students: RosterStudent[];
  assignments: QuranicAssignment[];
  history: Record<string, AttendanceDay[]>;
  todayMarks: Record<string, AttendanceStatus>;
  groups: MyHalaqa[];
}

interface RosterStudent {
  id: string;
  name: string;
  halaqa: string;
}

/** Today on the teacher's own device — toISOString() is the UTC date,
 *  which turns an evening in Edmonton into tomorrow. */
function todayIso() {
  return new Date().toLocaleDateString("en-CA");
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
  const { t, language, tr } = useLanguage();
  const demoUser = useDemoUser();
  const { mode: staffMode, api: staffApi } = useAttendanceApi("teacher");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownView | null>(null);

  // Last visit's dashboard, shown at once while it's read again.
  const seen = readCache<DashboardSnapshot>(SNAPSHOT_KEY);
  const [ready, setReady] = useState(Boolean(seen));
  const [isDemo, setIsDemo] = useState(false);
  const [today, setToday] = useState(seen?.today ?? DEMO_TODAY);
  const [teacherName, setTeacherName] = useState<string | null>(seen?.teacherName ?? null);
  // Start empty rather than seeded with the demo roster: this dashboard can
  // load into either a real teacher's session or the demo, and showing the
  // sample class first — then swapping to the real one a moment later —
  // briefly puts one school's data on screen inside another's session.
  // Nothing renders below until `ready`, once we actually know which one
  // this is.
  const [students, setStudents] = useState<RosterStudent[]>(seen?.students ?? []);
  const [assignments, setAssignments] = useState<QuranicAssignment[]>(seen?.assignments ?? []);
  const [attendanceHistory, setAttendanceHistory] = useState<Record<string, AttendanceDay[]>>(seen?.history ?? {});
  const [todayStatus, setTodayStatus] = useState<Record<string, AttendanceStatus> | null>(seen?.todayMarks ?? null);
  // The halaqas they teach, each with its children (just the ones on the roster).
  const [groups, setGroups] = useState<MyHalaqa[]>(seen?.groups ?? []);

  useEffect(() => {
    const load = async () => {
      const user = await sessionUser(supabase);

      if (!user) {
        setIsDemo(true);
        setStudents(DEMO_STUDENTS);
        setAssignments(DEMO_ASSIGNMENTS);
        setAttendanceHistory(DEMO_ATTENDANCE);
        setGroups(
          [...new Set(DEMO_STUDENTS.map((s) => s.halaqa))].map((h) => ({
            id: h,
            label: h,
            studentIds: DEMO_STUDENTS.filter((s) => s.halaqa === h).map((s) => s.id),
          }))
        );
        return;
      }

      const todayStr = todayIso();
      setToday(todayStr);

      const [{ data: profile }, { data: studentRows }, { data: assignmentRows }, { data: attendanceRows }, halaqaRows] =
        await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", user.id).single(),
          supabase.from("students").select("id, full_name, grade").eq("active", true).order("full_name"),
          // Theirs, and those for the children of any halaqa they teach
          // (with others, too): the policies on both tables decide.
          supabase.from("quranic_assignments").select("*"),
          // About a term of marks, every page of them — not every mark
          // since the school began, cut off unseen at 1,000 rows.
          fetchAll<{ student_id: string; class_date: string; status: string }>((from, to) =>
            supabase
              .from("attendance")
              .select("student_id, class_date, status")
              .gte("class_date", daysAgoIso(ATTENDANCE_WINDOW_DAYS))
              .order("class_date", { ascending: false })
              .order("student_id")
              .range(from, to)
          )
            .then((data) => ({ data }))
            .catch(() => ({ data: [] as { student_id: string; class_date: string; status: string }[] })),
          // Their own halaqas, each with its children.
          myHalaqas(supabase),
        ]);
      const mine = halaqaRows && new Map(halaqaRows.flatMap((h) => h.studentIds.map((id) => [id, h.label] as const)));

      const name = profile?.full_name ?? null;
      setTeacherName(name);
      const roster = narrowToMine(
        (studentRows ?? []).map((s) => ({ id: s.id, name: s.full_name, halaqa: `Grade ${s.grade}` })),
        mine
      );
      const theirs = new Set(roster.map((s) => s.id));
      setStudents(roster);
      const groupList = (halaqaRows ?? []).map((h) => ({ ...h, studentIds: h.studentIds.filter((id) => theirs.has(id)) }));
      const work = ((assignmentRows ?? []) as QuranicAssignment[]).filter((a) => !mine || theirs.has(a.student_id));
      setGroups(groupList);
      setAssignments(work);

      const history: Record<string, AttendanceDay[]> = {};
      const todayMarks: Record<string, AttendanceStatus> = {};
      for (const row of attendanceRows ?? []) {
        if (mine && !theirs.has(row.student_id)) continue;
        const day: AttendanceDay = { date: row.class_date, status: row.status as AttendanceStatus };
        (history[row.student_id] ??= []).push(day);
        if (row.class_date === todayStr) todayMarks[row.student_id] = day.status;
      }
      setAttendanceHistory(history);
      setTodayStatus(todayMarks);
      writeCache<DashboardSnapshot>(SNAPSHOT_KEY, {
        today: todayStr,
        teacherName: name,
        students: roster,
        assignments: work,
        history,
        todayMarks,
        groups: groupList,
      });
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

  // The students card's one-line summary: "4 grades • North Campus" in a
  // school kept in grades, else how many halaqas (or the one's name). The
  // card opens the full list.
  const groupGrades = [...new Set(groups.map((h) => h.grade).filter((g): g is number => typeof g === "number"))];
  const groupCampuses = [...new Set(groups.map((h) => h.campus).filter((c): c is string => Boolean(c)))];
  const studentsPill =
    groups.length === 0
      ? undefined
      : groupGrades.length > 0
        ? [
            groupGrades.length === 1 ? gradeLabel(groupGrades[0]) : tr("{count} grade|{count} grades", { count: groupGrades.length }),
            groupCampuses.length === 1 ? groupCampuses[0] : groupCampuses.length > 1 ? tr("{count} campus|{count} campuses", { count: groupCampuses.length }) : null,
          ]
            .filter(Boolean)
            .join(" • ")
        : groups.length === 1
          ? groups[0].label
          : tr("{count} halaqa|{count} halaqas", { count: groups.length });
  const inTodayText = countLabel("{inToday} of {count} in today", students.length, `${inToday} ${t("common.of")} ${students.length} ${t("common.inToday")}`, { inToday });
  // Where a card leads: its page, or in the sample school the panel that
  // lists the sample students it counts.
  const lead = (view: DrilldownView, href: string) => (isDemo ? { onClick: () => setDrilldown(view) } : { href });

  if (!ready) {
    return (
      <div className="max-w-6xl mx-auto pt-10">
        <LoadingNote stats rows={5}>{t("common.loadingDashboard")}</LoadingNote>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 pt-2">
      {/* Greeting — carries the day's actual state and the things a teacher
          opens this page to do, rather than standing empty: the register,
          setting work, and their own sign-in page. */}
      <PortalHero
        eyebrow={t("common.asalaamuAlaykum")}
        title={(isDemo ? demoUser?.name : teacherName) ?? t("role.teacher")}
        meta={[
          formatDay(today, language),
          inTodayText,
          countLabel("{count} to review|{count} to review", review.length, `${review.length} ${t("common.toReview")}`),
        ]}
        actions={
          <>
            <HeroButtonPrimary href="/teacher/attendance" icon={<IconCalendar />}>
              {t("common.register")}
            </HeroButtonPrimary>
            <HeroButtonGhost href="/teacher/quran-assignments" icon={<IconPen />}>
              {t("common.assign")}
            </HeroButtonGhost>
            <HeroButtonGhost href="/teacher/my-attendance" icon={<IconClock />}>
              {t("nav.signIn")}
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
        <MetricCard
          icon={Users}
          value={students.length}
          muted={students.length === 0}
          label={t("nav.students")}
          pill={studentsPill}
          sub={groups.length === 0 ? tr("No halaqa yet") : undefined}
          detailsTitle={tr("Your halaqas")}
          details={groups.map((h) => ({
            key: h.id,
            label: h.label,
            value: h.studentIds.length,
            href: isDemo ? "/teacher/attendance" : `/teacher/attendance?halaqa=${encodeURIComponent(h.id)}`,
          }))}
        />
        <MetricCard
          icon={BookOpen}
          tone="green"
          value={active.length}
          muted={active.length === 0}
          label={t("common.activeWork")}
          sub={dueThisWeek > 0 ? countLabel("{count} due this week|{count} due this week", dueThisWeek, `${dueThisWeek} ${t("common.dueThisWeek")}`) : tr("Nothing due this week")}
          {...lead("active", "/teacher/quran-assignments")}
        />
        <MetricCard
          icon={ClipboardCheck}
          tone={review.length > 0 ? "amber" : "green"}
          value={review.length}
          muted={review.length === 0}
          label={t("common.toReview")}
          sub={reviewDue ? `${t("common.oldestDue")} ${formatDay(reviewDue, language)}` : review.length > 0 ? undefined : tr("All caught up")}
          {...lead("review", "/teacher/quran-assignments")}
        />
        <MetricCard
          icon={CalendarCheck}
          tone="gold"
          value={`${avgAttendance}%`}
          muted={avgAttendance === 0}
          label={t("common.attendanceStat")}
          sub={inTodayText}
          meter={{ value: students.length > 0 ? (inToday / students.length) * 100 : 0, label: inTodayText }}
          {...lead("attendance", "/teacher/attendance")}
        />
      </div>

      {/* Their halaqas, each with its children and how today's register
          stands, and a way straight into that halaqa's register. */}
      {groups.length > 0 && (
        <SectionCard
          title={t("teacher.dashboard.myHalaqas")}
          note={countLabel("{count} halaqa|{count} halaqas", groups.length, `${groups.length} ${groups.length === 1 ? t("teacher.dashboard.halaqa") : t("teacher.dashboard.halaqas")}`)}
        >
          <div className="grid md:grid-cols-2 gap-3">
            {groups.map((h) => {
              const kids = h.studentIds
                .map((id) => students.find((s) => s.id === id))
                .filter((s): s is RosterStudent => Boolean(s));
              const status = (id: string) =>
                isDemo ? DEMO_ATTENDANCE[id]?.[0]?.status : todayStatus?.[id];
              const marked = kids.filter((k) => status(k.id)).length;
              return (
                <div key={h.id} className="rounded-2xl border border-surface-border p-4" data-halaqa={h.label}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[14px] text-ink [overflow-wrap:anywhere]">{h.label}</p>
                      <p className="text-[11px] text-ink-muted">
                        {countLabel("{count} student|{count} students", kids.length, `${kids.length} ${t("common.students")}`)} · {marked}/{kids.length} {countLabel("{count} marked|{count} marked", marked, t("teacher.attendance.marked"))}{" "}
                        {t("teacher.dashboard.today")}
                      </p>
                    </div>
                    <Link
                      href={isDemo ? "/teacher/attendance" : `/teacher/attendance?halaqa=${encodeURIComponent(h.id)}`}
                      className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-all active:scale-95 ${
                        marked === kids.length && kids.length > 0
                          ? "border border-emerald-600/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          : "gradient-emerald text-white hover:opacity-90 shadow-sm"
                      }`}
                    >
                      <IconCalendar size={14} />
                      {marked === kids.length && kids.length > 0 ? t("teacher.attendance.everyoneMarked") : t("teacher.dashboard.takeRegister")}
                    </Link>
                  </div>
                  {kids.length === 0 ? (
                    <p className="mt-3 text-[12px] text-ink-muted">{t("teacher.dashboard.noChildrenYet")}</p>
                  ) : (
                    <>
                      {/* Each child a button, tinted by today's mark; it opens
                          their attendance and work. */}
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {kids.map((k) => {
                          const st = status(k.id);
                          return (
                            <li key={k.id}>
                              <button
                                type="button"
                                onClick={() => setSelectedStudentId(k.id)}
                                aria-label={`${k.name}${st ? ` — ${t(`common.${st}`)}` : ""}`}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 ${
                                  st ? CHIP_STYLE[st] : "bg-surface-card border-surface-border text-ink hover:border-brand-navy hover:bg-surface-bg-warm"
                                }`}
                              >
                                {st && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${CHIP_DOT[st]}`} />}
                                {k.name}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {/* What the tints mean, once any child is marked. */}
                      {marked > 0 && (
                        <p className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                          {(["present", "late", "absent", "excused"] as const).map((x) => (
                            <span key={x} className="inline-flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full ${CHIP_DOT[x]}`} />
                              {t(`common.${x}`)}
                            </span>
                          ))}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

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
              {exceptions.map(({ student, status }) => (
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
                      <span className="block text-[13px] font-semibold text-ink [overflow-wrap:anywhere]">
                        {student.name}
                      </span>
                      <span className="block text-[11px] text-ink-muted">{student.halaqa}</span>
                    </span>
                    <span className={`text-[12px] font-semibold capitalize flex-shrink-0 ${STATUS_TEXT[status]}`}>
                      {t(`common.${status}`)}
                    </span>
                  </button>
                </li>
              ))}
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
        <SectionCard title={t("common.needsReview")} note={countLabel("{count} waiting|{count} waiting", review.length, `${review.length} ${t("common.waiting")}`)}>
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
                      <p className="text-[13px] font-semibold text-ink [overflow-wrap:anywhere]">
                        {student?.name ?? t("role.student")}
                      </p>
                      <p className="text-[12px] text-ink-body">
                        {surah ? surah.englishName : tr("Surah {surah}", { surah: a.surah })}
                        <span className="text-ink-muted">
                          {" "}
                          · {t("common.ayahs")} {a.ayah_start}–{a.ayah_end}
                        </span>
                      </p>
                      {a.teacher_notes && (
                        <p className="text-[11px] text-ink-muted mt-1 [overflow-wrap:anywhere] leading-snug">
                          {a.teacher_notes}
                        </p>
                      )}
                      {/* Under the note rather than beside it: this card is
                          narrow on a tablet, and a date column squeezed the
                          note into a sliver. */}
                      {a.due_date && (
                        <p className="text-[11px] text-ink-muted mt-1">{formatDay(a.due_date, language)}</p>
                      )}
                    </div>
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
        {/* The English meaning, for readers of the Arabic above who need it. */}
        <ByLanguage
          en={
            <p className="font-serif text-[15px] text-ink-body italic" dir="ltr">
              “The best among you are those who learn the Qur&apos;an and teach it.”
            </p>
          }
          ar={null}
        />
        <p className="text-[11px] text-ink-muted mt-2" dir="ltr">{tr("Prophet Muhammad ﷺ")}</p>
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
          real={
            isDemo
              ? undefined
              : (() => {
                  const st = students.find((x) => x.id === selectedStudentId);
                  const group = groups.find((g) => g.studentIds.includes(selectedStudentId));
                  return st
                    ? {
                        student: { ...st, halaqa: group?.label ?? st.halaqa },
                        attendance: attendanceHistory[st.id] ?? [],
                        assignments,
                      }
                    : undefined;
                })()
          }
          registerHref={(() => {
            const group = groups.find((g) => g.studentIds.includes(selectedStudentId));
            return !isDemo && group ? `/teacher/attendance?halaqa=${encodeURIComponent(group.id)}` : "/teacher/attendance";
          })()}
        />
      )}
    </div>
  );
}
