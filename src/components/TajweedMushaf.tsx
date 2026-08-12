"use client";

import { useState, useCallback } from "react";
import { QURAN, getPageAyahs, getSurahById, TOTAL_PAGES, SurahData } from "@/data/quran-text";
import { getLetterRules, TajweedRule, TAJWEED_RULES } from "@/lib/tajweed-rules";

interface HighlightRange {
  surah: number;
  start: number;
  end: number;
}

interface TajweedMushafProps {
  initialPage?: number;
  highlightedRange?: HighlightRange;
  showTajweed?: boolean;
}

function TajweedTooltip({ rules, children }: { rules: TajweedRule[]; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  if (rules.length === 0) return <>{children}</>;
  const rule = rules[0];

  return (
    <span className="relative inline">
      <span
        className={`cursor-help ${rule.color}`}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onTouchStart={() => setShow(true)}
        onTouchEnd={() => setTimeout(() => setShow(false), 2000)}
      >
        {children}
      </span>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-lg p-2 whitespace-nowrap pointer-events-none shadow-lg">
          <span className="font-semibold">{rule.name}</span>
          <br />
          <span className="opacity-80">{rule.description}</span>
        </span>
      )}
    </span>
  );
}

export function TajweedMushaf({
  initialPage = 1,
  highlightedRange,
  showTajweed = true,
}: TajweedMushafProps) {
  const [page, setPage] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [showLegend, setShowLegend] = useState(false);
  const [surahJump, setSurahJump] = useState("");

  const pageAyahs = getPageAyahs(page);

  const goTo = useCallback((p: number) => {
    const clamped = Math.max(1, Math.min(TOTAL_PAGES, p));
    setPage(clamped);
    setPageInput(String(clamped));
  }, []);

  const handlePageInput = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(pageInput);
    if (!isNaN(n)) goTo(n);
  };

  const handleSurahJump = (surahId: string) => {
    setSurahJump(surahId);
    if (!surahId) return;
    const id = parseInt(surahId);
    const surah = getSurahById(id);
    if (surah && surah.ayahs.length > 0) {
      goTo(surah.ayahs[0].p);
    }
  };

  const isHighlighted = (surahId: number, ayahNum: number) => {
    if (!highlightedRange) return false;
    return surahId === highlightedRange.surah &&
      ayahNum >= highlightedRange.start &&
      ayahNum <= highlightedRange.end;
  };

  const renderTajweedText = (text: string) => {
    if (!showTajweed) return text;
    return text.split("").map((char, idx) => {
      const rules = getLetterRules(char);
      if (rules.length === 0) return <span key={idx}>{char}</span>;
      return (
        <TajweedTooltip key={idx} rules={rules}>
          <span className={rules[0].color}>{char}</span>
        </TajweedTooltip>
      );
    });
  };

  // Group ayahs by surah for display
  const surahGroups: { surah: SurahData; ayahs: { n: number; t: string; p: number }[] }[] = [];
  let currentSurahId = -1;
  for (const item of pageAyahs) {
    if (item.surah.id !== currentSurahId) {
      surahGroups.push({ surah: item.surah, ayahs: [] });
      currentSurahId = item.surah.id;
    }
    surahGroups[surahGroups.length - 1].ayahs.push(item.ayah);
  }

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Surah Jump */}
        <select
          value={surahJump}
          onChange={(e) => handleSurahJump(e.target.value)}
          className="flex-1 min-w-[180px] bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="">Jump to Surah...</option>
          {QURAN.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id}. {s.englishName} — {s.name}
            </option>
          ))}
        </select>

        {/* Page Input */}
        <form onSubmit={handlePageInput} className="flex items-center gap-1.5">
          <span className="text-xs text-ink-muted">Page</span>
          <input
            type="number"
            min={1}
            max={TOTAL_PAGES}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            className="w-16 bg-surface-card border border-surface-border rounded-lg px-2 py-2 text-sm text-ink text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50 tabular-nums"
          />
          <span className="text-xs text-ink-muted">/ {TOTAL_PAGES}</span>
        </form>

        {/* Tajweed Legend Toggle */}
        {showTajweed && (
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`text-xs px-3 py-2 rounded-lg border transition ${
              showLegend
                ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200"
                : "bg-surface-card border-surface-border text-ink-muted hover:text-ink"
            }`}
          >
            Tajweed
          </button>
        )}
      </div>

      {/* Tajweed Legend */}
      {showLegend && (
        <div className="bg-surface-card rounded-xl border border-surface-border p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.values(TAJWEED_RULES).map((rule) => (
              <div key={rule.id} className="flex items-center gap-2 text-xs">
                <span className={`w-3 h-3 rounded-full ${rule.bgColor} border border-surface-border`} />
                <span className={`font-medium ${rule.color}`}>{rule.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mushaf Page */}
      <div className="bg-[#fef9ef] dark:bg-[#1a1710] rounded-2xl border-2 border-amber-200/60 dark:border-amber-900/40 p-5 md:p-8 min-h-[400px]">
        {surahGroups.map((group, gi) => {
          const isFirstAyahOfSurah = group.ayahs[0].n === 1;

          return (
            <div key={`${group.surah.id}-${gi}`}>
              {/* Surah Header (only when surah starts on this page) */}
              {isFirstAyahOfSurah && (
                <div className="text-center py-4 mb-4 border-y-2 border-amber-300/50 dark:border-amber-800/30">
                  <div className="bg-amber-100/60 dark:bg-amber-900/20 rounded-xl inline-block px-8 py-3">
                    <p className="font-arabic text-2xl text-amber-900 dark:text-amber-200">{group.surah.name}</p>
                    <p className="text-xs text-amber-800/70 dark:text-amber-300/70 mt-1">
                      {group.surah.englishName} — {group.surah.translation}
                    </p>
                  </div>
                  {/* Bismillah (not for Al-Fatiha which has it as Ayah 1, and not for At-Tawbah) */}
                  {group.surah.id !== 1 && group.surah.id !== 9 && (
                    <p className="font-arabic text-lg text-amber-800/60 dark:text-amber-300/50 mt-3" dir="rtl" lang="ar">
                      بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
                    </p>
                  )}
                </div>
              )}

              {/* Ayahs - flowing text like a real Mushaf */}
              <div className="text-right mb-4" dir="rtl" lang="ar">
                {group.ayahs.map((ayah) => {
                  const highlighted = isHighlighted(group.surah.id, ayah.n);
                  return (
                    <span key={ayah.n} className="inline">
                      <span
                        className={`font-arabic text-xl md:text-2xl leading-[2.4] ${
                          highlighted
                            ? "bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 rounded px-0.5"
                            : "text-amber-950 dark:text-amber-100"
                        }`}
                      >
                        {renderTajweedText(ayah.t)}
                      </span>
                      {/* Ayah number marker */}
                      <span className={`inline-flex items-center justify-center w-7 h-7 mx-1 rounded-full text-[10px] font-bold tabular-nums align-middle ${
                        highlighted
                          ? "bg-red-200 dark:bg-red-800/50 text-red-800 dark:text-red-200"
                          : "bg-amber-200/60 dark:bg-amber-800/30 text-amber-800 dark:text-amber-300"
                      }`}>
                        {ayah.n}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Page Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-card border border-surface-border text-sm font-semibold text-ink hover:bg-surface-bg disabled:opacity-30 disabled:cursor-not-allowed transition active:scale-95"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          Previous
        </button>

        <span className="text-sm font-bold text-ink tabular-nums">
          Page {page}
        </span>

        <button
          onClick={() => goTo(page + 1)}
          disabled={page >= TOTAL_PAGES}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-card border border-surface-border text-sm font-semibold text-ink hover:bg-surface-bg disabled:opacity-30 disabled:cursor-not-allowed transition active:scale-95"
        >
          Next
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  );
}
