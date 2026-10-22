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
import { autoStars } from "@/lib/progress";
import { useTeacherStars } from "@/hooks/useTeacherStars";
import { TIERS, tierFor, nextTier, tierPercent } from "@/data/awards";
import { usePortalRoster, useStudentRecord } from "@/hooks/usePortalRoster";
import { useQaidahLessons } from "@/hooks/useQaidahLessons";
import { currentLessons } from "@/lib/qaidahLessons";
import { MyQaidahLesson } from "@/components/QaidahLessonCard";
import { SectionCard, AttendanceStrip, TeacherNote } from "@/components/portal-ui";
import { AnnouncementsFeed } from "@/components/AnnouncementsFeed";
import { MilestoneBanner } from "@/components/MilestoneBanner";
import { TeacherNotes } from "@/components/TeacherNotes";
import { AchievementsCard } from "@/components/AchievementsCard";
import { StudentAccountButtons } from "@/components/StudentAccountButtons";
import {
  Avatar,
  StreakPill,
  UpNextCard,
  SectionLabel,
  BigTile,
  ProgressRing,
  FriendlyEmpty,
  ILLUM_CLASS,
  GRAD_CLASS,
} from "@/components/student-ui";
import {
  IconBook,
  IconPalette,
  IconPen,
  IconCalendar,
  IconArrow,
  IconCheck,
  IconStar,
  IconTarget,
  IconBookOpen,
} from "@/components/icons";
import { useLanguage } from "@/components/LanguageProvider";
import { countLabel } from "@/lib/i18n/phrases";
import { ByLanguage } from "@/components/ByLanguage";

const DAILY_QUOTES = [
  { en: "Read! In the Name of your Lord, Who has created.", ar: "اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ", ref: "Qur'an 96:1", refAr: "القرآن ٩٦:١" },
  { en: "Indeed, with hardship comes ease.", ar: "إِنَّ مَعَ الْعُسْرِ يُسْرًا", ref: "Qur'an 94:6", refAr: "القرآن ٩٤:٦" },
  { en: "So remember Me; I will remember you.", ar: "فَاذْكُرُونِي أَذْكُرْكُمْ", ref: "Qur'an 2:152", refAr: "القرآن ٢:١٥٢" },
  { en: "The best among you are those with the best character.", ar: "إِنَّ مِنْ خِيَارِكُمْ أَحْسَنَكُمْ أَخْلَاقًا", ref: "Prophet Muhammad ﷺ", refAr: "النبي ﷺ" },
  { en: "Whoever takes a path seeking knowledge, Allah makes easy for him a path to Paradise.", ar: "مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ", ref: "Prophet Muhammad ﷺ", refAr: "النبي ﷺ" },
];

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

  const teacherStars = useTeacherStars(students[0]?.id ?? null);
  const bonusStars = autoStars(assignments);
  const stars = teacherStars + bonusStars;
  const tier = tierFor(stars);
  const upcoming = nextTier(stars);

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

  const upNext = todayWork[0] ?? null;
  const upNextOverdue = Boolean(upNext?.due_date && upNext.due_date < todayStr);
  const levels = assignments.map((a) => a.memorization_level);
  const quranProgress = levels.length > 0 ? levels.reduce((n, v) => n + v, 0) / levels.length : null;
  const subjects = [
    { href: "/student/quran", name: t("nav.quran"), gradient: "student-gradient-teal", icon: <span className="text-3xl" aria-hidden>📖</span>, progress: quranProgress },
    { href: "/student/assignments", name: t("nav.work"), gradient: "student-gradient-blue", icon: <span className="text-3xl" aria-hidden>📝</span>, progress: null as number | null },
    { href: "/student/learn", name: t("nav.learn"), gradient: "student-gradient-indigo", icon: <span className="text-3xl" aria-hidden>🎨</span>, progress: null as number | null },
    { href: "/student/hadith", name: t("nav.hadith"), gradient: "student-gradient-cyan", icon: <span className="text-3xl" aria-hidden>📜</span>, progress: null as number | null },
    { href: "/student/class-work", name: tr("Islamic & Arabic"), gradient: "student-gradient-orange", icon: <span className="text-3xl" aria-hidden>🕌</span>, progress: null as number | null },
    { href: "/student/attendance", name: t("nav.register"), gradient: "student-gradient-green", icon: <span className="text-3xl" aria-hidden>✅</span>, progress: attendance.length > 0 ? summary.rate : null },
  ];
  const dailyQuote = DAILY_QUOTES[new Date(`${todayStr}T00:00:00Z`).getUTCDate() % DAILY_QUOTES.length];

  const displayName = demoUser?.name ?? student.name;
  const firstName = displayName.split(" ")[0];

  return (
    <div className="px-4 pt-4 pb-4 space-y-5">
      {/* Hero — who you are, what you have earned, and how far to the next
          level, in the order a child reads it. */}
      <header className={`${theme.hero} rounded-3xl px-5 py-5 text-white relative overflow-hidden shadow-lg animate-rise`}>
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/account"
              aria-label={tr("My account")}
              className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl font-bold border border-white/25 flex-shrink-0 active:scale-95 transition-transform"
            >
              {displayName.trim().charAt(0).toUpperCase() || "?"}
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-white/75 text-sm">{t("common.asalaamuAlaykum")} 👋</p>
              <p className="font-bold text-xl leading-tight [overflow-wrap:anywhere]">{firstName}!</p>
            </div>
            <span
              className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-2xl px-3.5 py-2 border border-white/25 flex-shrink-0"
              title={tr("{days} days in a row", { days: streak })}
            >
              <span className="text-lg" aria-hidden>🔥</span>
              <span className="text-sm font-bold tabular-nums">{streak}</span>
            </span>
          </div>

          <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/15">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">⭐ {countLabel("{count} star|{count} stars", stars, `${stars} ${t(stars === 1 ? "achievements.star" : "achievements.stars")}`)}</span>
              <span className="text-xs text-white/85">
                {upcoming ? `${upcoming.tier.emoji} ${t(`award.tier.${upcoming.tier.key}`)}` : `${TIERS[TIERS.length - 1].emoji} ${t("award.tier.gold")}`}
              </span>
            </div>
            <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-amber-400 transition-all duration-1000" style={{ width: `${tierPercent(stars)}%` }} />
            </div>
            <p className="text-[11px] text-white/70 mt-2">
              {upcoming
                ? tr("{count} more stars to {tier}.", { count: upcoming.toGo, tier: t(`award.tier.${upcoming.tier.key}`) })
                : tr("Gold reached. Well done!")}
            </p>
          </div>
          <StudentAccountButtons />
        </div>
      </header>

      <MilestoneBanner studentId={student.id} assignments={assignments} />
      <TeacherNotes studentId={student.id} demo={mode === "demo"} />

      {/* Dua — a soft amber card straight under the greeting. */}
      <div className="rounded-3xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-800/40 px-5 py-8 text-center animate-rise" style={{ animationDelay: "60ms" }}>
        <p className="font-calligraphy font-bold text-3xl md:text-4xl text-amber-900 dark:text-amber-100 leading-[2] mb-2" dir="rtl" lang="ar">
          اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا
        </p>
        <ByLanguage
          en={<p className="text-sm md:text-base text-amber-800/90 dark:text-amber-200/80 italic" dir="ltr">&ldquo;O Allah, nothing is easy except what You make easy.&rdquo;</p>}
          ar={null}
        />
      </div>

      {/* Up next — the one thing to do now: a card with a play button. */}
      <div className="animate-rise" style={{ animationDelay: "100ms" }}>
        <h2 className="text-[11px] font-bold text-ink-muted uppercase tracking-[0.12em] mb-3 px-1">🎯 {tr("Up next")}</h2>
        {upNext ? (
          <Link
            href="/student/assignments"
            className="group flex items-center gap-4 bg-surface-card rounded-3xl border border-surface-border shadow-card p-4 hover:shadow-card-hover hover:-translate-y-0.5 active:scale-[0.99] transition-all"
          >
            <div className={`w-16 h-16 rounded-2xl ${GRAD_CLASS[upNextOverdue ? "vermilion" : PORTION_COLOUR[upNext.portion]]} flex items-center justify-center text-white flex-shrink-0 shadow-md`}>
              <span className="text-3xl" aria-hidden>📖</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-ink-muted font-bold tracking-wide uppercase">
                {t(`portion.${upNext.portion}`)} · {upNextOverdue ? tr("Overdue") : tr("Today's lesson")}
              </p>
              <p className="font-bold text-base text-ink leading-snug [overflow-wrap:anywhere]">{workTitle(upNext)}</p>
              <p className="text-xs text-ink-muted mt-0.5">
                {t("common.ayahs")} {upNext.ayah_start}–{upNext.ayah_end} · {upNext.memorization_level}% {t("common.learnt")}
              </p>
            </div>
            <div className={`w-11 h-11 rounded-full ${GRAD_CLASS[upNextOverdue ? "vermilion" : PORTION_COLOUR[upNext.portion]]} flex items-center justify-center text-white flex-shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><polygon points="6 3 20 12 6 21 6 3" /></svg>
            </div>
          </Link>
        ) : !myQaidah ? (
          // Only "all done" when there is no Qa'idah lesson to do either.
          <div className="card-quiet p-5">
            <FriendlyEmpty title={t("common.allDoneToday")} sub={t("common.beautifulWorkComeBack")} mood="happy" />
          </div>
        ) : null}
        {myQaidah && (
          <div className={upNext ? "mt-2.5" : ""}>
            <MyQaidahLesson row={myQaidah} href="/student/qaidah" />
          </div>
        )}
        {upNext?.teacher_notes && (
          <div className="card-quiet px-5 py-4 mt-2.5">
            <TeacherNote>{upNext.teacher_notes}</TeacherNote>
          </div>
        )}
      </div>

      {/* My subjects — one coloured square each, with a ring where there is a figure to show. */}
      <div className="animate-rise" style={{ animationDelay: "140ms" }}>
        <h2 className="text-[11px] font-bold text-ink-muted uppercase tracking-[0.12em] mb-3 px-1">📚 {tr("My subjects")}</h2>
        <div className="grid grid-cols-3 gap-3">
          {subjects.map((sub, i) => {
            const circumference = 2 * Math.PI * 18;
            return (
              <Link
                key={sub.href}
                href={sub.href}
                className="group relative aspect-square overflow-hidden rounded-3xl text-white flex flex-col items-center justify-center gap-1.5 shadow-md hover:-translate-y-1 hover:shadow-lg active:scale-95 transition-all animate-rise"
                style={{ animationDelay: `${180 + i * 50}ms` }}
              >
                <div className={`absolute inset-0 ${sub.gradient}`} />
                <div className="relative w-14 h-14 flex items-center justify-center">
                  {sub.progress !== null && (
                    <svg className="absolute inset-0 -rotate-90 w-full h-full" viewBox="0 0 40 40" aria-hidden>
                      <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                      <circle
                        cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="3" strokeLinecap="round"
                        strokeDasharray={circumference} strokeDashoffset={circumference - (Math.max(0, Math.min(100, sub.progress)) / 100) * circumference}
                      />
                    </svg>
                  )}
                  <span className="relative">{sub.icon}</span>
                </div>
                <div className="relative text-center leading-tight px-1">
                  <p className="text-xs font-bold [overflow-wrap:anywhere]">{sub.name}</p>
                  {sub.progress !== null && <p className="text-[10px] text-white/80 tabular-nums">{Math.round(sub.progress)}%</p>}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Homework and Today. */}
      <div className="grid grid-cols-2 gap-3 animate-rise" style={{ animationDelay: "260ms" }}>
        <Link href="/student/assignments" className="bg-surface-card rounded-3xl border border-surface-border shadow-card p-4 hover:shadow-card-hover hover:-translate-y-0.5 active:scale-[0.98] transition-all">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg" aria-hidden>✅</span>
            <span className="text-[11px] font-bold text-ink-muted tracking-wide uppercase">{tr("Homework")}</span>
          </div>
          <p className="text-3xl font-black text-ink leading-none tabular-nums"><bdi dir="ltr">{homework.length}</bdi></p>
          <p className="text-xs text-ink-muted mt-1.5">{tr("Still to do")}</p>
        </Link>
        <Link href="/student/assignments" className="bg-surface-card rounded-3xl border border-surface-border shadow-card p-4 hover:shadow-card-hover hover:-translate-y-0.5 active:scale-[0.98] transition-all">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg" aria-hidden>📅</span>
            <span className="text-[11px] font-bold text-ink-muted tracking-wide uppercase">{tr("Today")}</span>
          </div>
          <p className="text-3xl font-black text-ink leading-none tabular-nums"><bdi dir="ltr">{todayWork.length}</bdi></p>
          <p className="text-xs text-ink-muted mt-1.5">{tr("Lessons today")}</p>
        </Link>
      </div>

      {/* My badges — four figures, tap-friendly cards. */}
      <div className="animate-rise" style={{ animationDelay: "300ms" }}>
        <h2 className="text-[11px] font-bold text-ink-muted uppercase tracking-[0.12em] mb-3 px-1">🏅 {tr("My badges")}</h2>
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: "🔥", label: streak > 0 ? tr("{days} days in a row", { days: streak }) : tr("Start a streak") },
            { icon: "⭐", label: countLabel("{count} star|{count} stars", stars, `${stars} ${t(stars === 1 ? "achievements.star" : "achievements.stars")}`) },
            { icon: "📚", label: tr("{count} finished", { count: done.length }) },
            { icon: tier ? tier.emoji : "🏆", label: tier ? t(`award.tier.${tier.key}`) : tr("First badge: {count} stars", { count: TIERS[0].stars }) },
          ].map((b) => (
            <div key={b.icon} className="flex flex-col items-center justify-center gap-1.5 py-4 px-2 rounded-3xl bg-surface-card border border-surface-border shadow-card">
              <span className="text-4xl" aria-hidden>{b.icon}</span>
              <span className="text-[10px] text-ink-muted text-center leading-tight font-semibold">{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      <AchievementsCard studentId={student.id} bonusStars={bonusStars} />

      <AnnouncementsFeed audience="students" />

      {/* Reminder of the day. */}
      <div className="rounded-3xl bg-surface-card border border-surface-border shadow-card px-5 py-5 text-center animate-rise">
        <p className="text-[11px] font-bold text-ink-muted uppercase tracking-[0.12em] mb-2.5">🕌 {tr("Reminder of the day")}</p>
        <p className="text-base md:text-lg text-ink font-medium leading-relaxed italic mb-2" dir={language === "ar" ? "rtl" : "ltr"}>
          &ldquo;{language === "ar" ? dailyQuote.ar : dailyQuote.en}&rdquo;
        </p>
        <p className="text-xs text-ink-muted">— {language === "ar" ? dailyQuote.refAr : dailyQuote.ref}</p>
      </div>

      <Link
        href="/account"
        className="block text-center text-[11.5px] font-semibold text-ink-muted hover:text-ink transition-colors pb-2"
      >
        {t("nav.account")} · {t("common.privacy")}
      </Link>
    </div>
  );
}
