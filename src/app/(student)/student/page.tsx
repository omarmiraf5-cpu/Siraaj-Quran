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
import { computeXp, levelFor, levelMessage } from "@/lib/progress";
import { SectionCard, AttendanceStrip, EmptyNote, TeacherNote } from "@/components/portal-ui";
import {
  Avatar,
  StreakPill,
  LevelBar,
  UpNextCard,
  SurahGridTile,
  SectionLabel,
  BigTile,
  XpTile,
  ProgressRing,
  ILLUM_CLASS,
  STATUS_COLOUR,
  surahColour,
} from "@/components/student-ui";
import {
  IconBook,
  IconPalette,
  IconArrow,
  IconCheck,
  IconStar,
  IconTarget,
  IconBookOpen,
} from "@/components/icons";

export default function StudentDashboard() {
  const demoUser = useDemoUser();
  const theme = useStudentTheme();

  const student = DEMO_CURRENT_STUDENT;
  const attendance = DEMO_ATTENDANCE[student.id] ?? [];
  const summary = summariseAttendance(attendance);
  const assignments = demoAssignmentsFor(student.id);

  const open = assignments.filter((a) => a.status !== "completed");
  const done = assignments.filter((a) => a.status === "completed");

  // Days attended in a row, counting back from the most recent.
  let streak = 0;
  for (const d of attendance) {
    if (d.status === "absent") break;
    streak++;
  }

  const xp = computeXp(assignments, attendance);
  const level = levelFor(xp.total);

  // What to do next: the soonest unfinished thing.
  const nextUp = [...open].sort((a, b) =>
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")
  )[0];
  const nextSurah = nextUp ? getSurahById(nextUp.surah) : null;
  const nextDue = nextUp ? dueLabel(nextUp.due_date) : null;

  const displayName = demoUser?.name ?? student.name;
  const firstName = displayName.split(" ")[0];

  return (
    <div className="px-4 pt-4 pb-4 space-y-5">
      {/* Hero — who you are, what you have earned, and how far to the next
          level, in the order a child reads it. */}
      <header
        className={`${theme.hero} rounded-[22px] px-5 py-5 relative overflow-hidden animate-rise`}
      >
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />

        <div className="relative flex items-center gap-3.5">
          <Avatar name={displayName} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-white/55">Asalaamu alaykum</p>
            <h1 className="page-title text-white text-[26px] leading-tight truncate">
              {firstName}
            </h1>
          </div>
          <StreakPill days={streak} />
        </div>

        <div className="relative mt-4">
          <LevelBar
            level={level.level}
            into={level.into}
            span={level.span}
            percent={level.percent}
            message={levelMessage(level)}
          />
        </div>
      </header>

      {/* Dua — the calm beat between the scoreboard and the work. */}
      <section
        className="card-quiet card-feature px-5 py-6 text-center animate-rise"
        style={{ animationDelay: "60ms" }}
      >
        <p
          className="font-calligraphy text-[25px] md:text-[30px] text-ink leading-[2.1]"
          dir="rtl"
          lang="ar"
        >
          اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا
        </p>
        <div className="gold-rule w-20 mx-auto my-4" />
        <p className="font-serif text-[14px] text-ink-body italic">
          &ldquo;O Allah, nothing is easy except what You make easy.&rdquo;
        </p>
      </section>

      {/* Up next */}
      <div className="space-y-2.5 animate-rise" style={{ animationDelay: "120ms" }}>
        <SectionLabel colour="vermilion" icon={<IconTarget size={13} />}>
          Up next
        </SectionLabel>

        {nextUp && nextSurah ? (
          <UpNextCard
            colour={surahColour(nextUp.surah)}
            eyebrow={ASSIGNMENT_LABELS[nextUp.status]}
            title={nextSurah.englishName}
            detail={`Ayahs ${nextUp.ayah_start}–${nextUp.ayah_end}${
              nextDue ? ` · ${nextDue.text}` : ""
            }`}
            href="/student/assignments"
            level={nextUp.memorization_level}
          />
        ) : (
          <div className="card-quiet p-5">
            <EmptyNote>Everything is finished. Beautiful work.</EmptyNote>
          </div>
        )}

        {nextUp?.teacher_notes && (
          <div className="card-quiet px-5 py-4">
            <TeacherNote>{nextUp.teacher_notes}</TeacherNote>
          </div>
        )}
      </div>

      {/* My surahs — the bright grid. */}
      {assignments.length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel colour="lapis" icon={<IconBookOpen size={13} />}>
            My surahs
          </SectionLabel>

          <div className="grid grid-cols-3 gap-2.5">
            {assignments.map((a, i) => {
              const surah = getSurahById(a.surah);
              return (
                <SurahGridTile
                  key={a.id}
                  colour={surahColour(a.surah)}
                  name={surah ? surah.englishName : `Surah ${a.surah}`}
                  detail={`${a.memorization_level}% learnt`}
                  level={a.memorization_level}
                  href="/student/assignments"
                  delay={180 + i * 70}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* How the points were earned. A total nobody can explain is not a
          reward, so the breakdown is on the page. */}
      <div className="space-y-2.5 animate-rise" style={{ animationDelay: "300ms" }}>
        <SectionLabel colour="saffron" icon={<IconStar size={13} />}>
          Your points
        </SectionLabel>

        <div className="grid grid-cols-3 gap-2.5">
          <XpTile
            colour="saffron"
            icon={<IconBookOpen size={15} />}
            value={xp.memorising}
            label="Memorising"
            delay={300}
          />
          <XpTile
            colour="verdigris"
            icon={<IconCheck size={15} />}
            value={xp.finishing}
            label="Finishing"
            delay={340}
          />
          <XpTile
            colour="turquoise"
            icon={<IconStar size={15} />}
            value={xp.attending}
            label="Turning up"
            delay={380}
          />
        </div>
      </div>

      {/* Register — a ring and a full-height strip, rather than the hairline
          it was. Kept as a white card so the run of colour above it has
          somewhere to land. */}
      <div className="space-y-2.5 animate-rise" style={{ animationDelay: "360ms" }}>
        <SectionCard title="Your register" note={`last ${Math.min(14, attendance.length)} days`}>
          <div className="flex items-center gap-4">
            <ProgressRing value={summary.rate} colour="turquoise" size={64} label="here" />
            <div className="min-w-0 flex-1">
              <AttendanceStrip days={attendance} size="lg" />
              <p className="text-[12px] text-ink-muted mt-2.5">
                {streak > 1
                  ? `${streak} days in a row — that is ${streak * 25} XP.`
                  : "Every day you show up is 25 XP."}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-ink-muted mt-4 pt-3 border-t border-surface-border">
            {formatDay(DEMO_TODAY)}
            <span className="mx-1.5">·</span>
            {done.length} finished
            <span className="mx-1.5">·</span>
            {open.length} to go
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
          delay={420}
        />
        <BigTile
          href="/student/tajweed"
          colour="aubergine"
          icon={<IconPalette size={20} />}
          title="Tajweed"
          sub="The colours and what each one means."
          delay={480}
        />
      </div>

      <Link
        href="/student/assignments"
        className="group flex items-center justify-center gap-1.5 text-[12px] font-bold text-ink-muted hover:text-ink transition-colors py-1"
      >
        See all my work
        <span className="group-hover:translate-x-0.5 transition-transform">
          <IconArrow size={14} />
        </span>
      </Link>
    </div>
  );
}
