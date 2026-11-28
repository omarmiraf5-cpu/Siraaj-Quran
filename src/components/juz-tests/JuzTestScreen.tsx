"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { LoadingNote, Modal, SectionCard } from "@/components/portal-ui";
import { QcfMushafPage, usePageLayout, useCarriedWords, wordKey, type WordPlace } from "@/components/QcfMushafPage";
import { callJuz, useJuzApi } from "@/hooks/useJuzTests";
import { getSurahsOnPage } from "@/data/mushaf-index";
import { juzPages, testStatus, type JuzMistake, type JuzTest, type MistakeKind } from "@/lib/juzTests";
import { ErrorNote, MistakeList, StatusPill, useDayName, useMistakeCount, useSurahName } from "@/components/juz-tests/shared";

const field =
  "w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-gold/35 transition";

/**
 * Hearing one test: the Mushaf open on the Juz, a page at a time. Tapping a
 * word marks it as a tajweed or a memorization mistake, with a note if
 * wanted, and the word stays coloured. Pass or Fail and the comment go to
 * the child's teacher and parent.
 */
export function JuzTestScreen({ id, role, backHref }: { id: string; role: "teacher" | "admin"; backHref: string }) {
  const { tr } = useLanguage();
  const dayName = useDayName();
  const surahName = useSurahName();
  const count = useMistakeCount();
  const { mode, api } = useJuzApi(role);
  const [test, setTest] = useState<JuzTest | null>(null);
  const [mistakes, setMistakes] = useState<JuzMistake[]>([]);
  const [examiner, setExaminer] = useState(false);
  const [today, setToday] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const [picked, setPicked] = useState<(WordPlace & { page: number }) | null>(null);
  const [kind, setKind] = useState<MistakeKind>("tajweed");
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await callJuz<{ test: JuzTest; mistakes: JuzMistake[]; examiner: boolean; today: string }>(api, `/api/juz-tests/${id}`);
      setTest(r.test);
      setMistakes(r.mistakes);
      setExaminer(r.examiner);
      setToday(r.today);
      setComment(r.test.comment ?? "");
      setPage(juzPages(r.test.juz)[0]);
    } catch (e) {
      setError(tr((e as Error).message));
    }
  }, [api, id, tr]);
  useEffect(() => {
    if (mode !== "loading") load();
  }, [mode, load]);

  const [first, last] = test ? juzPages(test.juz) : [1, 1];
  const layout = usePageLayout(page);
  const carried = useCarriedWords(page, layout);
  const marks = useMemo(() => Object.fromEntries(mistakes.map((m) => [wordKey(m), m.kind])), [mistakes]);
  const existing = picked ? mistakes.find((m) => wordKey(m) === wordKey(picked)) : undefined;
  const canMark = examiner && !!test && test.test_date <= today;

  const openWord = (w: WordPlace, onPage = page) => {
    if (!canMark) return;
    const had = mistakes.find((m) => wordKey(m) === wordKey(w));
    setPicked({ ...w, page: onPage });
    setKind(had?.kind ?? "tajweed");
    setNote(had?.note ?? "");
  };

  const saveMistake = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      const r = await callJuz<{ mistakes: JuzMistake[] }>(api, `/api/juz-tests/${id}/mistakes`, "POST", { ...picked, kind, note });
      setMistakes(r.mistakes);
      setPicked(null);
    } catch (e) {
      setError(tr((e as Error).message));
    } finally {
      setSaving(false);
    }
  };
  const removeMistake = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      const r = await callJuz<{ mistakes: JuzMistake[] }>(api, `/api/juz-tests/${id}/mistakes?mistake_id=${encodeURIComponent(existing.id)}`, "DELETE");
      setMistakes(r.mistakes);
      setPicked(null);
    } catch (e) {
      setError(tr((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  const decide = async (result: "pass" | "fail") => {
    setSaving(true);
    setSaved("");
    try {
      const r = await callJuz<{ test: JuzTest }>(api, `/api/juz-tests/${id}`, "PATCH", { result, comment });
      setTest(r.test);
      setSaved(result === "pass" ? tr("Saved: passed.") : tr("Saved: failed."));
    } catch (e) {
      setError(tr((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  if (!test) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Link href={backHref} className="text-[13px] font-semibold text-ink-muted hover:text-ink"><span aria-hidden className="inline-block rtl:rotate-180">←</span> {tr("Back to the day's tests")}</Link>
        {error ? <ErrorNote>{error}</ErrorNote> : <LoadingNote rows={5} />}
      </div>
    );
  }

  const surahsHere = getSurahsOnPage(page);
  const status = testStatus(test, today);

  return (
    <div className="space-y-4 max-w-3xl">
      <Link href={backHref} className="text-[13px] font-semibold text-ink-muted hover:text-ink"><span aria-hidden className="inline-block rtl:rotate-180">←</span> {tr("Back to the day's tests")}</Link>

      <div className="card-quiet p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="w-11 h-11 rounded-full bg-brand-navy text-white grid place-items-center text-[16px] font-bold tabular-nums">{test.slot}</span>
        <div className="min-w-0 flex-1">
          <p className="page-title text-xl">{test.student_name}</p>
          <p className="text-[13px] text-ink-muted">
            {tr("Juz {juz}", { juz: test.juz })} · {tr("page {page}", { page })} · {surahsHere.map((s) => surahName(s.id)).join(" · ")}
          </p>
          <p className="text-[12px] text-ink-muted">
            {dayName(test.test_date, today)}
            {test.teacher_name ? ` · ${tr("Teacher: {name}", { name: test.teacher_name })}` : ""}
          </p>
        </div>
        <StatusPill status={status} waitingLabel={tr("Not yet")} />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {canMark && <p className="text-[12px] text-ink-muted">{tr("Tap a word to mark a mistake. Amber is tajweed, red is memorization.")}</p>}

      <div className="mushaf-root">
        <div className="mushaf-page relative mx-auto bg-[var(--mushaf-page)] text-[var(--mushaf-ink)] flex flex-col aspect-[1/1.545] overflow-hidden rounded-sm shadow-[0_1px_4px_rgba(60,45,20,0.12)]">
          <div className="relative px-[5%] pt-[3%] pb-[4%] flex flex-col flex-1 min-h-0" dir="rtl" lang="ar">
            <QcfMushafPage
              pageNum={page}
              layout={carried === null ? null : layout}
              playingKey={null}
              onAyahClick={() => {}}
              onWordClick={canMark ? (w) => openWord(w) : undefined}
              wordMarks={marks}
              carriedWords={carried ?? 0}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2" dir="ltr">
        {/* The Mushaf turns to the left: the next page is on the left. */}
        <button type="button" disabled={page >= last} onClick={() => setPage((p) => Math.min(last, p + 1))} className="btn btn-secondary">
          ← {tr("Next page")}
        </button>
        <span className="text-[13px] text-ink-muted tabular-nums">
          {page - first + 1} / {last - first + 1}
        </span>
        <button type="button" disabled={page <= first} onClick={() => setPage((p) => Math.max(first, p - 1))} className="btn btn-secondary">
          {tr("Previous page")} →
        </button>
      </div>

      <SectionCard title={tr("Mistakes")} note={mistakes.length ? count(mistakes) : undefined}>
        <MistakeList
          mistakes={mistakes}
          onPick={
            canMark
              ? (m) => {
                  setPage(m.page);
                  openWord(m, m.page);
                }
              : (m) => setPage(m.page)
          }
        />
      </SectionCard>

      <SectionCard title={tr("Result")} note={test.tested_at && test.examiner_name ? tr("Heard by {name}", { name: test.examiner_name }) : undefined}>
        {canMark ? (
          <div className="space-y-3">
            <label className="block">
              <span className="block text-[12px] font-semibold text-ink-muted mb-1.5">{tr("Comment for the teacher and parent")}</span>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000} className={`${field} resize-none`} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => decide("pass")}
                className={`btn ${test.result === "pass" ? "bg-green-700 text-white" : "btn-secondary"} w-full`}
              >
                ✓ {tr("Pass")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => decide("fail")}
                className={`btn ${test.result === "fail" ? "bg-red-700 text-white" : "btn-secondary"} w-full`}
              >
                ✕ {tr("Fail")}
              </button>
            </div>
            {saved && <p className="text-[13px] font-semibold text-green-700 dark:text-green-300">{saved}</p>}
          </div>
        ) : test.comment ? (
          <p className="text-[14px] text-ink-body font-serif italic">“{test.comment}”</p>
        ) : (
          <p className="text-[13px] text-ink-muted">{test.test_date > today ? tr("This test is booked for a later day.") : tr("No result yet.")}</p>
        )}
      </SectionCard>

      {picked && (
        <Modal
          title={existing ? tr("Change this mistake") : tr("Mark a mistake")}
          subtitle={`${surahName(picked.surah)} ${picked.surah}:${picked.ayah} · ${tr("word {word}", { word: picked.word })}`}
          onClose={() => setPicked(null)}
        >
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(["tajweed", "memorization"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  className={`rounded-xl border-2 px-3 py-3 text-[14px] font-semibold transition ${
                    kind === k
                      ? k === "tajweed"
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200"
                        : "border-red-600 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200"
                      : "border-surface-border text-ink"
                  }`}
                >
                  {k === "tajweed" ? tr("Tajweed") : tr("Memorization")}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="block text-[12px] font-semibold text-ink-muted mb-1.5">{tr("Note (optional)")}</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={field} placeholder={tr("e.g. Madd too short")} />
            </label>
            <div className="flex gap-2">
              <button type="button" disabled={saving} onClick={saveMistake} className="btn btn-primary flex-1">
                {tr("Save")}
              </button>
              {existing && (
                <button type="button" disabled={saving} onClick={removeMistake} className="btn btn-destructive">
                  {tr("Remove")}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
