"use client";

import { useState } from "react";
import { QAIDAH_LESSONS } from "@/data/qaidah";
import { ILLUM_CLASS, GRAD_CLASS, surahColour } from "@/components/student-ui";
import { IconArrow, IconCheck } from "@/components/icons";

// The Qa'idah is read, not skimmed: the Arabic is the content, so it is set
// large enough to read across a table and each lesson opens on its own rather
// than the whole primer unrolling down the page.

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
              className="w-full flex items-center gap-3.5 p-4 text-left hover:bg-surface-bg-warm transition-colors"
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
                <span className="block page-title text-[16px] truncate">{lesson.title}</span>
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

                <p className="text-[13px] text-ink-body leading-relaxed">{lesson.teaches}</p>

                {/* The rows themselves, right to left. Short items get a
                    uniform square so a row of letters lines up instead of
                    each tile sizing to its own glyph; anything longer than a
                    few characters keeps its natural width. */}
                <div className="mt-4 space-y-2.5">
                  {lesson.rows.map((row, r) => (
                    <div
                      key={r}
                      dir="rtl"
                      lang="ar"
                      className="flex flex-wrap gap-1.5 justify-center rounded-2xl bg-surface-bg-warm border border-surface-border p-2.5"
                    >
                      {row.map((item, c) => {
                        const short = item.length <= 4;
                        return (
                          <span
                            key={`${r}-${c}`}
                            className={`font-arabic text-ink rounded-xl bg-surface-card border border-surface-border flex items-center justify-center ${
                              short
                                ? "w-[46px] h-[52px] text-[27px]"
                                : `min-h-[52px] px-3 py-1.5 ${
                                    item.length > 14 ? "text-[19px]" : "text-[23px]"
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
                  <div className={`${ILLUM_CLASS[colour]} rounded-2xl px-4 py-3 mt-4 !block`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1">
                      For the teacher
                    </p>
                    <p className="text-[13px] leading-snug">{lesson.note}</p>
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
        <div>
          <h2 className="page-title text-[16px]">How this works</h2>
          <p className="text-[13px] text-ink-body leading-relaxed mt-1">
            {QAIDAH_LESSONS.length} lessons, starting from the {letters} letters and
            ending with reading from the Mushaf itself. Work through them in
            order — each one assumes the one before it. Read every row aloud.
          </p>
        </div>
      </div>
    </section>
  );
}
