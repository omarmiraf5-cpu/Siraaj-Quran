"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { SectionCard } from "@/components/portal-ui";
import { callJuz, useJuzApi } from "@/hooks/useJuzTests";
import { levelLabel, testStatus, type JuzMistake, type JuzTest } from "@/lib/juzTests";
import { MistakeList, StatusPill, useDayName, useMistakeCount } from "@/components/juz-tests/shared";

interface Record {
  enabled: boolean;
  today?: string;
  summary?: { passed: number; failed: number; pending: number; level: number; passedJuz: number[] };
  tests?: JuzTest[];
  mistakes?: { [testId: string]: JuzMistake[] };
}

/**
 * A child's Juz tests, for their parent (and their teacher): Passed,
 * Failed, Pending and Level, then every test, which opens to the
 * examiner's comment and where each mistake was. Nothing at all for a
 * school that doesn't run Juz tests.
 */
export function JuzChildCard({ studentId, firstName, role = "parent" }: { studentId: string; firstName: string; role?: "parent" | "teacher" | "admin" }) {
  const { tr } = useLanguage();
  const dayName = useDayName();
  const count = useMistakeCount();
  const { mode, api } = useJuzApi(role);
  const [record, setRecord] = useState<Record | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "loading") return;
    let cancelled = false;
    setRecord(null);
    callJuz<Record>(api, `/api/juz-tests/student?student_id=${encodeURIComponent(studentId)}`)
      .then((r) => !cancelled && setRecord(r))
      .catch(() => !cancelled && setRecord({ enabled: false }));
    return () => {
      cancelled = true;
    };
  }, [mode, api, studentId]);

  if (!record?.enabled || !record.summary || !record.tests) return null;
  const { summary, tests } = record;
  const today = record.today ?? "";
  const shown = showAll ? tests : tests.slice(0, 4);

  const tiles = [
    { label: tr("Passed"), value: summary.passed, tone: "text-green-700 dark:text-green-300" },
    { label: tr("Failed"), value: summary.failed, tone: "text-red-700 dark:text-red-300" },
    { label: tr("Pending"), value: summary.pending, tone: "text-sky-700 dark:text-sky-300" },
    { label: tr("Level"), value: levelLabel(summary.level), tone: "text-ink" },
  ];

  return (
    <SectionCard title={tr("Juz tests")} note={tr("{name}'s record", { name: firstName })}>
      <div className="grid grid-cols-4 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-surface-bg px-2 py-3 text-center">
            <p className={`text-[22px] font-bold tabular-nums leading-none ${Number(t.value) === 0 ? "text-slate-400 dark:text-slate-500" : t.tone}`}>{t.value}</p>
            <p className="text-[11px] text-ink-muted mt-1.5">{t.label}</p>
          </div>
        ))}
      </div>
      {summary.passedJuz.length > 0 && (
        <p className="text-[12px] text-ink-muted mt-3">
          {tr("Juz passed: {list}", { list: [...summary.passedJuz].sort((a, b) => b - a).join(", ") })}
        </p>
      )}

      {tests.length === 0 ? (
        <p className="text-[13px] text-ink-muted mt-3">{tr("No Juz tests yet. Their teacher books each test when they're ready.")}</p>
      ) : (
        <ul className="divide-y divide-surface-border mt-3">
          {shown.map((t) => {
            const status = testStatus(t, today);
            const list = record.mistakes?.[t.id] ?? [];
            const isOpen = open === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : t.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-3 py-2.5 text-start"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-ink">{tr("Juz {juz}", { juz: t.juz })}</span>
                    <span className="block text-[12px] text-ink-muted">
                      {dayName(t.test_date, today)}
                      {list.length ? ` · ${count(list)}` : ""}
                    </span>
                  </span>
                  <StatusPill status={status} />
                </button>
                {isOpen && (
                  <div className="pb-3 ps-1 space-y-2">
                    <p className="text-[12px] text-ink-muted">
                      {tr("Booked on {day}", { day: dayName(t.created_at.slice(0, 10), today) })}
                      {t.tested_at ? ` · ${tr("Tested on {day}", { day: dayName(t.tested_at.slice(0, 10), today) })}` : ""}
                      {t.examiner_name ? ` · ${tr("Heard by {name}", { name: t.examiner_name })}` : ""}
                    </p>
                    {status === "missed" && <p className="text-[12px] text-ink-muted">{tr("This test's day went by without it being heard. Their teacher will book it again.")}</p>}
                    {t.comment && <p className="text-[13px] text-ink-body font-serif italic leading-snug">“{t.comment}”</p>}
                    {list.length > 0 && <MistakeList mistakes={list} />}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {tests.length > 4 && (
        <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-2 text-[13px] font-semibold text-ink underline underline-offset-2">
          {showAll ? tr("Show fewer") : tr("Show all {count} tests", { count: tests.length })}
        </button>
      )}
    </SectionCard>
  );
}
