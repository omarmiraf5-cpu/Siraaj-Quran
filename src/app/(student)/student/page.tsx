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
} from "@/data/demo";
import { getSurahById } from "@/data/mushaf-index";
import { SectionCard, AttendanceStrip, EmptyNote, TeacherNote } from "@/components/portal-ui";
import {
  ProgressRing,
  StreakBadge,
  BigTile,
  ILLUM_CLASS,
  STATUS_COLOUR,
  surahColour,
} from "@/components/student-ui";
import { IconBook, IconPalette, IconArrow, IconCheck, IconStar } from "@/components/icons";

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
  const nextColour = nextUp ? surahColour(nextUp.surah) : "verdigris";

  const firstName = (demoUser?.name ?? student.name).split(" ")[0];

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      {/* Hero — the greeting, the reward, and the ring that says how far along
          you are, all in one place. */}
      <header
        className={`${theme.hero} rounded-[22px] px-6 py-6 relative overflow-hidden animate-rise`}
      >
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative flex items-center gap-5">
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-white/45">Asalaamu alaykum</p>
            <h1 className="page-title text-white text-[30px] mt-1 leading-tight">{firstName}</h1>
            <p className="text-[13px] text-white/55 mt-1.5">
              {formatDay(DEMO_TODAY)}
              <span className="text-white/25 mx-1.5">·</span>
              {open.length === 1 ? "1 thing to do" : `${open.length} things to do`}
            </p>
            {streak > 1 && (
              <div className="mt-3.5">
                <StreakBadge days={streak} />
              </div>
            )}
          </div>

          {/* The headline number, as a ring rather than another percentage in
              a row of percentages. */}
          <div className="flex-shrink-0 rounded-full bg-white/10 p-2 backdrop-blur-sm">
            <div className="rounded-full bg-surface-card p-1.5">
              <ProgressRing value={memorisation} colour="saffron" size={76} label="learnt" />
            </div>
          </div>
        </div>
      </header>

      {/* Three counts, each with its own colour so the row is something to
          look at rather than three grey boxes. */}
      <div className="grid grid-cols-3 gap-3">
        <CountTile
          colour="verdigris"
          icon={<IconCheck size={16} />}
          value={done.length}
          label="Finished"
          delay={60}
        />
        <CountTile
          colour="lapis"
          icon={<IconBook size={16} />}
          value={open.length}
          label="To do"
          delay={120}
        />
        <CountTile
          colour="turquoise"
          icon={<IconStar size={16} />}
          value={`${summary.rate}%`}
          label="Here"
          delay={180}
        />
      </div>

      {/* Next up — one clear thing, given the whole card. */}
      {nextUp ? (
        <section
          className="card-quiet card-feature p-5 animate-rise"
          style={{ animationDelay: "240ms" }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="page-title text-lg">Next up</h2>
            {nextDue && (
              <span
                className={`text-[11px] font-bold uppercase tracking-wider flex-shrink-0 ${
                  nextDue.urgent ? "text-illum-vermilion" : "text-ink-muted"
                }`}
              >
                {nextDue.text}
              </span>
            )}
          </div>

          <div className="gold-rule my-4" />

          <div className="flex items-center gap-4">
            <ProgressRing value={nextUp.memorization_level} colour={nextColour} size={72} />
            <div className="min-w-0 flex-1">
              <h3 className="page-title text-[19px] truncate">
                {nextSurah ? nextSurah.englishName : `Surah ${nextUp.surah}`}
              </h3>
              <p className="text-[12px] text-ink-muted mt-0.5">
                Ayahs {nextUp.ayah_start}–{nextUp.ayah_end}
                {nextSurah ? ` · page ${nextSurah.startPage}` : ""}
              </p>
              <span
                className={`${ILLUM_CLASS[STATUS_COLOUR[nextUp.status]]} inline-flex mt-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide`}
              >
                {ASSIGNMENT_LABELS[nextUp.status]}
              </span>
            </div>
          </div>

          {nextUp.teacher_notes && <TeacherNote>{nextUp.teacher_notes}</TeacherNote>}

          <Link
            href="/student/assignments"
            className="group mt-4 inline-flex items-center gap-1.5 text-[12px] font-bold text-ink-muted hover:text-ink transition-colors"
          >
            See all my work
            <span className="group-hover:translate-x-0.5 transition-transform">
              <IconArrow size={14} />
            </span>
          </Link>
        </section>
      ) : (
        <SectionCard title="Next up">
          <EmptyNote>Everything is finished. Beautiful work.</EmptyNote>
        </SectionCard>
      )}

      {/* Attendance, kept encouraging rather than administrative. */}
      <div className="animate-rise" style={{ animationDelay: "300ms" }}>
        <SectionCard title="Your register" note={`${summary.rate}%`}>
          <AttendanceStrip days={attendance} />
          <p className="text-[12px] text-ink-muted mt-3">
            {streak > 1
              ? `You have been in ${streak} days in a row. Keep it going.`
              : "Every day you show up counts."}
          </p>
        </SectionCard>
      </div>

      {/* Where else to go. */}
      <div className="grid grid-cols-2 gap-3">
        <BigTile
          href="/student/quran"
          colour="lapis"
          icon={<IconBook size={20} />}
          title="My Quran"
          sub="Read your ayahs and listen along."
          delay={360}
        />
        <BigTile
          href="/student/tajweed"
          colour="aubergine"
          icon={<IconPalette size={20} />}
          title="Tajweed"
          sub="The colours and what each one means."
          delay={420}
        />
      </div>

      <section
        className="card-quiet px-6 py-8 text-center animate-rise"
        style={{ animationDelay: "480ms" }}
      >
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

/* A count with its own colour and icon. */
function CountTile({
  colour,
  icon,
  value,
  label,
  delay,
}: {
  colour: keyof typeof ILLUM_CLASS;
  icon: React.ReactNode;
  value: string | number;
  label: string;
  delay: number;
}) {
  return (
    <div className="card-quiet px-3 py-4 animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <span className={`${ILLUM_CLASS[colour]} w-8 h-8 rounded-xl mb-2.5`}>{icon}</span>
      <p className="text-[24px] font-bold text-ink tabular-nums leading-none">{value}</p>
      <p className="eyebrow mt-1.5">{label}</p>
    </div>
  );
}
