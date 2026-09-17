"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDemoUser } from "@/hooks/useDemoUser";
import {
  DEMO_TODAY,
  summariseAttendance,
  formatDay,
  dueLabel,
  initials,
  ASSIGNMENT_STYLES,
} from "@/data/demo";
import { getSurahById } from "@/data/mushaf-index";
import { ASSIGNMENT_STATUS_KEY } from "@/lib/i18n/translations";
import { usePortalRoster, useStudentRecord } from "@/hooks/usePortalRoster";
import { PortalHero, HeroButtonPrimary, HeroButtonGhost } from "@/components/PortalHero";
import {
  SectionCard,
  StatTile,
  ProgressBar,
  AttendanceStrip,
  AttendanceLegend,
  SegmentedSwitch,
  EmptyNote,
  LoadingNote,
  TeacherNote,
} from "@/components/portal-ui";
import { IconBook, IconChart, IconCalendar, IconArrow } from "@/components/icons";
import { AnnouncementsFeed } from "@/components/AnnouncementsFeed";
import { AchievementsCard } from "@/components/AchievementsCard";
import { useLanguage } from "@/components/LanguageProvider";

export default function ParentDashboard() {
  const demoUser = useDemoUser();
  const { t, language } = useLanguage();

  // RLS narrows this to the signed-in parent's own children; in demo mode
  // it's the two sample ones.
  const { mode, students: children } = usePortalRoster();
  const [childId, setChildId] = useState<string | null>(null);
  const child = children.find((c) => c.id === childId) ?? children[0] ?? null;

  // Until the roster arrives there is no child to pick, so the first one
  // becomes the selection as soon as there is one.
  useEffect(() => {
    if (!childId && children.length > 0) setChildId(children[0].id);
  }, [children, childId]);

  const { attendance, assignments, ready } = useStudentRecord(child?.id ?? null, mode);
  const summary = summariseAttendance(attendance);

  const active = assignments.filter((a) => a.status !== "completed");
  const done = assignments.filter((a) => a.status === "completed");
  const needsReview = assignments.filter((a) => a.status === "needs_review");
  const memorisation = assignments.length
    ? Math.round(
        assignments.reduce((sum, a) => sum + a.memorization_level, 0) / assignments.length
      )
    : 0;

  // The soonest thing the parent might need to act on.
  const nextDue = active
    .map((a) => a.due_date)
    .filter((d): d is string => Boolean(d))
    .sort()[0];

  const todayStatus = attendance[0]?.status;

  // Everything below reads from one child, so there is nothing to draw until
  // the roster has arrived — and a parent whose children haven't been linked
  // to them yet needs telling rather than an empty dashboard.
  if (mode === "loading" || !child) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 pt-2">
        <PortalHero eyebrow={t("common.asalaamuAlaykum")} title={demoUser?.name ?? t("role.parent")} />
        <SectionCard title={t("common.yourChildren")}>
          {mode === "loading" ? (
            <LoadingNote />
          ) : (
            <EmptyNote>{t("common.noChildrenLinked")}</EmptyNote>
          )}
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pt-2">
      <PortalHero
        eyebrow={t("common.asalaamuAlaykum")}
        title={demoUser?.name ?? t("role.parent")}
        meta={[
          formatDay(DEMO_TODAY, language),
          `${child.name.split(" ")[0]} ${t("common.was")} ${
            todayStatus ? t(`common.${todayStatus}`) : t("common.notMarked")
          } ${t("common.today")}`,
          active.length === 1 ? t("common.pieceOfWorkOpenOne") : `${active.length} ${t("common.pieceOfWorkOpenOther")}`,
        ]}
        actions={
          <>
            <HeroButtonPrimary href="/parent/quran-progress" icon={<IconChart />}>
              {t("nav.progress")}
            </HeroButtonPrimary>
            <HeroButtonGhost href="/parent/attendance" icon={<IconCalendar />}>
              {t("nav.attendance")}
            </HeroButtonGhost>
          </>
        }
      />

      {/* Which child. A parent with one child never sees this. */}
      {children.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="eyebrow">{t("common.viewing")}</span>
          <SegmentedSwitch
            label={t("common.selectChild")}
            value={child?.id ?? ""}
            onChange={setChildId}
            options={children.map((c) => ({ value: c.id, label: c.name.split(" ")[0] }))}
          />
        </div>
      )}

      {/* At a glance, in the parent's terms rather than the school's. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          value={`${summary.rate}%`}
          label={t("common.attendanceStat")}
          sub={`${summary.present + summary.late} ${t("common.of")} ${summary.total - summary.excused} ${t("common.days")}`}
        />
        <StatTile
          value={`${memorisation}%`}
          label={t("common.memorised")}
          sub={`${t("common.across")} ${assignments.length} ${t("common.surahs")}`}
        />
        <StatTile
          value={active.length}
          label={t("common.openWork")}
          sub={nextDue ? `${t("common.nextDue")} ${formatDay(nextDue, language)}` : t("common.nothingDue")}
        />
        <StatTile
          value={done.length}
          label={t("assignment.completed")}
          sub={done.length ? t("common.wellDone") : t("common.noneYet")}
        />
      </div>

      <AchievementsCard studentId={child.id} studentFirstName={child.name.split(" ")[0]} />

      <AnnouncementsFeed audience="parents" />

      <div className="grid md:grid-cols-2 gap-3 items-start">
        {/* The work itself, not a link to it. */}
        <SectionCard
          title={t("common.currentWork")}
          note={`${assignments.length} ${t("common.total")}`}
        >
          {!ready ? (
            <LoadingNote />
          ) : assignments.length === 0 ? (
            <EmptyNote>{t("common.nothingSetYet")}</EmptyNote>
          ) : (
            <ul className="space-y-4">
              {assignments.map((a) => {
                const surah = getSurahById(a.surah);
                const surahEnd = a.surah_end !== a.surah ? getSurahById(a.surah_end) : null;
                const due = a.status === "completed" ? null : dueLabel(a.due_date);
                return (
                  <li key={a.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="eyebrow underline decoration-2 underline-offset-2 text-ink">
                          {t(`portion.${a.portion}`)}
                        </p>
                        <p className="text-[13px] font-semibold text-ink truncate mt-0.5">
                          {surahEnd ? (
                            `${surah?.englishName ?? `Surah ${a.surah}`} ${a.ayah_start} – ${surahEnd.englishName} ${a.ayah_end}`
                          ) : (
                            <>
                              {surah ? surah.englishName : `Surah ${a.surah}`}
                              <span className="font-normal text-ink-muted">
                                {" "}
                                · ayahs {a.ayah_start}–{a.ayah_end}
                              </span>
                            </>
                          )}
                        </p>
                        {due && (
                          <p
                            className={`text-[11px] mt-0.5 ${
                              due.urgent
                                ? "text-red-700 dark:text-red-300 font-semibold"
                                : "text-ink-muted"
                            }`}
                          >
                            {due.text}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap ${ASSIGNMENT_STYLES[a.status]}`}
                      >
                        {t(ASSIGNMENT_STATUS_KEY[a.status])}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 mt-2">
                      <div className="flex-1">
                        <ProgressBar value={a.memorization_level} />
                      </div>
                      <span className="text-[11px] font-semibold text-ink-muted tabular-nums w-8 text-end">
                        {a.memorization_level}%
                      </span>
                    </div>

                    {a.teacher_notes && <TeacherNote>{a.teacher_notes}</TeacherNote>}
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href="/parent/quran-progress"
            className="group mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            {t("common.openProgress")}
            <span className="group-hover:translate-x-0.5 transition-transform">
              <IconArrow size={14} />
            </span>
          </Link>
        </SectionCard>

        {/* Attendance, summarised the way a parent reads it. */}
        <SectionCard
          title={t("nav.attendance")}
          note={[t("common.last"), summary.total, t("common.days")].filter((x) => x !== "").join(" ")}
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[34px] font-bold text-ink tabular-nums leading-none">
                {summary.rate}%
              </p>
              <p className="text-[12px] text-ink-muted mt-1.5">
                {summary.rate >= 95
                  ? t("parent.attendance.excellent")
                  : summary.rate >= 85
                    ? t("parent.attendance.good")
                    : t("parent.attendance.belowTarget")}
              </p>
            </div>
            <span
              className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                summary.rate >= 95
                  ? "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                  : summary.rate >= 85
                    ? "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                    : "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300"
              }`}
            >
              {initials(child.name)}
            </span>
          </div>

          <div className="mt-4">
            <AttendanceStrip days={attendance} />
          </div>

          <div className="mt-4">
            <AttendanceLegend counts={summary} />
          </div>

          {needsReview.length > 0 && (
            <p className="text-[12px] text-ink-body mt-4 pt-4 border-t border-surface-border">
              {needsReview.length === 1
                ? t("common.oneWorkNeedsReview")
                : `${needsReview.length} ${t("common.worksNeedReview")}`}
            </p>
          )}

          <Link
            href="/parent/attendance"
            className="group mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            {t("common.openAttendance")}
            <span className="group-hover:translate-x-0.5 transition-transform">
              <IconArrow size={14} />
            </span>
          </Link>
        </SectionCard>
      </div>

      {/* The Mushaf has no state to summarise, so it stays a link. */}
      <Link
        href="/parent/mushaf"
        className="card-quiet card-feature group flex items-center gap-3.5 px-5 py-4 transition-all hover:-translate-y-0.5 hover:shadow-lg"
      >
        <span className="icon-tile flex-shrink-0">
          <IconBook size={19} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block page-title text-[15px]">{t("nav.mushaf")}</span>
          <span className="block text-[12px] text-ink-muted">
            {t("common.readAlongWith")} {child.name.split(" ")[0]}, {t("common.playAyahAloud")}
          </span>
        </span>
        <span className="text-ink-muted group-hover:translate-x-0.5 group-hover:text-ink transition-all flex-shrink-0">
          <IconArrow size={14} />
        </span>
      </Link>

      <section className="card-quiet px-6 py-8 text-center">
        <p className="eyebrow">{t("common.dailyReflection")}</p>
        <p
          className="font-calligraphy text-[28px] md:text-[34px] text-ink mt-4 leading-[2.1]"
          dir="rtl"
          lang="ar"
        >
          وَقُل رَّبِّ زِدْنِي عِلْمًا
        </p>
        <div className="gold-rule w-20 mx-auto my-5" />
        <p className="font-serif text-[15px] text-ink-body italic" dir="ltr">
          &ldquo;And say: My Lord, increase me in knowledge.&rdquo;
        </p>
        <p className="text-[11px] text-ink-muted mt-2" dir="ltr">Surah Ta-Ha, 114</p>
      </section>
    </div>
  );
}
