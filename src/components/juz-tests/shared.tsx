"use client";

import { formatDay } from "@/data/demo";
import { addDays } from "@/lib/planDates";
import { getSurahById } from "@/data/mushaf-index";
import { useLanguage } from "@/components/LanguageProvider";
import type { JuzMistake, JuzTestStatus } from "@/lib/juzTests";

/* Shared pieces of the Juz test pages: how a test's state, a day and a
   mistake are written, the same wherever they appear. */

const STATUS_STYLE: Record<JuzTestStatus, string> = {
  passed: "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300",
  failed: "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300",
  booked: "bg-sky-100 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300",
  missed: "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
  cancelled: "bg-slate-200 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300",
};

export function StatusPill({ status, waitingLabel }: { status: JuzTestStatus; waitingLabel?: string }) {
  const { tr } = useLanguage();
  const label: Record<JuzTestStatus, string> = {
    passed: tr("Passed"),
    failed: tr("Failed"),
    booked: waitingLabel ?? tr("Booked"),
    missed: tr("Not tested"),
    cancelled: tr("Cancelled"),
  };
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLE[status]}`}>
      {label[status]}
    </span>
  );
}

/** "Today", "Tomorrow", or the day itself. */
export function useDayName() {
  const { tr, language } = useLanguage();
  return (iso: string, today: string) =>
    iso === today ? tr("Today") : iso === addDays(today, 1) ? tr("Tomorrow") : formatDay(iso, language);
}

export function useSurahName() {
  const { language } = useLanguage();
  return (surah: number) => {
    const s = getSurahById(surah);
    if (!s) return String(surah);
    return language === "ar" ? s.name : s.englishName;
  };
}

/** Each mistake: where it was, what kind, and the examiner's note. */
export function MistakeList({ mistakes, onPick }: { mistakes: JuzMistake[]; onPick?: (m: JuzMistake) => void }) {
  const { tr } = useLanguage();
  const surahName = useSurahName();
  if (mistakes.length === 0) return <p className="text-[12px] text-ink-muted">{tr("No mistakes marked.")}</p>;
  return (
    <ul className="divide-y divide-surface-border">
      {mistakes.map((m) => {
        const body = (
          <>
            <span
              className={`mt-0.5 inline-block w-2 h-2 rounded-full flex-shrink-0 ${m.kind === "tajweed" ? "bg-amber-500" : "bg-red-600"}`}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-ink">
                {surahName(m.surah)} {m.surah}:{m.ayah} · {tr("word {word}", { word: m.word })}
              </span>
              <span className="block text-[12px] text-ink-muted">
                {m.kind === "tajweed" ? tr("Tajweed") : tr("Memorization")} · {tr("page {page}", { page: m.page })}
                {m.note ? ` · ${m.note}` : ""}
              </span>
            </span>
          </>
        );
        return (
          <li key={m.id}>
            {onPick ? (
              <button type="button" onClick={() => onPick(m)} className="w-full flex items-start gap-2.5 py-2 text-start hover:bg-surface-bg rounded-md px-1">
                {body}
              </button>
            ) : (
              <div className="flex items-start gap-2.5 py-2 px-1">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** "2 tajweed · 1 memorization", or nothing. */
export function useMistakeCount() {
  const { tr } = useLanguage();
  return (mistakes: JuzMistake[]) => {
    const tajweed = mistakes.filter((m) => m.kind === "tajweed").length;
    const memo = mistakes.length - tajweed;
    return [
      tajweed ? tr("{count} tajweed", { count: tajweed }) : "",
      memo ? tr("{count} memorization", { count: memo }) : "",
    ]
      .filter(Boolean)
      .join(" · ");
  };
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-[13px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
      {children}
    </p>
  );
}
