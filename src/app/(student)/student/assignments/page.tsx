"use client";

import { useState } from "react";
import { getSurahById } from "@/data/mushaf-index";
import { DEMO_CURRENT_STUDENT, demoAssignmentsFor } from "@/data/demo";
import type { QuranicAssignment } from "@/hooks/useQuranicAssignments";

const STATUS: Record<
  QuranicAssignment["status"],
  { label: string; emoji: string; chip: string }
> = {
  assigned: { label: "To start", emoji: "📤", chip: "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" },
  in_progress: { label: "In progress", emoji: "🔄", chip: "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300" },
  completed: { label: "Completed", emoji: "✅", chip: "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300" },
  needs_review: { label: "Needs review", emoji: "👀", chip: "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300" },
};

// Fixed so the server and client agree; real data would use today's date.
const TODAY = "2026-08-13";

function dueLabel(due: string | null): { text: string; urgent: boolean } | null {
  if (!due) return null;
  const days = Math.round(
    (Date.parse(due + "T00:00:00Z") - Date.parse(TODAY + "T00:00:00Z")) / 86400000
  );
  if (days < 0) return { text: `${Math.abs(days)} days overdue`, urgent: true };
  if (days === 0) return { text: "Due today", urgent: true };
  if (days === 1) return { text: "Due tomorrow", urgent: true };
  return { text: `Due in ${days} days`, urgent: days <= 3 };
}

export default function StudentAssignmentsPage() {
  const all = demoAssignmentsFor(DEMO_CURRENT_STUDENT.id);
  const [levels, setLevels] = useState<Record<string, number>>(
    Object.fromEntries(all.map((a) => [a.id, a.memorization_level]))
  );

  const done = all.filter((a) => a.status === "completed").length;

  return (
    <div className="px-4 pt-4 pb-24 space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-ink mb-1">📝 My Assignments</h1>
        <p className="text-ink-muted">
          {done} of {all.length} finished
        </p>
      </div>

      {all.map((a) => {
        const surah = getSurahById(a.surah);
        const st = STATUS[a.status];
        // Nothing is overdue once it is finished.
        const due = a.status === "completed" ? null : dueLabel(a.due_date);
        const level = levels[a.id];

        return (
          <div
            key={a.id}
            className="bg-surface-card rounded-3xl border border-surface-border p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-ink text-lg truncate">
                  {surah ? `${surah.id}. ${surah.englishName}` : `Surah ${a.surah}`}
                </p>
                <p className="text-sm text-ink-muted">
                  Ayahs {a.ayah_start}–{a.ayah_end}
                  {surah ? ` · page ${surah.startPage}` : ""}
                </p>
              </div>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${st.chip}`}>
                {st.emoji} {st.label}
              </span>
            </div>

            {due && (
              <p className={`text-xs font-semibold ${due.urgent ? "text-red-600 dark:text-red-400" : "text-ink-muted"}`}>
                📅 {due.text}
              </p>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-ink-muted">Memorisation</span>
                <span className="text-xs font-bold text-ink tabular-nums">{level}%</span>
              </div>
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
                className="w-full h-2 bg-surface-bg rounded-full appearance-none cursor-pointer accent-emerald-600"
              />
            </div>

            {a.teacher_notes && (
              <div className="bg-blue-50 dark:bg-blue-950/25 border border-blue-200 dark:border-blue-800/40 rounded-2xl p-3">
                <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 mb-1">
                  📝 Teacher&apos;s note
                </p>
                <p className="text-sm text-blue-900 dark:text-blue-100">{a.teacher_notes}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
