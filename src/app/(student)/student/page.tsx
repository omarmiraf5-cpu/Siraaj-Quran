"use client";

import Link from "next/link";
import { useDemoUser } from "@/hooks/useDemoUser";
import { useStudentTheme } from "@/hooks/useStudentTheme";
import {
  DEMO_CURRENT_STUDENT,
  DEMO_ATTENDANCE,
  DEMO_TODAY,
  demoAssignmentsFor,
  summariseAttendance,
  formatDay,
  dueLabel,
  ASSIGNMENT_LABELS,
  ASSIGNMENT_STYLES,
} from "@/data/demo";
import { getSurahById } from "@/data/mushaf-index";
import {
  SectionCard,
  StatTile,
  ProgressBar,
  AttendanceStrip,
  EmptyNote,
  TeacherNote,
} from "@/components/portal-ui";
import { IconBook, IconPalette, IconArrow, IconFlame } from "@/components/icons";

export default function StudentDashboard() {
  const demoUser = useDemoUser();
  const theme = useStudentTheme();

  const student = DEMO_CURRENT_STUDENT;
  const attendance = DEMO_ATTENDANCE[student.id] ?? [];
  const summary = summariseAttendance(attendance);
  const assignments = demoAssignmentsFor(student.id);

  const open = assignments.filter((a) => a.status !== "completed");
  const done = assignments.filter((a) => a.status === "completed");
  const memorisation = assignments.length
    ? Math.round(
        assignments.reduce((sum, a) => sum + a.memorization_level, 0) / assignments.length
      )
    : 0;

  // Days attended in a row, counting back from the most recent.
  let streak = 0;
  for (const d of attendance) {
    if (d.status === "absent") break;
    streak++;
  }

  // What to do next: the soonest unfinished thing.
  const nextUp = [...open].sort((a, b) =>
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")
  )[0];
  const nextSurah = nextUp ? getSurahById(nextUp.surah) : null;
  const nextDue = nextUp ? dueLabel(nextUp.due_date) : null;

  const firstName = (demoUser?.name ?? student.name).split(" ")[0];

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      {/* Hero — the greeting carries what is actually happening today. */}
      <header className={`${theme.hero} rounded-[18px] px-6 py-6 relative overflow-hidden`}>
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative">
          <p className="eyebrow text-white/45">Asalaamu alaykum</p>
          <h1 className="page-title text-white text-3xl mt-1.5">{firstName}</h1>
          <p className="text-[13px] text-white/55 mt-2.5">
            {formatDay(DEMO_TODAY)}
            <span className="text-white/25 mx-2">·</span>
            {open.length === 1 ? "1 thing to do" : `${open.length} things to do`}
            {streak > 1 && (
              <>
                <span className="text-white/25 mx-2">·</span>
                <span className="inline-flex items-center gap-1">
                  <IconFlame size={13} />
                  {streak} day streak
                </span>
              </>
            )}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <StatTile value={`${memorisation}%`} label="Memorised" sub={`${assignments.length} surahs`} />
        <StatTile value={done.length} label="Finished" sub={open.length ? `${open.length} to go` : "all done"} />
        <StatTile value={`${summary.rate}%`} label="Attendance" sub={`last ${summary.total} days`} />
      </div>

      {/* Next up — one clear thing to do, rather than a wall of cards. */}
      {nextUp && (
        <SectionCard title="Next up" note={nextDue?.text}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="page-title text-[17px]">
                {nextSurah ? nextSurah.englishName : `Surah ${nextUp.surah}`}
              </p>
              <p className="text-[12px] text-ink-muted mt-0.5">
                Ayahs {nextUp.ayah_start}–{nextUp.ayah_end}
                {nextSurah ? ` · page ${nextSurah.startPage}` : ""}
              </p>
            </div>
            <span
              className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap ${ASSIGNMENT_STYLES[nextUp.status]}`}
            >
              {ASSIGNMENT_LABELS[nextUp.status]}
            </span>
          </div>

          <div className="flex items-center gap-2.5 mt-3">
            <div className="flex-1">
              <ProgressBar value={nextUp.memorization_level} />
            </div>
            <span className="text-[11px] font-semibold text-ink-muted tabular-nums w-8 text-right">
              {nextUp.memorization_level}%
            </span>
          </div>

          {nextUp.teacher_notes && <TeacherNote>{nextUp.teacher_notes}</TeacherNote>}

          <Link
            href="/student/assignments"
            className="group mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            See all my work
            <span className="group-hover:translate-x-0.5 transition-transform">
              <IconArrow size={14} />
            </span>
          </Link>
        </SectionCard>
      )}

      {!nextUp && (
        <SectionCard title="Next up">
          <EmptyNote>Everything is finished. Beautiful work.</EmptyNote>
        </SectionCard>
      )}

      {/* Attendance, kept encouraging rather than administrative. */}
      <SectionCard title="Your register" note={`${summary.rate}%`}>
        <AttendanceStrip days={attendance} />
        <p className="text-[12px] text-ink-muted mt-3">
          {streak > 1
            ? `You have been in ${streak} days in a row. Keep it going.`
            : "Every day you show up counts."}
        </p>
      </SectionCard>

      {/* Where else to go. */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/student/quran"
          className="card-quiet card-feature group px-5 py-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span className="icon-tile mb-3">
            <IconBook size={19} />
          </span>
          <span className="block page-title text-[15px]">My Quran</span>
          <span className="block text-[12px] text-ink-muted mt-0.5">
            Read your ayahs and listen along.
          </span>
        </Link>
        <Link
          href="/student/tajweed"
          className="card-quiet card-feature group px-5 py-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span className="icon-tile mb-3">
            <IconPalette size={19} />
          </span>
          <span className="block page-title text-[15px]">Tajweed</span>
          <span className="block text-[12px] text-ink-muted mt-0.5">
            The colours and what each one means.
          </span>
        </Link>
      </div>

      <section className="card-quiet px-6 py-8 text-center">
        <p className="eyebrow">Dua for learning</p>
        <p
          className="font-calligraphy text-[26px] md:text-[32px] text-ink mt-4 leading-[2.1]"
          dir="rtl"
          lang="ar"
        >
          اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا
        </p>
        <div className="gold-rule w-20 mx-auto my-5" />
        <p className="font-serif text-[15px] text-ink-body italic">
          &ldquo;O Allah, nothing is easy except what You make easy.&rdquo;
        </p>
      </section>
    </div>
  );
}
