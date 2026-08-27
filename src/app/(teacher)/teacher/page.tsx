"use client";

import { useState } from "react";
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
} from "@/components/portal-ui";
import { IconBook, IconCalendar, IconPen, IconArrow } from "@/components/icons";

const STATUS_TEXT: Record<AttendanceStatus, string> = {
  present: "text-green-800 dark:text-green-300",
  late: "text-amber-800 dark:text-amber-300",
  absent: "text-red-800 dark:text-red-300",
  excused: "text-slate-600 dark:text-slate-300",
};

export default function TeacherDashboard() {
  const demoUser = useDemoUser();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownView | null>(null);

  const register = DEMO_STUDENTS.map((s) => ({
    student: s,
    status: DEMO_ATTENDANCE[s.id][0].status,
  }));
  const tally = (s: AttendanceStatus) => register.filter((r) => r.status === s).length;
  const inToday = tally("present") + tally("late");
  // Everyone the teacher may need to do something about; present needs nothing.
  const exceptions = register.filter((r) => r.status !== "present");

  const todayCounts = {
    present: tally("present"),
    late: tally("late"),
    absent: tally("absent"),
    excused: tally("excused"),
    total: DEMO_STUDENTS.length,
    rate: 0,
  };

  const review = DEMO_ASSIGNMENTS.filter((a) => a.status === "needs_review");
  const active = DEMO_ASSIGNMENTS.filter((a) => a.status !== "completed");
  const dueThisWeek = active.filter((a) => {
    if (!a.due_date) return false;
    const d = daysFromToday(a.due_date);
    return d >= 0 && d <= 7;
  }).length;

  const reviewDue = review
    .map((a) => a.due_date)
    .filter((d): d is string => Boolean(d))
    .sort()[0];

  const avgAttendance = Math.round(
    DEMO_STUDENTS.reduce(
      (sum, s) => sum + summariseAttendance(DEMO_ATTENDANCE[s.id]).rate,
      0
    ) / DEMO_STUDENTS.length
  );

  const halaqas = [...new Set(DEMO_STUDENTS.map((s) => s.halaqa))];

  return (
    <div className="max-w-4xl mx-auto space-y-4 pt-2">
      {/* Greeting — carries the day's actual state and the two things a
          teacher opens this page to do, rather than standing empty. */}
      <PortalHero
        eyebrow="Asalaamu alaykum"
        title={demoUser?.name ?? "Teacher"}
        meta={[
          formatDay(DEMO_TODAY),
          `${inToday} of ${DEMO_STUDENTS.length} in today`,
          `${review.length} to review`,
        ]}
        actions={
          <>
            <HeroButtonPrimary href="/teacher/attendance" icon={<IconCalendar />}>
              Register
            </HeroButtonPrimary>
            <HeroButtonGhost href="/teacher/quran-assignments" icon={<IconPen />}>
              Assign
            </HeroButtonGhost>
          </>
        }
      />

      {/* At a glance — each number carries the context that makes it mean
          something, and opens the list it is counting. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          value={DEMO_STUDENTS.length}
          label="Students"
          sub={halaqas
            .map(
              (h) =>
                `${DEMO_STUDENTS.filter((s) => s.halaqa === h).length} in ${h.replace("Halaqa ", "")}`
            )
            .join(" · ")}
          onClick={() => setDrilldown("students")}
        />
        <StatTile
          value={active.length}
          label="Active work"
          sub={dueThisWeek > 0 ? `${dueThisWeek} due this week` : "nothing due this week"}
          onClick={() => setDrilldown("active")}
        />
        <StatTile
          value={review.length}
          label="To review"
          sub={reviewDue ? `oldest due ${formatDay(reviewDue)}` : "all clear"}
          onClick={() => setDrilldown("review")}
        />
        <StatTile
          value={`${avgAttendance}%`}
          label="Attendance"
          sub={`${inToday} of ${DEMO_STUDENTS.length} in today`}
          onClick={() => setDrilldown("attendance")}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-3 items-start">
        {/* Today's register — the outcome and the exceptions, so the teacher
            can see who needs chasing without opening the page. */}
        <SectionCard title="Today's register" note={formatDay(DEMO_TODAY)}>
          <div className="-mt-1 mb-4">
            <AttendanceLegend counts={todayCounts} />
          </div>

          {exceptions.length === 0 ? (
            <EmptyNote>Everyone was present today.</EmptyNote>
          ) : (
            <ul className="space-y-1">
              {exceptions.map(({ student, status }) => (
                <li key={student.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentId(student.id)}
                    className="w-full flex items-center gap-3 text-left rounded-xl px-2 py-1.5 -mx-2 hover:bg-surface-bg-warm transition-colors"
                  >
                    <span className="w-8 h-8 rounded-full bg-surface-bg-warm border border-surface-border flex items-center justify-center text-[11px] font-bold text-ink-muted flex-shrink-0">
                      {initials(student.name)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold text-ink truncate">
                        {student.name}
                      </span>
                      <span className="block text-[11px] text-ink-muted">
                        {student.halaqa}
                      </span>
                    </span>
                    <span
                      className={`text-[12px] font-semibold capitalize flex-shrink-0 ${STATUS_TEXT[status]}`}
                    >
                      {status}
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
            Open register
            <span className="group-hover:translate-x-0.5 transition-transform">
              <IconArrow size={14} />
            </span>
          </Link>
        </SectionCard>

        {/* The review queue itself, not a link to where it lives. */}
        <SectionCard title="Needs review" note={`${review.length} waiting`}>
          {review.length === 0 ? (
            <EmptyNote>Nothing waiting on you.</EmptyNote>
          ) : (
            <ul className="space-y-1">
              {review.map((a) => {
                const surah = getSurahById(a.surah);
                const student = DEMO_STUDENTS.find((s) => s.id === a.student_id);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => student && setSelectedStudentId(student.id)}
                      className="w-full flex gap-3 text-left rounded-xl px-2 py-1.5 -mx-2 hover:bg-surface-bg-warm transition-colors"
                    >
                      <span className="w-8 h-8 rounded-full bg-surface-bg-warm border border-surface-border flex items-center justify-center text-[11px] font-bold text-ink-muted flex-shrink-0">
                        {initials(student?.name ?? "?")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-ink truncate">
                          {student?.name ?? "Student"}
                        </p>
                        <p className="text-[12px] text-ink-body">
                          {surah ? surah.englishName : `Surah ${a.surah}`}
                          <span className="text-ink-muted">
                            {" "}
                            · ayahs {a.ayah_start}–{a.ayah_end}
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
                          {formatDay(a.due_date)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href="/teacher/quran-assignments"
            className="group mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            Open assignments
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
          <span className="block page-title text-[15px]">Mushaf</span>
          <span className="block text-[12px] text-ink-muted">
            Read the Madinah Mushaf, and play any ayah, page or surah aloud.
          </span>
        </span>
        <span className="text-ink-muted group-hover:translate-x-0.5 group-hover:text-ink transition-all flex-shrink-0">
          <IconArrow size={14} />
        </span>
      </Link>

      {/* Hadith — a quiet feature panel rather than a green alert box */}
      <section className="card-quiet px-6 py-8 text-center">
        <p className="eyebrow">Daily reflection</p>
        <p
          className="font-calligraphy text-[28px] md:text-[34px] text-ink mt-4 leading-[2.1]"
          dir="rtl"
          lang="ar"
        >
          خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ
        </p>
        <div className="gold-rule w-20 mx-auto my-5" />
        <p className="font-serif text-[15px] text-ink-body italic">
          &ldquo;The best among you are those who learn the Qur&apos;an and teach it.&rdquo;
        </p>
        <p className="text-[11px] text-ink-muted mt-2">Prophet Muhammad &#xFDFA;</p>
      </section>

      {/* A stat opens its list; a name in that list opens the student.
          Picking a student clears `drilldown` too — leaving it set meant
          closing the student panel dropped `selectedStudentId` but not
          `drilldown`, so the list this student came from popped back open
          underneath. From the outside that looked exactly like the X on the
          student panel doing nothing: click it, and a screen appears again. */}
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
