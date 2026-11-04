"use client";

import { useMemo, useState } from "react";
import { getSurahById } from "@/data/mushaf-index";
import { DAILY_RATING_LABELS, DAILY_RATING_ORDER, PORTION_LABELS, studentName, type DemoStudent } from "@/data/demo";
import type { QuranicAssignment, DailyRating } from "@/hooks/useQuranicAssignments";
import { useLanguage } from "@/components/LanguageProvider";

// What a teacher most often writes. Picked from a menu instead of typed.
export const COMMON_COMMENTS = [
  "Beautiful tajweed, mashaAllah",
  "Recited with confidence",
  "Great effort, keep it up",
  "Needs more practice at home",
  "Review the madd",
  "Review the ghunnah",
  "Review the makharij (letter sounds)",
  "Stumbled in places, please repeat",
  "Memorised well, needs a little polish",
  "Not ready yet, we will repeat this next class",
];

const RATING_COLOUR: Record<DailyRating, string> = {
  excellent: "#15803d",
  very_good: "#0d9488",
  good: "#2563eb",
  weak: "#d97706",
  not_recited: "#6b7385",
};

export interface GraderGroup {
  name: string;
  label: string;
  schedule?: string | null;
  items: QuranicAssignment[];
}

/**
 * Grade a whole halaqa from one screen: every child's piece of work on a row,
 * one tap to rate it (saved at once), a menu of common comments, and bulk
 * buttons for the usual cases.
 */
export function ClassGrader({
  groups,
  roster,
  onGrade,
}: {
  groups: GraderGroup[];
  roster: DemoStudent[];
  onGrade: (a: QuranicAssignment, rating: DailyRating | null, note: string | null) => Promise<void>;
}) {
  const { tr } = useLanguage();
  const [pick, setPick] = useState(groups[0]?.name ?? "");
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [own, setOwn] = useState<string | null>(null);
  const [ownText, setOwnText] = useState("");
  const group = groups.find((g) => g.name === pick) ?? groups[0];

  const rows = useMemo(() => {
    const list = (group?.items ?? []).filter((a) => a.status !== "completed" || touched.has(a.id));
    return list.sort(
      (a, b) =>
        Number(Boolean(a.daily_rating)) - Number(Boolean(b.daily_rating)) ||
        studentName(a.student_id, roster).localeCompare(studentName(b.student_id, roster))
    );
  }, [group, touched, roster]);

  if (!group) return null;
  const graded = rows.filter((a) => a.daily_rating).length;
  const next = rows.find((a) => !a.daily_rating);

  const save = async (a: QuranicAssignment, rating: DailyRating | null, note: string | null) => {
    setBusy((s) => new Set(s).add(a.id));
    setTouched((s) => new Set(s).add(a.id));
    try {
      await onGrade(a, rating, note);
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        n.delete(a.id);
        return n;
      });
    }
  };

  const bulk = async (rating: DailyRating) => {
    const todo = rows.filter((a) => !a.daily_rating);
    if (todo.length === 0) return;
    const text = tr("Mark {count} children as {rating}?", { count: todo.length, rating: tr(DAILY_RATING_LABELS[rating]) });
    if (typeof window !== "undefined" && !window.confirm(text)) return;
    for (const a of todo) await save(a, rating, a.teacher_notes ?? null);
  };

  const range = (a: QuranicAssignment) => {
    const s = getSurahById(a.surah);
    const e = a.surah_end !== a.surah ? getSurahById(a.surah_end) : null;
    const name = s?.englishName ?? `Surah ${a.surah}`;
    return e ? `${name} ${a.ayah_start} – ${e.englishName} ${a.ayah_end}` : `${name} ${a.ayah_start}–${a.ayah_end}`;
  };

  return (
    <div>
      {groups.length > 1 && (
        <div role="group" aria-label={tr("Halaqa")} className="flex flex-wrap gap-2 mb-3">
          {groups.map((g) => (
            <button
              key={g.name}
              type="button"
              onClick={() => setPick(g.name)}
              aria-pressed={g.name === group.name}
              className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                g.name === group.name ? "bg-brand-navy text-white border-brand-navy" : "bg-surface-card text-ink border-surface-border hover:border-brand-navy/40"
              }`}
            >
              {g.label}
              {g.schedule && (
                <span className={`ms-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${g.name === group.name ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"}`}>
                  {g.schedule}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted py-3">{tr("Nothing to grade in this halaqa right now.")}</p>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-bold tabular-nums">{tr("{done} of {total} graded", { done: graded, total: rows.length })}</span>
            <div className="flex-1 h-2.5 rounded-full bg-surface-border overflow-hidden">
              <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${(graded / rows.length) * 100}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-1">
            <button type="button" onClick={() => bulk("excellent")} className="rounded-xl border border-dashed border-surface-border bg-surface-bg-warm px-3.5 py-2.5 text-[13px] font-semibold active:scale-95">
              ✓ {tr("Everyone recited well")}
            </button>
            <button type="button" onClick={() => bulk("not_recited")} className="rounded-xl border border-dashed border-surface-border bg-surface-bg-warm px-3.5 py-2.5 text-[13px] font-semibold active:scale-95">
              {tr("Mark the rest “Did not recite”")}
            </button>
          </div>

          <ul className="divide-y divide-surface-border">
            {rows.map((a) => {
              const done = Boolean(a.daily_rating);
              const isBusy = busy.has(a.id);
              const known = COMMON_COMMENTS.includes(a.teacher_notes ?? "");
              return (
                <li key={a.id} className={`py-3.5 ${done ? "opacity-80" : ""}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-[15px] font-bold">
                      {studentName(a.student_id, roster)}
                      {done && <span className="ms-2 text-[12px] font-bold text-emerald-700">{isBusy ? tr("Saving…") : `✓ ${tr("Saved")}`}</span>}
                    </p>
                    <p className="text-[12.5px] text-ink-muted">
                      <b className="font-semibold text-ink">{range(a)}</b> · {PORTION_LABELS[a.portion]}
                    </p>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 min-[520px]:grid-cols-5 gap-2">
                    {DAILY_RATING_ORDER.map((r) => {
                      const on = a.daily_rating === r;
                      const c = RATING_COLOUR[r];
                      return (
                        <button
                          key={r}
                          type="button"
                          disabled={isBusy}
                          aria-pressed={on}
                          onClick={() => save(a, on ? null : r, a.teacher_notes ?? null)}
                          className="min-h-[48px] rounded-[14px] border-2 px-1 py-3 text-[14px] font-bold transition-all active:scale-[.97] disabled:opacity-60"
                          style={{
                            color: on ? "#fff" : c,
                            background: on ? c : "transparent",
                            borderColor: on ? c : `color-mix(in srgb, ${c} 35%, transparent)`,
                          }}
                        >
                          {tr(DAILY_RATING_LABELS[r])}
                        </button>
                      );
                    })}
                  </div>

                  {done && a.daily_rating !== "not_recited" && (
                    <div className="mt-2.5">
                      {own === a.id ? (
                        <div className="flex gap-2">
                          <input
                            value={ownText}
                            onChange={(e) => setOwnText(e.target.value)}
                            placeholder={tr("Write your own comment")}
                            autoFocus
                            className="flex-1 min-w-0 bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-600"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              await save(a, a.daily_rating!, ownText.trim() || null);
                              setOwn(null);
                            }}
                            className="rounded-xl gradient-emerald text-white px-4 text-sm font-semibold"
                          >
                            {tr("Save")}
                          </button>
                          <button type="button" onClick={() => setOwn(null)} className="text-[13px] text-ink-muted px-2">
                            {tr("Cancel")}
                          </button>
                        </div>
                      ) : (
                        <select
                          aria-label={tr("Comment for the parent")}
                          value={known ? (a.teacher_notes ?? "") : a.teacher_notes ? "__own" : ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "__own") {
                              setOwn(a.id);
                              setOwnText(known ? "" : a.teacher_notes ?? "");
                            } else save(a, a.daily_rating!, v || null);
                          }}
                          className="w-full min-[520px]:w-auto min-[520px]:min-w-[22rem] bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-emerald-600"
                        >
                          <option value="">{tr("Add a comment…")}</option>
                          {COMMON_COMMENTS.map((c) => (
                            <option key={c} value={c}>
                              {tr(c)}
                            </option>
                          ))}
                          {a.teacher_notes && !known && <option value="__own">{a.teacher_notes}</option>}
                          <option value="__own">{tr("Write my own…")}</option>
                        </select>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="sticky bottom-3 mt-3 rounded-2xl bg-brand-navy text-white px-4 py-3 text-sm font-bold shadow-lg">
            {next ? tr("Up next: {name}", { name: studentName(next.student_id, roster) }) : tr("All graded — well done")}
          </div>
        </>
      )}
    </div>
  );
}
