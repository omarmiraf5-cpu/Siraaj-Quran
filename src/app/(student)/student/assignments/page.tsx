"use client";

import { useState } from "react";
import { getSurahById } from "@/data/mushaf-index";
import {
  DEMO_CURRENT_STUDENT,
  demoAssignmentsFor,
  assignmentsByPortion,
  dueLabel,
  ASSIGNMENT_LABELS,
  HIFZ_PORTIONS,
  PORTION_LABELS,
  PORTION_ARABIC,
  PORTION_BLURB,
} from "@/data/demo";
import type { HifzPortion } from "@/hooks/useQuranicAssignments";
import { TeacherNote } from "@/components/portal-ui";
import {
  ProgressRing,
  Confetti,
  FriendlyEmpty,
  ILLUM_CLASS,
  GRAD_CLASS,
  STATUS_COLOUR,
  surahColour,
  type IllumColour,
} from "@/components/student-ui";
import { IconCheck, IconBookOpen, IconClock, IconStar } from "@/components/icons";

// A colour and a mark per portion, held steady across the app so a child
// learns the three by sight before they learn them by name.
const PORTION_STYLE: Record<
  HifzPortion,
  { colour: IllumColour; icon: React.ReactNode }
> = {
  new: { colour: "saffron", icon: <IconBookOpen size={15} /> },
  recent: { colour: "turquoise", icon: <IconClock size={15} /> },
  old: { colour: "aubergine", icon: <IconStar size={15} /> },
};

export default function StudentAssignmentsPage() {
  const all = demoAssignmentsFor(DEMO_CURRENT_STUDENT.id);
  const grouped = assignmentsByPortion(all);
  const [levels, setLevels] = useState<Record<string, number>>(
    Object.fromEntries(all.map((a) => [a.id, a.memorization_level]))
  );
  // Bumped once per assignment each time its slider newly reaches 100 — the
  // one moment on this page that rewards the child for doing something,
  // rather than just describing state a teacher set.
  const [bursts, setBursts] = useState<Record<string, number>>({});

  const setLevel = (id: string, next: number) => {
    setLevels((l) => {
      if (next === 100 && l[id] !== 100) {
        const reduceMotion =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!reduceMotion) {
          setBursts((b) => ({ ...b, [id]: (b[id] ?? 0) + 1 }));
        }
      }
      return { ...l, [id]: next };
    });
  };

  const done = all.filter((a) => a.status === "completed").length;
  const overall = all.length
    ? Math.round(Object.values(levels).reduce((s, v) => s + v, 0) / all.length)
    : 0;

  return (
    <div className="px-4 pt-4 pb-4 space-y-5">
      <header className="gradient-navy rounded-[22px] px-6 py-6 relative overflow-hidden animate-rise">
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative flex items-center gap-5">
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-white/45">Today&apos;s three</p>
            <h1 className="page-title text-white text-[30px] mt-1 leading-tight">My work</h1>
            <p className="text-[13px] text-white/55 mt-1.5">
              {done} of {all.length} finished
            </p>
          </div>
          <div className="flex-shrink-0 rounded-full bg-white/10 p-2 backdrop-blur-sm">
            <div className="rounded-full bg-surface-card p-1.5">
              <ProgressRing value={overall} colour="saffron" size={72} label="learnt" />
            </div>
          </div>
        </div>
      </header>

      {HIFZ_PORTIONS.map((portion, pi) => {
        const items = grouped[portion];
        const { colour, icon } = PORTION_STYLE[portion];

        return (
          <section key={portion} className="space-y-2.5">
            {/* Portion header — English and Arabic, because both are used in
                the halaqa and a child should meet them together. */}
            <div
              className={`${GRAD_CLASS[colour]} relative overflow-hidden rounded-[18px] px-4 py-3 animate-rise`}
              style={{ animationDelay: `${pi * 90}ms` }}
            >
              <span className="pattern-lattice absolute inset-0 opacity-30 pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center text-white flex-shrink-0">
                  {icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="page-title text-white text-[16px]">
                      {PORTION_LABELS[portion]}
                    </h2>
                    <span
                      className="font-arabic text-[15px] text-white/75 flex-shrink-0"
                      dir="rtl"
                      lang="ar"
                    >
                      {PORTION_ARABIC[portion]}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/65 mt-0.5">
                    {PORTION_BLURB[portion]}
                  </p>
                </div>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="card-quiet p-5">
                <FriendlyEmpty title="Nothing set yet" sub="Check back soon." mood="calm" />
              </div>
            ) : (
              items.map((a, i) => {
                const surah = getSurahById(a.surah);
                // Nothing is overdue once it is finished.
                const due = a.status === "completed" ? null : dueLabel(a.due_date);
                const level = levels[a.id];
                const isDone = a.status === "completed";
                // A live 100 on the slider outranks whatever the teacher's
                // status says — it's the child's own report that they know
                // it, and it deserves to say so even before a teacher has
                // confirmed it.
                const celebrating = level === 100;
                const chipColour = celebrating ? "verdigris" : STATUS_COLOUR[a.status];
                const chipLabel = celebrating ? "Fully memorised!" : ASSIGNMENT_LABELS[a.status];

                return (
                  <article
                    key={a.id}
                    className="card-quiet p-5 animate-rise"
                    style={{ animationDelay: `${pi * 90 + 45 + i * 60}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative flex-shrink-0" style={{ width: 70, height: 70 }}>
                        <ProgressRing
                          value={level}
                          colour={surahColour(a.surah)}
                          size={70}
                        />
                        <Confetti burstKey={bursts[a.id] ?? 0} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="page-title text-[19px] truncate">
                            {surah ? surah.englishName : `Surah ${a.surah}`}
                          </h3>
                          {isDone && (
                            <span
                              className={`${ILLUM_CLASS.verdigris} w-6 h-6 rounded-full flex-shrink-0`}
                              title="Finished"
                            >
                              <IconCheck size={13} />
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-ink-muted mt-0.5">
                          Ayahs {a.ayah_start}–{a.ayah_end}
                          {surah ? ` · page ${surah.startPage}` : ""}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span
                            className={`${ILLUM_CLASS[chipColour]} inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide`}
                          >
                            {chipLabel}
                          </span>
                          {due && (
                            <span
                              className={`text-[11px] font-bold ${
                                due.urgent ? "text-illum-vermilion" : "text-ink-muted"
                              }`}
                            >
                              {due.text}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="gold-rule my-4" />

                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="eyebrow">How much you know</span>
                        <span className="text-[13px] font-bold text-ink tabular-nums">
                          {level}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={level}
                        onChange={(e) => setLevel(a.id, Number(e.target.value))}
                        aria-label={`How much of ${surah?.englishName ?? "this surah"} you know`}
                        className="student-range w-full"
                      />
                    </div>

                    {a.teacher_notes && <TeacherNote>{a.teacher_notes}</TeacherNote>}
                  </article>
                );
              })
            )}
          </section>
        );
      })}
    </div>
  );
}
