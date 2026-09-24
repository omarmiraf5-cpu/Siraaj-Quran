"use client";

import { useEffect, useState } from "react";
import { getSurahById } from "@/data/mushaf-index";
import { Mushaf } from "@/components/Mushaf";
import { pageOfPosition } from "@/lib/mushafPlan";
import {
  formatDay,
  dueLabel,
  ASSIGNMENT_STYLES,
  PORTION_ARABIC,
  withOverride,
  recitationLogFor,
  type AssignmentOverride,
  type RecitationLogEntry,
} from "@/data/demo";
import { usePortalRoster, useStudentRecord } from "@/hooks/usePortalRoster";
import { PortalHero } from "@/components/PortalHero";
import {
  SectionCard,
  StatTile,
  ProgressBar,
  SegmentedSwitch,
  EmptyNote,
  LoadingNote,
  TeacherNote,
  RatingPill,
  RecitationHistory,
} from "@/components/portal-ui";
import { IconArrow } from "@/components/icons";
import { readDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { ASSIGNMENT_STATUS_KEY } from "@/lib/i18n/translations";

const OVERRIDES_KEY = "demo_assignment_overrides";
// Same key the teacher's assignments page writes to — every graded session
// they log shows up here in the same browser (demo mode only; a real
// grading writes straight to the row, so there's nothing to overlay).
const LOG_KEY = "demo_recitation_log_v1";

export default function ParentQuranProgressPage() {
  const { t, language } = useLanguage();
  // RLS narrows this to the signed-in parent's own children; in demo mode
  // it's the two sample ones.
  const { mode, students: children } = usePortalRoster();
  const [childId, setChildId] = useState<string | null>(null);
  const child = children.find((c) => c.id === childId) ?? children[0] ?? null;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, AssignmentOverride>>({});
  const [demoLog, setDemoLog] = useState<RecitationLogEntry[]>([]);
  const [realLog, setRealLog] = useState<RecitationLogEntry[]>([]);

  useEffect(() => {
    if (!childId && children.length > 0) setChildId(children[0].id);
  }, [children, childId]);

  const { assignments: baseAssignments, ready } = useStudentRecord(child?.id ?? null, mode);

  // Ratings and remarks a teacher has set since this page's sample data was
  // written, shared with the teacher portal via the same browser storage —
  // demo mode only, since a real grading already lands directly on the row.
  useEffect(() => {
    if (mode !== "demo") return;
    setOverrides(readDemoStore(OVERRIDES_KEY, {}));
    setDemoLog(readDemoStore(LOG_KEY, []));
  }, [mode]);

  useEffect(() => {
    if (mode !== "real" || !child) return;
    const supabase = createClient();
    supabase
      .from("recitation_log")
      .select("*")
      .eq("student_id", child.id)
      .order("session_date")
      .then(({ data }) => {
        setRealLog(
          (data ?? []).map((r) => ({
            id: r.id,
            student_id: r.student_id,
            portion: r.portion,
            surah: r.surah,
            ayah_start: r.ayah_start,
            surah_end: r.surah_end,
            ayah_end: r.ayah_end,
            rating: r.rating,
            notes: r.notes,
            date: r.session_date,
          }))
        );
      });
  }, [mode, child]);

  const assignments = mode === "demo" ? baseAssignments.map((a) => withOverride(a, overrides)) : baseAssignments;
  const log = mode === "demo" ? demoLog : realLog;

  if (mode === "loading" || !child) {
    return (
      <div className="max-w-6xl mx-auto space-y-4 pt-2">
        <PortalHero eyebrow={t("parent.quranProgress.eyebrow")} title="…" />
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

  const completed = assignments.filter((a) => a.status === "completed").length;
  const avg = assignments.length
    ? Math.round(
        assignments.reduce((sum, a) => sum + a.memorization_level, 0) / assignments.length
      )
    : 0;

  const firstName = child.name.split(" ")[0];

  return (
    <div className="max-w-6xl mx-auto space-y-4 pt-2">
      <PortalHero
        eyebrow={t("parent.quranProgress.eyebrow")}
        title={firstName}
        meta={[
          child.halaqa,
          `${completed} ${t("common.of")} ${assignments.length} ${t("common.finished").toLowerCase()}`,
          `${avg}% ${t("common.memorised").toLowerCase()}`,
        ]}
      />

      {children.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="eyebrow">{t("common.viewing")}</span>
          <SegmentedSwitch
            label={t("common.selectChild")}
            value={child.id}
            onChange={(v) => {
              setChildId(v);
              setExpanded(null);
            }}
            options={children.map((c) => ({ value: c.id, label: c.name.split(" ")[0] }))}
          />
        </div>
      )}

      {!ready && <LoadingNote>{t("common.loadingAssignments")}</LoadingNote>}

      <div className="grid grid-cols-3 gap-3">
        <StatTile value={assignments.length} label={t("common.setOn")} sub={t("common.thisTerm")} />
        <StatTile
          value={completed}
          label={t("common.finished")}
          sub={`${assignments.length - completed} ${t("common.stillOpen")}`}
        />
        <StatTile value={`${avg}%`} label={t("common.memorised")} sub={t("common.acrossAllSurahs")} />
      </div>

      <SectionCard
        title={t("nav.assignments")}
        note={t("parent.quranProgress.tapToRead")}
      >
        {assignments.length === 0 ? (
          <EmptyNote>
            {t("common.nothingSetForPrefix")} {firstName} {t("common.yetSuffix")}
          </EmptyNote>
        ) : (
          <ul className="space-y-1">
            {assignments.map((a) => {
              const surah = getSurahById(a.surah);
              const surahEnd = a.surah_end !== a.surah ? getSurahById(a.surah_end) : null;
              const rangeLabel = surahEnd
                ? `${surah?.englishName ?? `Surah ${a.surah}`} ${a.ayah_start} – ${surahEnd.englishName} ${a.ayah_end}`
                : a.ayah_start === a.ayah_end
                  ? `ayah ${a.ayah_start}`
                  : `ayahs ${a.ayah_start}–${a.ayah_end}`;
              const due = a.status === "completed" ? null : dueLabel(a.due_date);
              const isOpen = expanded === a.id;

              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : a.id)}
                    aria-expanded={isOpen}
                    className="w-full text-start rounded-xl px-2 py-3 -mx-2 hover:bg-surface-bg-warm transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="eyebrow">
                          <span className="underline decoration-2 underline-offset-2 text-ink">
                            {t(`portion.${a.portion}`)}
                          </span>
                          <span
                            className="font-arabic text-[13px] normal-case tracking-normal ms-2"
                            dir="rtl"
                            lang="ar"
                          >
                            {PORTION_ARABIC[a.portion]}
                          </span>
                        </p>
                        <p className="text-[14px] font-semibold text-ink truncate mt-0.5">
                          {surahEnd ? (
                            rangeLabel
                          ) : (
                            <>
                              {surah ? surah.englishName : `Surah ${a.surah}`}
                              <span className="font-normal text-ink-muted"> · {rangeLabel}</span>
                            </>
                          )}
                        </p>
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          {t("common.setOn")} {formatDay(a.assigned_at, language)}
                          {due && (
                            <>
                              <span className="mx-1.5">·</span>
                              <span
                                className={
                                  due.urgent ? "text-red-700 dark:text-red-300 font-semibold" : ""
                                }
                              >
                                {due.text}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${ASSIGNMENT_STYLES[a.status]}`}
                        >
                          {t(ASSIGNMENT_STATUS_KEY[a.status])}
                        </span>
                        <span
                          className={`text-ink-muted transition-transform ${isOpen ? "rotate-90" : ""}`}
                        >
                          <IconArrow size={14} />
                        </span>
                      </div>
                    </div>

                    {/* The rating word leads, with the teacher's remark right
                        after it — a parent reads "Excellent — held the madd
                        well" faster than a bare percentage. The percentage
                        stays underneath as the finer-grained measure. */}
                    {a.daily_rating && (
                      <div className="flex items-start gap-2 mt-2.5">
                        <RatingPill rating={a.daily_rating} />
                        {a.teacher_notes && (
                          <p className="text-[12.5px] text-ink-body font-serif italic leading-snug pt-0.5">
                            {a.teacher_notes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Capped, because a bar spanning the full width of a
                        desktop card reads as a page loader rather than a
                        measure of one surah. */}
                    <div className="flex items-center gap-2.5 mt-2.5 max-w-xs">
                      <div className="flex-1">
                        <ProgressBar value={a.memorization_level} />
                      </div>
                      <span className="text-[11px] font-semibold text-ink-muted tabular-nums w-8 text-end">
                        {a.memorization_level}%
                      </span>
                    </div>

                    {!a.daily_rating && a.teacher_notes && (
                      <TeacherNote>{a.teacher_notes}</TeacherNote>
                    )}
                  </button>

                  {isOpen && (
                    <div className="mt-2 mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4">
                      <div className="flex items-baseline justify-between mb-3">
                        <p className="eyebrow">
                          {surahEnd
                            ? rangeLabel
                            : `${surah ? surah.englishName : `Surah ${a.surah}`} · ${rangeLabel}`}
                        </p>
                        <button
                          type="button"
                          onClick={() => setExpanded(null)}
                          className="text-[11px] font-semibold text-ink-muted hover:text-ink transition-colors"
                        >
                          {t("common.close")}
                        </button>
                      </div>
                      <Mushaf
                        // Open on the page the portion starts on, not the
                        // surah's first page — Al-Baqarah 275 is page 47,
                        // and opening on page 2 hid the highlight entirely.
                        initialPage={pageOfPosition({ surah: a.surah, ayah: a.ayah_start })}
                        highlightedRange={{
                          surah: a.surah,
                          start: a.ayah_start,
                          surahEnd: a.surah_end,
                          end: a.ayah_end,
                        }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title={t("common.thisMonth")}
        note={t("parent.quranProgress.everySessionGraded")}
      >
        <RecitationHistory entries={recitationLogFor(child.id, log)} />
      </SectionCard>

      <section className="card-quiet px-6 py-7 text-center">
        <p className="eyebrow">{t("common.wordOfEncouragement")}</p>
        <p className="font-serif text-[15px] text-ink-body italic mt-3 max-w-md mx-auto leading-relaxed">
          {t("common.recitingWithPrefix")} {firstName} {t("common.recitingWithSuffix")}
        </p>
      </section>
    </div>
  );
}
