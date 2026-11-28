"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { EmptyNote, LoadingNote, SectionCard } from "@/components/portal-ui";
import { callJuz, useJuzApi } from "@/hooks/useJuzTests";
import { testStatus, type JuzMistake, type JuzTest } from "@/lib/juzTests";
import { ErrorNote, MistakeList, StatusPill, useDayName, useMistakeCount } from "@/components/juz-tests/shared";

interface BookingPage {
  enabled: boolean;
  examiner: boolean;
  office: boolean;
  today: string;
  slots: number;
  days?: Array<{ date: string; booked: number }>;
  students?: Array<{ id: string; name: string; halaqa: string | null; passed: number[]; waiting: Array<{ juz: number; date: string }> }>;
  tests?: JuzTest[];
}

type Refusal = { code?: string; name?: string; juz?: number; date?: string; next_date?: string | null };

const field =
  "w-full min-h-11 bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-gold/35 transition";

/**
 * Booking Juz tests: a teacher picks one of their students, the Juz and a
 * day, and the test takes the day's next number. Below, what's booked and
 * the results of the last two months. The office books any student, and
 * can add an extra test to a full day.
 */
export function JuzBooking({ role, examineHref, heading = true }: { role: "teacher" | "admin"; examineHref: string; heading?: boolean }) {
  const { tr } = useLanguage();
  const dayName = useDayName();
  const { mode, api } = useJuzApi(role);
  const [page, setPage] = useState<BookingPage | null>(null);
  const [loadError, setLoadError] = useState("");

  const [studentId, setStudentId] = useState("");
  const [juz, setJuz] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [extra, setExtra] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<{ text: string; next?: string | null } | null>(null);
  const [done, setDone] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await callJuz<BookingPage>(api, "/api/juz-tests");
      setPage(data);
      setLoadError("");
    } catch (e) {
      setLoadError(tr((e as Error).message));
    }
  }, [api, tr]);

  useEffect(() => {
    if (mode !== "loading") load();
  }, [mode, load]);

  const student = page?.students?.find((s) => s.id === studentId) ?? null;
  // Their next Juz: the one below the lowest they've passed, the way hifz goes from 30.
  useEffect(() => {
    if (!student) return;
    const blocked = new Set([...student.passed, ...student.waiting.map((w) => w.juz)]);
    const lowest = student.passed.length ? Math.min(...student.passed) : 31;
    const guess = [...Array(30)].map((_, i) => lowest - 1 - i).find((j) => j >= 1 && !blocked.has(j));
    setJuz(guess ?? null);
    setRefusal(null);
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!date && page?.days?.length) setDate(page.days.find((d) => d.booked < page.slots)?.date ?? page.days[0].date);
  }, [page, date]);

  const explain = (r: Refusal, fallback: string): { text: string; next?: string | null } => {
    if (r.code === "passed") return { text: tr("{name} has already passed Juz {juz}.", { name: r.name ?? "", juz: r.juz ?? "" }) };
    if (r.code === "booked")
      return r.date
        ? { text: tr("{name} already has Juz {juz} booked: {day}", { name: r.name ?? "", juz: r.juz ?? "", day: dayName(r.date, page!.today) }) }
        : { text: tr("{name} is already booked for Juz {juz}.", { name: r.name ?? "", juz: r.juz ?? "" }) };
    if (r.code === "full")
      return r.next_date
        ? { text: tr("{day} is full. Next day with room: {next}", { day: dayName(r.date ?? date, page!.today), next: dayName(r.next_date, page!.today) }), next: r.next_date }
        : { text: tr("{day} is full, and so is every test day in the next six weeks.", { day: dayName(r.date ?? date, page!.today) }) };
    return { text: tr(fallback) };
  };

  const book = async (on: string) => {
    if (!student || !juz || !on) return;
    setBusy(true);
    setRefusal(null);
    setDone("");
    try {
      const { test } = await callJuz<{ test: JuzTest }>(api, "/api/juz-tests", "POST", { student_id: student.id, juz, date: on, extra });
      setDone(
        tr("Booked: {name}, Juz {juz}, {day}, number {slot}.", {
          name: test.student_name,
          juz: test.juz,
          day: dayName(test.test_date, page!.today),
          slot: test.slot,
        })
      );
      setDate(on);
      setExtra(false);
      await load();
    } catch (e) {
      setRefusal(explain(((e as { data?: Refusal }).data ?? {}) as Refusal, (e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (t: JuzTest) => {
    try {
      await callJuz(api, `/api/juz-tests?id=${encodeURIComponent(t.id)}`, "DELETE");
      await load();
    } catch (e) {
      setLoadError(tr((e as Error).message));
    }
  };

  const today = page?.today ?? "";
  const upcoming = useMemo(() => (page?.tests ?? []).filter((t) => testStatus(t, today) === "booked").sort((a, b) => a.test_date.localeCompare(b.test_date) || a.slot - b.slot), [page, today]);
  const results = useMemo(() => (page?.tests ?? []).filter((t) => testStatus(t, today) !== "booked"), [page, today]);
  const chosenDay = page?.days?.find((d) => d.date === date);
  const dayFull = !!chosenDay && chosenDay.booked >= (page?.slots ?? 10);

  return (
    <div className="space-y-4 max-w-3xl">
      {heading && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">{tr("Hifz")}</p>
            <h1 className="page-title text-2xl md:text-3xl">{tr("Juz tests")}</h1>
          </div>
          {page?.enabled && page.examiner && (
            <Link href={examineHref} className="btn btn-primary">
              {tr("Examine today’s tests")} <span aria-hidden className="inline-block rtl:rotate-180">→</span>
            </Link>
          )}
        </div>
      )}

      {loadError && <ErrorNote>{loadError}</ErrorNote>}
      {!page ? (
        <LoadingNote rows={4} />
      ) : !page.enabled ? (
        <EmptyNote>
          {role === "admin"
            ? tr("Juz tests are switched off. Turn them on in Settings below.")
            : tr("Juz tests aren't switched on for this school. The office can turn them on.")}
        </EmptyNote>
      ) : (
        <>
          <SectionCard title={tr("Book a test")} note={tr("{count} a day", { count: page.slots })}>
            {(page.students ?? []).length === 0 ? (
              <EmptyNote>{tr("You have no students yet. Once the office puts children in your halaqa, you can book their tests here.")}</EmptyNote>
            ) : (
              <div className="space-y-4">
                <label className="block">
                  <span className="block text-[12px] font-semibold text-ink-muted mb-1.5">{tr("Student")}</span>
                  <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={field}>
                    <option value="">{tr("Choose a student…")}</option>
                    {(page.students ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.halaqa ? ` · ${s.halaqa}` : ""}
                        {s.passed.length ? ` · ${tr("{count} passed", { count: s.passed.length })}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {student && (
                  <div>
                    <span className="block text-[12px] font-semibold text-ink-muted mb-1.5">{tr("Juz")}</span>
                    <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5" dir="ltr">
                      {Array.from({ length: 30 }, (_, i) => 30 - i).map((j) => {
                        const passed = student.passed.includes(j);
                        const waiting = student.waiting.find((w) => w.juz === j);
                        const picked = juz === j;
                        return (
                          <button
                            key={j}
                            type="button"
                            disabled={passed || !!waiting}
                            onClick={() => {
                              setJuz(j);
                              setRefusal(null);
                            }}
                            title={passed ? tr("Passed") : waiting ? tr("Booked for {day}", { day: dayName(waiting.date, today) }) : undefined}
                            className={`h-10 rounded-lg text-[13px] font-semibold tabular-nums border transition ${
                              picked
                                ? "bg-brand-navy text-white border-brand-navy"
                                : passed
                                  ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900 cursor-not-allowed"
                                  : waiting
                                    ? "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900 cursor-not-allowed"
                                    : "bg-surface-card text-ink border-surface-border hover:border-brand-navy"
                            }`}
                          >
                            {passed ? "✓" : j}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-ink-muted mt-1.5">
                      {tr("✓ passed")} · <span className="text-sky-700 dark:text-sky-300">{tr("blue: booked")}</span>
                    </p>
                  </div>
                )}

                <div>
                  <span className="block text-[12px] font-semibold text-ink-muted mb-1.5">{tr("Day")}</span>
                  {(page.days ?? []).length === 0 ? (
                    <EmptyNote>{tr("No test days are open in the next few weeks. The office can open days for tests.")}</EmptyNote>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(page.days ?? []).map((d) => {
                        const left = page.slots - d.booked;
                        const picked = d.date === date;
                        return (
                          <button
                            key={d.date}
                            type="button"
                            onClick={() => {
                              setDate(d.date);
                              setRefusal(null);
                            }}
                            className={`rounded-xl border px-3 py-2 text-start transition ${
                              picked ? "bg-brand-navy text-white border-brand-navy" : "bg-surface-card border-surface-border hover:border-brand-navy"
                            }`}
                          >
                            <span className="block text-[13px] font-semibold">{dayName(d.date, today)}</span>
                            <span className={`block text-[11px] ${picked ? "text-white/80" : left <= 0 ? "text-red-700 dark:text-red-300" : "text-ink-muted"}`}>
                              {left <= 0 ? tr("Full") : tr("{left} of {slots} free", { left, slots: page.slots })}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {page.office && dayFull && (
                  <label className="flex items-center gap-2 text-[13px] text-ink">
                    <input type="checkbox" checked={extra} onChange={(e) => setExtra(e.target.checked)} />
                    {tr("Add an extra test to this full day")}
                  </label>
                )}

                {refusal && (
                  <div className="space-y-2">
                    <ErrorNote>{refusal.text}</ErrorNote>
                    {refusal.next && (
                      <button type="button" disabled={busy} onClick={() => book(refusal.next!)} className="btn btn-secondary">
                        {tr("Book {day} instead", { day: dayName(refusal.next, today) })}
                      </button>
                    )}
                  </div>
                )}
                {done && <p className="text-[13px] text-green-700 dark:text-green-300 font-semibold">{done}</p>}

                <button type="button" disabled={!student || !juz || !date || busy} onClick={() => book(date)} className="btn btn-primary w-full sm:w-auto">
                  {student && juz && date
                    ? tr("Book Juz {juz} for {name}, {day}", { juz, name: student.name.split(" ")[0], day: dayName(date, today) })
                    : tr("Book the test")}
                </button>
              </div>
            )}
          </SectionCard>

          <SectionCard title={tr("Booked")} note={upcoming.length ? tr("{count} waiting", { count: upcoming.length }) : undefined}>
            {upcoming.length === 0 ? (
              <EmptyNote>{tr("Nothing booked yet.")}</EmptyNote>
            ) : (
              <ul className="divide-y divide-surface-border">
                {upcoming.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-8 h-8 rounded-full bg-surface-bg grid place-items-center text-[12px] font-bold tabular-nums text-ink flex-shrink-0">{t.slot}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold text-ink truncate">{t.student_name}</span>
                      <span className="block text-[12px] text-ink-muted">
                        {tr("Juz {juz}", { juz: t.juz })} · {dayName(t.test_date, today)}
                      </span>
                    </span>
                    <button type="button" onClick={() => cancel(t)} className="text-[12px] font-semibold text-red-700 dark:text-red-300 hover:underline">
                      {tr("Cancel")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title={tr("Results")} note={tr("Last two months")}>
            {results.length === 0 ? (
              <EmptyNote>{tr("No results yet.")}</EmptyNote>
            ) : (
              <ul className="divide-y divide-surface-border">
                {results.map((t) => (
                  <ResultRow key={t.id} test={t} today={today} api={api} />
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

/** One result: tap it for the examiner's comment and every mistake. */
export function ResultRow({ test, today, api }: { test: JuzTest; today: string; api: ReturnType<typeof useJuzApi>["api"] }) {
  const { tr } = useLanguage();
  const dayName = useDayName();
  const count = useMistakeCount();
  const [open, setOpen] = useState(false);
  const [mistakes, setMistakes] = useState<JuzMistake[] | null>(null);
  const status = testStatus(test, today);
  const toggle = async () => {
    setOpen((o) => !o);
    if (mistakes || test.mistakes === 0) return;
    try {
      const r = await callJuz<{ mistakes: JuzMistake[] }>(api, `/api/juz-tests/${test.id}`);
      setMistakes(r.mistakes);
    } catch {
      setMistakes([]);
    }
  };
  return (
    <li>
      <button type="button" onClick={toggle} aria-expanded={open} className="w-full flex items-center gap-3 py-2.5 text-start">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-ink truncate">{test.student_name}</span>
          <span className="block text-[12px] text-ink-muted">
            {tr("Juz {juz}", { juz: test.juz })} · {dayName(test.test_date, today)}
            {test.mistakes ? ` · ${tr("{count} mistake|{count} mistakes", { count: test.mistakes })}` : ""}
          </span>
        </span>
        <StatusPill status={status} />
      </button>
      {open && (
        <div className="pb-3 ps-1 space-y-2">
          {status === "missed" ? (
            <p className="text-[12px] text-ink-muted">{tr("This test's day went by without it being heard. Book it again when the student is ready.")}</p>
          ) : (
            <>
              <p className="text-[12px] text-ink-muted">
                {test.examiner_name ? tr("Heard by {name}", { name: test.examiner_name }) : ""}
                {mistakes && mistakes.length ? ` · ${count(mistakes)}` : ""}
              </p>
              {test.comment && <p className="text-[13px] text-ink-body font-serif italic leading-snug">“{test.comment}”</p>}
              {test.mistakes > 0 && (mistakes ? <MistakeList mistakes={mistakes} /> : <p className="text-[12px] text-ink-muted">{tr("Loading…")}</p>)}
            </>
          )}
        </div>
      )}
    </li>
  );
}
