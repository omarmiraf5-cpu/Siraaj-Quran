"use client";

import { useState } from "react";
import { getSurahById } from "@/data/mushaf-index";
import {
  DEMO_CURRENT_STUDENT,
  demoAssignmentsFor,
  dueLabel,
  ASSIGNMENT_LABELS,
  ASSIGNMENT_STYLES,
} from "@/data/demo";
import { ProgressBar, TeacherNote, EmptyNote } from "@/components/portal-ui";

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
      <header className="gradient-navy rounded-[18px] px-6 py-6 relative overflow-hidden">
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative">
          <p className="eyebrow text-white/45">Your work</p>
          <h1 className="page-title text-white text-3xl mt-1.5">Assignments</h1>
          <p className="text-[13px] text-white/55 mt-2.5">
            {done} of {all.length} finished
            <span className="text-white/25 mx-2">·</span>
            {overall}% memorised overall
          </p>
        </div>
      </header>

      {all.length === 0 && (
        <div className="card-quiet p-5">
          <EmptyNote>Nothing has been set for you yet.</EmptyNote>
        </div>
      )}

      {all.map((a) => {
        const surah = getSurahById(a.surah);
        // Nothing is overdue once it is finished.
        const due = a.status === "completed" ? null : dueLabel(a.due_date);
        const level = levels[a.id];

        return (
          <article key={a.id} className="card-quiet p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="page-title text-[17px] truncate">
                  {surah ? surah.englishName : `Surah ${a.surah}`}
                </h2>
                <p className="text-[12px] text-ink-muted mt-0.5">
                  Ayahs {a.ayah_start}–{a.ayah_end}
                  {surah ? ` · page ${surah.startPage}` : ""}
                </p>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap ${ASSIGNMENT_STYLES[a.status]}`}
              >
                {ASSIGNMENT_LABELS[a.status]}
              </span>
            </div>

            {due && (
              <p
                className={`text-[12px] mt-2 font-semibold ${
                  due.urgent ? "text-red-700 dark:text-red-300" : "text-ink-muted"
                }`}
              >
                {due.text}
              </p>
            )}

            <div className="gold-rule my-4" />

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="eyebrow">How much you know</span>
                <span className="text-[13px] font-bold text-ink tabular-nums">{level}%</span>
              </div>
              <ProgressBar value={level} />
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={level}
                onChange={(e) =>
                  setLevels((l) => ({ ...l, [a.id]: Number(e.target.value) }))
                }
                aria-label={`Memorisation progress for ${surah?.englishName ?? "surah"}`}
                className="w-full mt-3 h-1.5 bg-surface-bg rounded-full appearance-none cursor-pointer accent-brand-gold"
              />
            </div>

            {a.teacher_notes && <TeacherNote>{a.teacher_notes}</TeacherNote>}
          </article>
        );
      })}
    </div>
  );
}
