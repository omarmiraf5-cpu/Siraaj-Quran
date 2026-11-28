"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { EmptyNote, LoadingNote } from "@/components/portal-ui";
import { callJuz, useJuzApi } from "@/hooks/useJuzTests";
import { addDays } from "@/lib/planDates";
import { testStatus, type JuzTest } from "@/lib/juzTests";
import { ErrorNote, StatusPill, useDayName } from "@/components/juz-tests/shared";

interface Day {
  date: string;
  today: string;
  testDay: boolean;
  slots: number;
  tests: JuzTest[];
}

/**
 * Mark Test Results: the day's tests in their numbered order, one card
 * each with the student, their teacher, the Juz, and the result and
 * comment once heard. Test opens the Mushaf on the Juz.
 */
export function ExamineDay({ role, testHref, heading = true }: { role: "teacher" | "admin"; testHref: (id: string) => string; heading?: boolean }) {
  const { tr } = useLanguage();
  const dayName = useDayName();
  const { mode, api } = useJuzApi(role);
  const [date, setDate] = useState<string | null>(null);
  const [day, setDay] = useState<Day | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    async (on: string | null) => {
      try {
        const data = await callJuz<Day>(api, `/api/juz-tests/day${on ? `?date=${on}` : ""}`);
        setDay(data);
        setDate(data.date);
        setError("");
      } catch (e) {
        setError(tr((e as Error).message));
      }
    },
    [api, tr]
  );

  useEffect(() => {
    if (mode !== "loading") load(date);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (to: string) => {
    setDay(null);
    load(to);
  };
  const heard = day?.tests.filter((t) => t.result).length ?? 0;

  return (
    <div className="space-y-4 max-w-3xl">
      {heading && (
        <div>
          <p className="eyebrow">{tr("Examiner")}</p>
          <h1 className="page-title text-2xl md:text-3xl">{tr("Mark test results")}</h1>
        </div>
      )}

      <div className="card-quiet flex items-center justify-between gap-2 px-3 py-2.5">
        <button type="button" onClick={() => date && go(addDays(date, -1))} className="btn btn-ghost px-3" aria-label={tr("Previous day")}>
          <span aria-hidden className="rtl:rotate-180 inline-block">←</span>
        </button>
        <div className="text-center min-w-0">
          <p className="text-[15px] font-semibold text-ink">{date && day ? dayName(date, day.today) : "…"}</p>
          {day && (
            <p className="text-[12px] text-ink-muted">
              {day.tests.length
                ? tr("{count} booked · {heard} heard", { count: day.tests.length, heard })
                : day.testDay
                  ? tr("Nothing booked")
                  : tr("Not a test day")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {day && date !== day.today && (
            <button type="button" onClick={() => go(day.today)} className="btn btn-ghost px-3 text-[13px]">
              {tr("Today")}
            </button>
          )}
          <button type="button" onClick={() => date && go(addDays(date, 1))} className="btn btn-ghost px-3" aria-label={tr("Next day")}>
            <span aria-hidden className="rtl:rotate-180 inline-block">→</span>
          </button>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {!day ? (
        <LoadingNote rows={4} />
      ) : day.tests.length === 0 ? (
        <EmptyNote>{day.testDay ? tr("No tests are booked for this day.") : tr("This day is closed to tests.")}</EmptyNote>
      ) : (
        <ul className="space-y-2.5">
          {day.tests.map((t) => {
            const status = testStatus(t, day.today);
            return (
              <li key={t.id} className="card-quiet p-4 flex items-start gap-3.5">
                <span className="w-10 h-10 rounded-full bg-brand-navy text-white grid place-items-center text-[15px] font-bold tabular-nums flex-shrink-0">
                  {t.slot}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-[15px] font-semibold text-ink">{t.student_name}</p>
                    <StatusPill status={status} waitingLabel={tr("Not yet")} />
                  </div>
                  <p className="text-[12px] text-ink-muted mt-0.5">
                    {tr("Juz {juz}", { juz: t.juz })}
                    {t.teacher_name ? ` · ${tr("Teacher: {name}", { name: t.teacher_name })}` : ""}
                    {t.mistakes ? ` · ${tr("{count} mistake|{count} mistakes", { count: t.mistakes })}` : ""}
                  </p>
                  {t.comment && <p className="text-[13px] text-ink-body font-serif italic leading-snug mt-1.5">“{t.comment}”</p>}
                </div>
                {date && date <= day.today && (
                  <Link href={testHref(t.id)} className={`btn ${t.result ? "btn-secondary" : "btn-primary"} flex-shrink-0`}>
                    {t.result ? tr("Open") : tr("Test")}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
