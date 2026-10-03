"use client";

import { useState } from "react";
import { QAIDAH_LESSONS } from "@/data/qaidah";
import { ILLUM_CLASS, GRAD_CLASS, surahColour } from "@/components/student-ui";
import { IconArrow, IconCheck } from "@/components/icons";

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

export function QaidahBook() {
  const [openLesson, setOpenLesson] = useState<number | null>(1);

  return (
    <div className="space-y-3">
      {QAIDAH_LESSONS.map((lesson, i) => {
        const isOpen = openLesson === lesson.id;
        // Reuses the surah hash so the lesson numbers spread across the
        // palette instead of cycling in a visible pattern.
        const colour = surahColour(lesson.id * 3 + 1);

        return (
          <article
            key={lesson.id}
            className="card-quiet overflow-hidden animate-rise"
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
                    <div
                      key={r}
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

/** The short summary shown at the top of the Qa'idah page. */
export function QaidahSummary() {
  const letters = QAIDAH_LESSONS[0].rows.flat().length;
  return (
    <section className="card-quiet card-feature p-5">
      <div className="flex items-start gap-3.5">
        <span className={`${ILLUM_CLASS.verdigris} w-10 h-10 rounded-2xl flex-shrink-0`}>
          <IconCheck size={18} />
        </span>
        <div dir="ltr">
          <h2 className="page-title text-[16px]">How this works</h2>
          <p className="text-[13px] text-ink-body leading-relaxed mt-1">
            The {QAIDAH_LESSONS.length} lessons of Ahsanul Qawaid, numbered as in the
            book, from the {letters} letters to stopping at the end of an ayah.
            Work through them in order — each one assumes the one before it.
            Read every row aloud.
          </p>
        </div>
      </div>
    </section>
  );
}
