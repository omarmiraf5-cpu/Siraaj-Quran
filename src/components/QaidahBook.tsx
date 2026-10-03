"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  DEFAULT_QAIDAH_BOOK,
  QAIDAH_BOOKS,
  isQaidahBookId,
  type QaidahBook,
  type QaidahBookId,
} from "@/data/qaidah";
import type { QaidahStatus } from "@/lib/qaidahLessons";
import { ILLUM_CLASS, GRAD_CLASS, surahColour } from "@/components/student-ui";
import { IconArrow, IconCheck } from "@/components/icons";
import { useLanguage } from "@/components/LanguageProvider";

// The Qa'idah is read, not skimmed: the Arabic is the content, so it is set
// large enough to read across a table and each lesson opens on its own rather
// than the whole primer unrolling down the page.

/** Harakat, the Qur'anic signs above and below letters, and the joining stroke. */
const MARKS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

/** Letters (and spaces) without their marks: اَبَّ is five characters but two letters. */
function letterCount(item: string) {
  return item.replace(MARKS, "").length;
}

/**
 * A letter or two (بَ, اَبْ, لا) fits a uniform square, so a row of them lines
 * up; anything longer, like قلم with no marks at all, keeps its natural width.
 */
function isShort(item: string) {
  return !/\s/.test(item) && letterCount(item) <= 2;
}

/** A run of Arabic, with the spaces between its words. */
const ARABIC_RUN =
  /([\u0600-\u06FF\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+(?:\s+[\u0600-\u06FF\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)*)/;

/**
 * An explanation in English with Arabic in it. Each Arabic run is set in the
 * Qur'anic face, which has the standing harakat the interface face lacks, and
 * isolated so the punctuation around it keeps the English order: left to the
 * browser, "ح and ه, ع and ء" comes out as "ح and ع ,ه and ء".
 */
function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split(ARABIC_RUN).map((part, i) =>
        i % 2 === 1 ? (
          <bdi key={i} lang="ar" className="font-arabic text-[1.25em] leading-none">
            {part}
          </bdi>
        ) : (
          part
        )
      )}
    </>
  );
}

/** One book's lessons, each opening on its own. */
export function QaidahLessons({
  book,
  open,
  onOpenChange,
  current,
  passed = [],
  counts,
}: {
  book: QaidahBook;
  /** The open lesson, where the page decides it; otherwise the child's own, or the first. */
  open?: number | null;
  onOpenChange?: (lesson: number | null) => void;
  /** The child's own lesson in this book, marked out. */
  current?: { lesson: number; status: QaidahStatus };
  /** Lessons the child has passed in this book, ticked. */
  passed?: number[];
  /** How many of the teacher's students are on each lesson. */
  counts?: Record<number, number>;
}) {
  const { t } = useLanguage();
  const [ownOpen, setOwnOpen] = useState<number | null>(current?.lesson ?? 1);
  const openLesson = open !== undefined ? open : ownOpen;
  const setOpenLesson = onOpenChange ?? setOwnOpen;

  return (
    <div className="space-y-3">
      {book.lessons.map((lesson, i) => {
        const isOpen = openLesson === lesson.id;
        const isCurrent = current?.lesson === lesson.id;
        const isPassed = !isCurrent && passed.includes(lesson.id);
        const count = counts?.[lesson.id] ?? 0;
        // Reuses the surah hash so the lesson numbers spread across the
        // palette instead of cycling in a visible pattern.
        const colour = surahColour(lesson.id * 3 + 1);

        return (
          <article
            key={lesson.id}
            id={`qaidah-${book.id}-${lesson.id}`}
            className={`card-quiet overflow-hidden animate-rise scroll-mt-4 ${
              isCurrent ? "ring-2 ring-brand-gold/70" : ""
            }`}
            style={{ animationDelay: `${40 + i * 35}ms` }}
          >
            <button
              type="button"
              onClick={() => setOpenLesson(isOpen ? null : lesson.id)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-3.5 p-4 text-start hover:bg-surface-bg-warm transition-colors"
            >
              <span
                className={`${GRAD_CLASS[colour]} w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-[15px] flex-shrink-0 shadow-sm`}
              >
                {lesson.id}
              </span>

              {/* The lesson's aim lives in the body, not here — it was
                  printed in both places, so an open lesson said the same
                  sentence twice. */}
              <span className="flex-1 min-w-0">
                {/* Wraps rather than truncating: on a phone most of the
                    book's lesson names are longer than one line. */}
                <span className="block page-title text-[16px] leading-snug">{lesson.title}</span>
                <span
                  className="block font-arabic text-[15px] text-ink-muted mt-0.5 truncate"
                  dir="rtl"
                  lang="ar"
                >
                  {lesson.arabicTitle}
                </span>
                {(isCurrent || isPassed || count > 0) && (
                  <span className="flex flex-wrap gap-1.5 mt-1.5">
                    {isCurrent && (
                      <span
                        className={`${
                          ILLUM_CLASS[current.status === "repeat" ? "vermilion" : "saffron"]
                        } !inline-flex !rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide`}
                      >
                        {current.status === "repeat"
                          ? t("qaidah.statusRepeat")
                          : current.status === "passed"
                            ? t("qaidah.statusPassed")
                            : t("qaidah.yourLesson")}
                      </span>
                    )}
                    {isPassed && (
                      <span
                        className={`${ILLUM_CLASS.verdigris} !inline-flex !rounded-full gap-1 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide`}
                      >
                        <IconCheck size={11} />
                        {t("qaidah.statusPassed")}
                      </span>
                    )}
                    {count > 0 && (
                      <span className="inline-flex rounded-full bg-surface-bg-warm border border-surface-border px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                        {count} {t("qaidah.onThisLesson")}
                      </span>
                    )}
                  </span>
                )}
              </span>

              <span
                className={`text-ink-muted flex-shrink-0 transition-transform ${
                  isOpen ? "rotate-90" : ""
                }`}
              >
                <IconArrow size={15} />
              </span>
            </button>

            {isOpen && (
              <div className="px-4 pb-5">
                <div className="gold-rule mb-4" />

                {/* The explanations are English whatever the interface
                    language, so they keep left-to-right under Arabic too. */}
                <p dir="ltr" className="text-[13px] text-ink-body leading-relaxed">
                  <Prose text={lesson.teaches} />
                </p>

                {/* Where the reading isn't what's printed — a letter that is
                    skipped, a word stopped on — each word as printed, with
                    how it's read underneath. */}
                {lesson.readings && (
                  <div className="mt-4 space-y-2.5">
                    {lesson.readings.map((group, g) => (
                      <div
                        key={g}
                        className="rounded-2xl bg-surface-bg-warm border border-surface-border p-2.5"
                      >
                        {group.label && (
                          <p dir="ltr" className="text-[11.5px] font-semibold text-ink-muted text-center mb-2">
                            {group.label}
                          </p>
                        )}
                        <div dir="rtl" className="flex flex-wrap gap-1.5 justify-center">
                          {group.words.map(([printed, read]) => (
                            <span
                              key={printed}
                              className="rounded-xl bg-surface-card border border-surface-border p-1.5 flex flex-col items-center gap-0.5"
                            >
                              <span lang="ar" className="font-arabic text-ink text-[23px] leading-[1.9] px-2">
                                {printed}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                                read as
                              </span>
                              <span
                                lang="ar"
                                className={`${ILLUM_CLASS.verdigris} !rounded-lg w-full font-arabic text-[21px] leading-[1.9] px-2.5`}
                              >
                                {read}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* The rows themselves, right to left. */}
                <div className="mt-4 space-y-2.5">
                  {lesson.rows.map((row, r) => (
                    <Fragment key={r}>
                      {lesson.rowLabels?.[r] && (
                        <p dir="ltr" className="text-[11.5px] font-semibold text-ink-muted text-center pt-1.5">
                          <Prose text={lesson.rowLabels[r]} />
                        </p>
                      )}
                      <div
                        dir="rtl"
                        lang="ar"
                        className="flex flex-wrap gap-1.5 justify-center rounded-2xl bg-surface-bg-warm border border-surface-border p-2.5"
                      >
                        {row.map((item, c) => {
                          const short = isShort(item);
                          return (
                            <span
                              key={`${r}-${c}`}
                              className={`font-arabic text-ink rounded-xl bg-surface-card border border-surface-border flex items-center justify-center ${
                                short
                                  ? "w-[46px] h-[52px] text-[27px]"
                                  : `min-h-[52px] px-3 py-1.5 ${
                                      letterCount(item) > 24 ? "text-[19px]" : "text-[23px]"
                                    }`
                              } leading-[1.9]`}
                            >
                              {item}
                            </span>
                          );
                        })}
                      </div>
                    </Fragment>
                  ))}
                </div>

                {lesson.note && (
                  <div dir="ltr" className={`${ILLUM_CLASS[colour]} rounded-2xl px-4 py-3 mt-4 !block`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1">
                      For the teacher
                    </p>
                    <p className="text-[13px] leading-snug">
                      <Prose text={lesson.note} />
                    </p>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

/** What working through the book involves, shown above its lessons. */
export function QaidahSummary({ book }: { book: QaidahBook }) {
  return (
    <section className="card-quiet card-feature p-5">
      <div className="flex items-start gap-3.5">
        <span className={`${ILLUM_CLASS.verdigris} w-10 h-10 rounded-2xl flex-shrink-0`}>
          <IconCheck size={18} />
        </span>
        <div dir="ltr">
          <h2 className="page-title text-[16px]">How this works</h2>
          <p className="text-[13px] text-ink-body leading-relaxed mt-1">
            {book.summary} Work through the lessons in order — each one assumes the one
            before it. Read every row aloud.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Which book: the three side by side, each with its Arabic name. */
export function QaidahBookTabs({
  value,
  onChange,
}: {
  value: QaidahBookId;
  onChange: (book: QaidahBookId) => void;
}) {
  const { t } = useLanguage();
  return (
    <div role="tablist" aria-label={t("qaidah.book")} className="grid grid-cols-3 gap-2">
      {QAIDAH_BOOKS.map((b) => {
        const active = b.id === value;
        return (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(b.id)}
            className={`rounded-2xl border px-2.5 py-2.5 text-center transition-all ${
              active
                ? "bg-brand-navy border-brand-navy text-white shadow-sm"
                : "bg-surface-card border-surface-border text-ink hover:border-brand-gold/60"
            }`}
          >
            <span className="block text-[13px] font-semibold leading-tight">{b.name}</span>
            <span
              className={`block font-arabic text-[13px] leading-snug mt-0.5 ${
                active ? "text-brand-gold-light" : "text-ink-muted"
              }`}
              dir="rtl"
              lang="ar"
            >
              {b.arabicName}
            </span>
            <span className={`block text-[11px] mt-0.5 ${active ? "text-white/60" : "text-ink-muted"}`}>
              {b.lessons.length} {t("qaidah.lessonsCount")}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const BOOK_KEY = "mydiiwaan_qaidah_book";

/**
 * The book on screen, remembered in this browser so a school that teaches
 * from one book opens on it. A child's own lesson can show its book without
 * changing what's remembered.
 */
export function useQaidahBookChoice(): [QaidahBookId, (book: QaidahBookId, remember?: boolean) => void] {
  const [book, setBook] = useState<QaidahBookId>(DEFAULT_QAIDAH_BOOK);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BOOK_KEY);
      if (isQaidahBookId(stored)) setBook(stored);
    } catch {
      // No storage (private browsing): the default book it is.
    }
  }, []);
  const choose = useCallback((next: QaidahBookId, remember = true) => {
    setBook(next);
    if (!remember) return;
    try {
      localStorage.setItem(BOOK_KEY, next);
    } catch {
      // Still shown for this visit.
    }
  }, []);
  return [book, choose];
}
