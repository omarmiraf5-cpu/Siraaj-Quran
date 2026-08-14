"use client";

import Link from "next/link";
import { useDemoUser } from "@/hooks/useDemoUser";
import {
  DEMO_STUDENTS,
  DEMO_ASSIGNMENTS,
  DEMO_ATTENDANCE,
  summariseAttendance,
  formatDay,
  initials,
  type AttendanceStatus,
} from "@/data/demo";
import { getSurahById } from "@/data/mushaf-index";

const IconBook = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
  </svg>
);

const IconRegister = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" />
  </svg>
);

const IconPen = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const IconArrow = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const STATUS_DOT: Record<AttendanceStatus, string> = {
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

const DAY_MS = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export default function TeacherDashboard() {
  const demoUser = useDemoUser();

  // "Today" is the most recent day in the register, not the real date. These
  // pages prerender, so a value that differs between server and client is a
  // hydration mismatch — which is why the demo data is fixed-date too.
  const today = DEMO_ATTENDANCE[DEMO_STUDENTS[0].id][0].date;
  const todayMs = utc(today);

  const register = DEMO_STUDENTS.map((s) => ({
    student: s,
    status: DEMO_ATTENDANCE[s.id][0].status,
  }));
  const tally = (s: AttendanceStatus) =>
    register.filter((r) => r.status === s).length;
  const inToday = tally("present") + tally("late");
  // Everyone the teacher may need to do something about; present needs nothing.
  const exceptions = register.filter((r) => r.status !== "present");

  const review = DEMO_ASSIGNMENTS.filter((a) => a.status === "needs_review");
  const active = DEMO_ASSIGNMENTS.filter((a) => a.status !== "completed");
  const dueThisWeek = active.filter(
    (a) =>
      a.due_date &&
      utc(a.due_date) >= todayMs &&
      utc(a.due_date) - todayMs <= 7 * DAY_MS
  ).length;

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

  const stats = [
    {
      value: DEMO_STUDENTS.length,
      label: "Students",
      sub: halaqas
        .map(
          (h) =>
            `${DEMO_STUDENTS.filter((s) => s.halaqa === h).length} in ${h.replace("Halaqa ", "")}`
        )
        .join(" · "),
    },
    {
      value: active.length,
      label: "Active work",
      sub: dueThisWeek > 0 ? `${dueThisWeek} due this week` : "nothing due this week",
    },
    {
      value: review.length,
      label: "To review",
      sub: reviewDue ? `oldest due ${formatDay(reviewDue)}` : "all clear",
    },
    {
      value: `${avgAttendance}%`,
      label: "Attendance",
      sub: `${inToday} of ${DEMO_STUDENTS.length} in today`,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4 pt-2">
      {/* Greeting — carries the day's actual state and the two things a
          teacher opens this page to do, rather than standing empty. */}
      <header className="gradient-navy rounded-[18px] px-7 py-6 relative overflow-hidden">
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow text-white/45">Asalaamu alaykum</p>
            <h1 className="page-title text-white text-3xl mt-1.5">
              {demoUser?.name ?? "Teacher"}
            </h1>
            <p className="text-[13px] text-white/55 mt-2.5">
              {formatDay(today)}
              <span className="text-white/25 mx-2">·</span>
              {inToday} of {DEMO_STUDENTS.length} in today
              <span className="text-white/25 mx-2">·</span>
              {review.length} to review
            </p>
          </div>
          <div className="flex gap-2.5 flex-shrink-0">
            <Link
              href="/teacher/attendance"
              className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-4 py-2.5 text-[13px] font-semibold text-[#20180a] hover:brightness-105 active:scale-[.98] transition"
            >
              {IconRegister}
              Register
            </Link>
            <Link
              href="/teacher/quran-assignments"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2.5 text-[13px] font-semibold text-white/85 hover:bg-white/10 active:scale-[.98] transition"
            >
              {IconPen}
              Assign
            </Link>
          </div>
        </div>
      </header>

      {/* At a glance — each number carries the context that makes it mean
          something, instead of standing on its own. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="card-quiet px-4 py-4">
            <p className="text-[26px] font-bold text-ink tabular-nums leading-none">
              {s.value}
            </p>
            <p className="eyebrow mt-2 whitespace-nowrap">{s.label}</p>
            <p className="text-[11px] text-ink-muted mt-1.5 leading-snug">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3 items-start">
        {/* Today's register — the outcome and the exceptions, so the teacher
            can see who needs chasing without opening the page. */}
        <section className="card-quiet p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="page-title text-lg">Today&apos;s register</h2>
            <span className="eyebrow flex-shrink-0">{formatDay(today)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
            {(["present", "late", "absent", "excused"] as AttendanceStatus[])
              .filter((s) => tally(s) > 0)
              .map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5 text-[12px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} />
                  <span className="tabular-nums font-semibold text-ink">{tally(s)}</span>
                  <span className="text-ink-muted">{s}</span>
                </span>
              ))}
          </div>

          <div className="gold-rule my-4" />

          {exceptions.length === 0 ? (
            <p className="text-[13px] text-ink-muted py-2">
              Everyone was present today.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {exceptions.map(({ student, status }) => (
                <li key={student.id} className="flex items-center gap-3">
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
              {IconArrow}
            </span>
          </Link>
        </section>

        {/* The review queue itself, not a link to where it lives. */}
        <section className="card-quiet p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="page-title text-lg">Needs review</h2>
            <span className="eyebrow flex-shrink-0 tabular-nums">
              {review.length} waiting
            </span>
          </div>

          <div className="gold-rule my-4" />

          {review.length === 0 ? (
            <p className="text-[13px] text-ink-muted py-2">
              Nothing waiting on you.
            </p>
          ) : (
            <ul className="space-y-3.5">
              {review.map((a) => {
                const surah = getSurahById(a.surah);
                const student = DEMO_STUDENTS.find((s) => s.id === a.student_id);
                return (
                  <li key={a.id} className="flex gap-3">
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
              {IconArrow}
            </span>
          </Link>
        </section>
      </div>

      {/* The Mushaf has no state to summarise, so it stays a link — but a
          quiet one, rather than a card the size of the work above it. */}
      <Link
        href="/teacher/mushaf"
        className="card-quiet card-feature group flex items-center gap-3.5 px-5 py-4 transition-all hover:-translate-y-0.5 hover:shadow-lg"
      >
        <span className="icon-tile flex-shrink-0">{IconBook}</span>
        <span className="flex-1 min-w-0">
          <span className="block page-title text-[15px]">Mushaf</span>
          <span className="block text-[12px] text-ink-muted">
            Read the Madinah Mushaf, and play any ayah, page or surah aloud.
          </span>
        </span>
        <span className="text-ink-muted group-hover:translate-x-0.5 group-hover:text-ink transition-all flex-shrink-0">
          {IconArrow}
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
    </div>
  );
}
