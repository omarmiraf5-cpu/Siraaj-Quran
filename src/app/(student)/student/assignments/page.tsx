"use client";

import { useState } from "react";
import { getSurahById } from "@/data/mushaf-index";
import {
  DEMO_CURRENT_STUDENT,
  demoAssignmentsFor,
  dueLabel,
  ASSIGNMENT_LABELS,
} from "@/data/demo";
import { TeacherNote, EmptyNote } from "@/components/portal-ui";
import {
  ProgressRing,
  ILLUM_CLASS,
  STATUS_COLOUR,
  surahColour,
} from "@/components/student-ui";
import { IconCheck } from "@/components/icons";

export default function StudentAssignmentsPage() {
  const all = demoAssignmentsFor(DEMO_CURRENT_STUDENT.id);
  const [levels, setLevels] = useState<Record<string, number>>(
    Object.fromEntries(all.map((a) => [a.id, a.memorization_level]))
  );

  const done = all.filter((a) => a.status === "completed").length;
  const overall = all.length
    ? Math.round(Object.values(levels).reduce((s, v) => s + v, 0) / all.length)
    : 0;

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <header className="gradient-navy rounded-[22px] px-6 py-6 relative overflow-hidden animate-rise">
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative flex items-center gap-5">
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-white/45">Your work</p>
            <h1 className="page-title text-white text-[30px] mt-1 leading-tight">Assignments</h1>
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

      {all.length === 0 && (
        <div className="card-quiet p-5">
          <EmptyNote>Nothing has been set for you yet.</EmptyNote>
        </div>
      )}

      {all.map((a, i) => {
        const surah = getSurahById(a.surah);
        // Nothing is overdue once it is finished.
        const due = a.status === "completed" ? null : dueLabel(a.due_date);
        const level = levels[a.id];
        const colour = surahColour(a.surah);
        const isDone = a.status === "completed";

        return (
          <article
            key={a.id}
            className="card-quiet p-5 animate-rise"
            style={{ animationDelay: `${60 + i * 70}ms` }}
          >
            <div className="flex items-center gap-4">
              <ProgressRing value={level} colour={colour} size={70} />

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="page-title text-[19px] truncate">
                    {surah ? surah.englishName : `Surah ${a.surah}`}
                  </h2>
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
                    className={`${ILLUM_CLASS[STATUS_COLOUR[a.status]]} inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide`}
                  >
                    {ASSIGNMENT_LABELS[a.status]}
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
                <span className="text-[13px] font-bold text-ink tabular-nums">{level}%</span>
              </div>
              {/* Dragging this is the one thing on the page a child changes,
                  so it gets a thumb big enough to grab. */}
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={level}
                onChange={(e) =>
                  setLevels((l) => ({ ...l, [a.id]: Number(e.target.value) }))
                }
                aria-label={`How much of ${surah?.englishName ?? "this surah"} you know`}
                className="student-range w-full"
              />
            </div>

            {a.teacher_notes && <TeacherNote>{a.teacher_notes}</TeacherNote>}
          </article>
        );
      })}
    </div>
  );
}
