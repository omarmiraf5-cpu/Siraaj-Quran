"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDemoUser } from "@/hooks/useDemoUser";
import { useStudentTheme } from "@/hooks/useStudentTheme";
import {
  DEMO_CURRENT_STUDENT,
  DEMO_TODAY,
  summariseAttendance,
  formatDay,
} from "@/data/demo";
import type { HifzPortion, QuranicAssignment } from "@/hooks/useQuranicAssignments";
import type { IllumColour } from "@/components/student-ui";

// Held steady with the assignments page, so a child learns the three by
// colour before they learn them by name.
const PORTION_COLOUR: Record<HifzPortion, IllumColour> = {
  new: "saffron",
  recent: "turquoise",
  old: "aubergine",
};
import { getSurahById } from "@/data/mushaf-index";
import { computeXp, levelFor, levelMessage } from "@/lib/progress";
import { usePortalRoster, useStudentRecord } from "@/hooks/usePortalRoster";
import { useQaidahLessons } from "@/hooks/useQaidahLessons";
import { currentLessons } from "@/lib/qaidahLessons";
import { MyQaidahLesson } from "@/components/QaidahLessonCard";
import { SectionCard, AttendanceStrip, TeacherNote } from "@/components/portal-ui";
import { AnnouncementsFeed } from "@/components/AnnouncementsFeed";
import { AchievementsCard } from "@/components/AchievementsCard";
import { StudentAccountButtons } from "@/components/StudentAccountButtons";
import {
  Avatar,
  StreakPill,
  LevelBar,
  UpNextCard,
  SectionLabel,
  BigTile,
  XpTile,
  ProgressRing,
  FriendlyEmpty,
  ILLUM_CLASS,
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
import { useLanguage } from "@/components/LanguageProvider";
import { countLabel } from "@/lib/i18n/phrases";
import { ByLanguage } from "@/components/ByLanguage";

export default function StudentDashboard() {
  const { t, language, tr } = useLanguage();
  const demoUser = useDemoUser();
  const theme = useStudentTheme();

  // RLS gives a signed-in student exactly one row — their own — so the
  // roster is a list of one. In demo mode it's the sample student.
  const { mode, students } = usePortalRoster([DEMO_CURRENT_STUDENT]);
  const student = students[0] ?? DEMO_CURRENT_STUDENT;
  const { attendance, assignments } = useStudentRecord(
    students[0]?.id ?? null,
    mode
  );
  const summary = summariseAttendance(attendance);
  // Their Qa'idah lesson, where the teacher has set one.
  const { rows: qaidahRows } = useQaidahLessons(mode, students[0] ? [students[0].id] : []);
  const myQaidah = students[0] ? (currentLessons(qaidahRows).get(students[0].id) ?? null) : null;

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

  // Today's lesson and anything overdue come first; what falls due on a later
  // day, or was set earlier with no date, is homework.
  const todayStr = mode === "demo" ? DEMO_TODAY : new Date().toLocaleDateString("en-CA");
  const dayOf = (a: QuranicAssignment) => (a.assigned_at ?? "").slice(0, 10);
  const isToday = (a: QuranicAssignment) =>
    a.due_date ? a.due_date <= todayStr : dayOf(a) === todayStr;
  const portionRank = { new: 0, recent: 1, old: 2 } as const;
  const todayWork = open
    .filter(isToday)
    .sort((a, b) => (a.due_date ?? todayStr).localeCompare(b.due_date ?? todayStr) || portionRank[a.portion] - portionRank[b.portion]);
  const homework = open
    .filter((a) => !isToday(a))
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  // Counted from the real day, not the sample portal's fixed one.
  const dueText = (iso: string | null): { text: string; urgent: boolean } | null => {
    if (!iso) return null;
    const days = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${todayStr}T00:00:00Z`)) / 864e5);
    if (days <= 0) return { text: tr("Due today"), urgent: true };
    if (days === 1) return { text: tr("Due tomorrow"), urgent: true };
    return { text: tr("Due in {count} days", { count: days }), urgent: days <= 3 };
  };
  const workTitle = (a: QuranicAssignment) => {
    const from = getSurahById(a.surah);
    const to = a.surah_end !== a.surah ? getSurahById(a.surah_end) : null;
    const name = from?.englishName ?? `Surah ${a.surah}`;
    return to ? `${name} – ${to.englishName}` : name;
  };

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
          <Link href="/account" aria-label={tr("My account")} className="rounded-full active:scale-95 transition-transform">
            <Avatar name={displayName} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-white/55">{t("common.asalaamuAlaykum")}</p>
            <h1 className="page-title text-white text-[26px] leading-tight [overflow-wrap:anywhere]">
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

        <StudentAccountButtons />
      </header>

      {/* Today — the lesson and anything overdue, one big card each, so the
          first thing a child sees is what to do now. */}
      <div className="space-y-2.5 animate-rise" style={{ animationDelay: "100ms" }}>
        <SectionLabel colour="vermilion" icon={<IconTarget size={13} />}>
          {tr("Today")}
        </SectionLabel>
        {todayWork.length === 0 && !myQaidah ? (
          <div className="card-quiet p-5">
            <FriendlyEmpty title={t("common.allDoneToday")} sub={t("common.beautifulWorkComeBack")} mood="happy" />
          </div>
        ) : (
          <div className="space-y-2.5">
            {todayWork.map((a) => {
              const overdue = Boolean(a.due_date && a.due_date < todayStr);
              return (
                <UpNextCard
                  key={a.id}
                  colour={overdue ? "vermilion" : PORTION_COLOUR[a.portion]}
                  eyebrow={`${t(`portion.${a.portion}`)} · ${overdue ? tr("Overdue") : tr("Today's lesson")}`}
                  title={workTitle(a)}
                  detail={`${t("common.ayahs")} ${a.ayah_start}–${a.ayah_end}`}
                  href="/student/assignments"
                  level={a.memorization_level}
                />
              );
            })}
            {myQaidah && <MyQaidahLesson row={myQaidah} href="/student/qaidah" />}
          </div>
        )}
        {todayWork.find((a) => a.teacher_notes)?.teacher_notes && (
          <div className="card-quiet px-5 py-4">
            <TeacherNote>{todayWork.find((a) => a.teacher_notes)!.teacher_notes}</TeacherNote>
          </div>
        )}
      </div>

      {/* Homework — what is due on a later day, in the order it falls due. */}
      {homework.length > 0 && (
        <div className="space-y-2.5 animate-rise" style={{ animationDelay: "140ms" }}>
          <SectionLabel colour="lapis" icon={<IconBookOpen size={13} />}>
            {tr("Homework")}
          </SectionLabel>
          <div className="card-quiet divide-y divide-surface-border overflow-hidden">
            {homework.slice(0, 4).map((a) => {
              const due = dueText(a.due_date);
              return (
                <Link key={a.id} href="/student/assignments" className="flex items-center gap-3 px-4 py-3 active:bg-surface-bg transition-colors">
                  <span className={`${ILLUM_CLASS[PORTION_COLOUR[a.portion]]} flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl`}>
                    <IconBookOpen size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">{workTitle(a)}</span>
                    <span className="block text-[12px] text-ink-muted">
                      {t(`portion.${a.portion}`)} · {t("common.ayahs")} {a.ayah_start}–{a.ayah_end}
                    </span>
                  </span>
                  {due && (
                    <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${due.urgent ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" : "bg-surface-bg text-ink-muted"}`}>
                      {due.text}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          {homework.length > 4 && (
            <Link href="/student/assignments" className="block text-center text-[12px] font-bold text-ink-muted">
              {tr("{count} more", { count: homework.length - 4 })}
            </Link>
          )}
        </div>
      )}

      {/* Where to go — four big buttons, one thumb each. */}
      <div className="grid grid-cols-2 gap-3 animate-rise" style={{ animationDelay: "180ms" }}>
        <BigTile href="/student/quran" colour="lapis" icon={<IconBook size={20} />} title={t("common.myQuran")} sub={t("common.readYourAyahs")} delay={200} />
        <BigTile href="/student/assignments" colour="verdigris" icon={<IconBookOpen size={20} />} title={t("nav.work")} sub={tr("All my work")} delay={230} />
        <BigTile href="/student/learn" colour="aubergine" icon={<IconPalette size={20} />} title={t("nav.learn")} sub={t("common.tajweedBlurb")} delay={260} />
        <BigTile href="/student/attendance" colour="turquoise" icon={<IconCheck size={20} />} title={t("nav.register")} sub={tr("Am I here?")} delay={290} />
      </div>

      {/* How the points were earned. A total nobody can explain is not a
          reward, so the breakdown is on the page. */}
      <div className="space-y-2.5 animate-rise" style={{ animationDelay: "300ms" }}>
        <SectionLabel colour="saffron" icon={<IconStar size={13} />}>
          {t("common.yourPoints")}
        </SectionLabel>

        <div className="grid grid-cols-3 gap-2.5">
          <XpTile
            colour="saffron"
            icon={<IconBookOpen size={15} />}
            value={xp.memorising}
            label={t("common.memorising")}
            delay={300}
          />
          <XpTile
            colour="verdigris"
            icon={<IconCheck size={15} />}
            value={xp.finishing}
            label={t("common.finishing")}
            delay={340}
          />
          <XpTile
            colour="turquoise"
            icon={<IconStar size={15} />}
            value={xp.attending}
            label={t("common.turningUp")}
            delay={380}
          />
        </div>
      </div>

      {/* Register — a ring and a full-height strip, rather than the hairline
          it was. Kept as a white card so the run of colour above it has
          somewhere to land. */}
      <div className="space-y-2.5 animate-rise" style={{ animationDelay: "360ms" }}>
        <SectionCard
          title={t("common.yourRegister")}
          note={countLabel(
            "the last {count} day|the last {count} days",
            Math.min(14, attendance.length),
            [t("common.last"), Math.min(14, attendance.length), t("common.days")].filter((x) => x !== "").join(" "),
          )}
        >
          <div className="flex items-center gap-4">
            <ProgressRing value={summary.rate} colour="turquoise" size={64} label={t("common.here")} />
            <div className="min-w-0 flex-1">
              <AttendanceStrip days={attendance} size="lg" />
              <p className="text-[12px] text-ink-muted mt-2.5">
                {streak > 1
                  ? `${countLabel("{count} day in a row — that's|{count} days in a row — that's", streak, `${streak} ${t("common.daysInARowThatIs")}`)} ${streak * 25} XP.`
                  : t("common.everyDayShowUp")}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-ink-muted mt-4 pt-3 border-t border-surface-border">
            {formatDay(mode === "demo" ? DEMO_TODAY : new Date().toLocaleDateString("en-CA"), language)}
            <span className="mx-1.5">·</span>
            {countLabel("{count} finished|{count} finished", done.length, `${done.length} ${t("common.finished").toLowerCase()}`)}
            <span className="mx-1.5">·</span>
            {countLabel("{count} to go", open.length, `${open.length} ${t("common.toGo")}`)}
          </p>
        </SectionCard>
      </div>

      <AchievementsCard studentId={student.id} />

      <AnnouncementsFeed audience="students" />

      <Link
        href="/student/assignments"
        className="group flex items-center justify-center gap-1.5 text-[12px] font-bold text-ink-muted hover:text-ink transition-colors py-1"
      >
        {t("common.seeAllMyWork")}
        <span className="group-hover:translate-x-0.5 transition-transform">
          <IconArrow size={14} />
        </span>
      </Link>

      {/* Dua — the calm beat between the scoreboard and the work. Coloured
          with the page's own hero gradient rather than one of the six
          portion/status colours: every one of those already means something
          specific elsewhere on this page (new lesson, finishing, needs
          review…), and the dua is not any of them. The personal gradient
          has no such job, so it bookends the page instead — greeting and
          reflection in the same hue, the work between them in the palette. */}
      <section
        className={`${theme.hero} relative overflow-hidden rounded-[20px] px-5 py-6 text-center animate-rise`}
        style={{ animationDelay: "60ms" }}
      >
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <p
          className="relative font-calligraphy text-[25px] md:text-[30px] text-white leading-[2.1]"
          dir="rtl"
          lang="ar"
        >
          اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا
        </p>
        <div className="gold-rule w-20 mx-auto my-4 relative" />
        {/* The English meaning, for readers of the Arabic above who need it. */}
        <ByLanguage
          en={
            <p className="relative font-serif text-[14px] text-white/80 italic" dir="ltr">
              “O Allah, nothing is easy except what You make easy.”
            </p>
          }
          ar={null}
        />
      </section>

      <Link
        href="/account"
        className="block text-center text-[11.5px] font-semibold text-ink-muted hover:text-ink transition-colors pb-2"
      >
        {t("nav.account")} · {t("common.privacy")}
      </Link>
    </div>
  );
}
