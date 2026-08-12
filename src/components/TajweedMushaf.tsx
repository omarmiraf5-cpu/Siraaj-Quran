"use client";

import { useState, useCallback, useMemo } from "react";
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
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-gray-900 text-white text-[10px] rounded-md p-1.5 whitespace-nowrap pointer-events-none shadow-lg">
          <span className="font-semibold">{rule.name}</span>
        </span>
      )}
    </span>
  );
}

function MushafPage({
  pageNum,
  highlightedRange,
  showTajweed,
}: {
  pageNum: number;
  highlightedRange?: HighlightRange;
  showTajweed: boolean;
}) {
  const pageAyahs = useMemo(() => getPageAyahs(pageNum), [pageNum]);

  const isHighlighted = (surahId: number, ayahNum: number) => {
    if (!highlightedRange) return false;
    return surahId === highlightedRange.surah &&
      ayahNum >= highlightedRange.start &&
      ayahNum <= highlightedRange.end;
  };

  const renderChar = (char: string, idx: number) => {
    if (!showTajweed) return char;
    const rules = getLetterRules(char);
    if (rules.length === 0) return char;
    return (
      <TajweedTooltip key={idx} rules={rules}>
        <span className={rules[0].color}>{char}</span>
      </TajweedTooltip>
    );
  };

  // Group by surah
  const groups: { surah: SurahData; ayahs: { n: number; t: string; p: number }[] }[] = [];
  let curId = -1;
  for (const item of pageAyahs) {
    if (item.surah.id !== curId) {
      groups.push({ surah: item.surah, ayahs: [] });
      curId = item.surah.id;
    }
    groups[groups.length - 1].ayahs.push(item.ayah);
  }

  return (
    <div className="mushaf-page relative bg-[#fdf8ec] dark:bg-[#1c1a14] flex-1">
      {/* Ornate border */}
      <div className="absolute inset-0 border-2 border-[#8b7d56]/40 dark:border-[#8b7d56]/25 rounded-sm pointer-events-none" />
      <div className="absolute inset-[6px] border border-[#8b7d56]/25 dark:border-[#8b7d56]/15 rounded-sm pointer-events-none" />
      <div className="absolute inset-[10px] border border-[#c4a95a]/20 dark:border-[#c4a95a]/10 rounded-sm pointer-events-none" />

      {/* Content area */}
      <div className="relative px-4 md:px-6 py-4 md:py-5" dir="rtl" lang="ar">
        {/* Header line - Juz/Surah info */}
        <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-[#8b7d56]/20" dir="ltr">
          <span className="text-[10px] text-[#8b7d56]/60 dark:text-[#c4a95a]/40 tabular-nums">
            {pageNum}
          </span>
          <span className="text-[10px] text-[#8b7d56]/60 dark:text-[#c4a95a]/40">
            {groups.length > 0 ? groups[0].surah.englishName : ""}
          </span>
        </div>

        {/* Flowing Quran text */}
        <div>
          {groups.map((group, gi) => {
            const startsHere = group.ayahs[0].n === 1;
            return (
              <div key={`${group.surah.id}-${gi}`}>
                {/* Surah header banner */}
                {startsHere && (
                  <div className="my-3 mx-auto max-w-[85%]">
                    <div className="relative bg-gradient-to-r from-[#c4a95a]/10 via-[#c4a95a]/20 to-[#c4a95a]/10 dark:from-[#c4a95a]/5 dark:via-[#c4a95a]/10 dark:to-[#c4a95a]/5 border border-[#c4a95a]/30 dark:border-[#c4a95a]/15 rounded-md py-2 px-4 text-center">
                      {/* Corner ornaments */}
                      <span className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#c4a95a]/50 rounded-tr-md" />
                      <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#c4a95a]/50 rounded-tl-md" />
                      <span className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-[#c4a95a]/50 rounded-br-md" />
                      <span className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[#c4a95a]/50 rounded-bl-md" />

                      <p className="font-arabic text-lg md:text-xl text-[#5a4520] dark:text-[#c4a95a]">
                        سُورَةُ {group.surah.name}
                      </p>
                      <p className="text-[9px] text-[#8b7d56]/70 dark:text-[#c4a95a]/50 mt-0.5" dir="ltr">
                        {group.surah.translation} — {group.surah.ayahs.length} Ayahs
                      </p>
                    </div>
                    {/* Bismillah */}
                    {group.surah.id !== 1 && group.surah.id !== 9 && (
                      <p className="text-center font-arabic text-base md:text-lg text-[#5a4520]/70 dark:text-[#c4a95a]/50 mt-2 mb-1">
                        بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
                      </p>
                    )}
                  </div>
                )}

                {/* Ayahs flowing as continuous text */}
                <p className="font-arabic text-[17px] md:text-[20px] leading-[2.6] md:leading-[2.8] text-[#2c1f0e] dark:text-[#e8dcc8] text-justify">
                  {group.ayahs.map((ayah) => {
                    const hl = isHighlighted(group.surah.id, ayah.n);
                    return (
                      <span key={ayah.n} className="inline">
                        <span className={hl ? "bg-red-200/70 dark:bg-red-900/40 rounded-sm px-0.5" : ""}>
                          {showTajweed
                            ? ayah.t.split("").map((c, i) => renderChar(c, i))
                            : ayah.t}
                        </span>
                        {/* Ayah end marker */}
                        <span className={`inline-flex items-center justify-center w-[22px] h-[22px] md:w-[26px] md:h-[26px] mx-[2px] rounded-full text-[8px] md:text-[9px] font-bold tabular-nums align-middle ${
                          hl
                            ? "bg-red-300/60 dark:bg-red-800/40 text-red-900 dark:text-red-200"
                            : "bg-[#c4a95a]/20 dark:bg-[#c4a95a]/10 text-[#8b7d56] dark:text-[#c4a95a]/70"
                        }`}>
                          {ayah.n}
                        </span>{" "}
                      </span>
                    );
                  })}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function TajweedMushaf({
  initialPage = 1,
  highlightedRange,
  showTajweed = true,
}: TajweedMushafProps) {
  const [leftPage, setLeftPage] = useState(() => {
    const p = initialPage;
    return p % 2 === 0 ? p : p > 1 ? p - 1 : p;
  });
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [showLegend, setShowLegend] = useState(false);

  const rightPage = leftPage;
  const leftPageNum = leftPage + 1;

  const goTo = useCallback((p: number) => {
    const clamped = Math.max(1, Math.min(TOTAL_PAGES, p));
    const even = clamped % 2 === 0 ? clamped : clamped > 1 ? clamped - 1 : clamped;
    setLeftPage(even);
    setPageInput(String(clamped));
  }, []);

  const prevSpread = () => goTo(rightPage - 2);
  const nextSpread = () => goTo(leftPageNum + 1);

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(pageInput);
    if (!isNaN(n)) goTo(n);
  };

  const handleSurahJump = (surahId: string) => {
    if (!surahId) return;
    const s = getSurahById(parseInt(surahId));
    if (s && s.ayahs.length > 0) goTo(s.ayahs[0].p);
  };

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          onChange={(e) => handleSurahJump(e.target.value)}
          defaultValue=""
          className="flex-1 min-w-[160px] bg-surface-card border border-surface-border rounded-lg px-2.5 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        >
          <option value="">Jump to Surah...</option>
          {QURAN.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id}. {s.englishName}
            </option>
          ))}
        </select>

        <form onSubmit={handlePageSubmit} className="flex items-center gap-1">
          <span className="text-[10px] text-ink-muted">Pg</span>
          <input
            type="number"
            min={1}
            max={TOTAL_PAGES}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            className="w-14 bg-surface-card border border-surface-border rounded-md px-1.5 py-1.5 text-xs text-ink text-center focus:outline-none focus:ring-1 focus:ring-emerald-500/50 tabular-nums"
          />
          <span className="text-[10px] text-ink-muted">/ {TOTAL_PAGES}</span>
        </form>

        {showTajweed && (
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`text-[10px] px-2 py-1.5 rounded-md border transition ${
              showLegend
                ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200"
                : "bg-surface-card border-surface-border text-ink-muted"
            }`}
          >
            Tajweed
          </button>
        )}
      </div>

      {/* Tajweed Legend */}
      {showLegend && (
        <div className="bg-surface-card rounded-lg border border-surface-border p-2.5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            {Object.values(TAJWEED_RULES).map((rule) => (
              <div key={rule.id} className="flex items-center gap-1.5 text-[10px]">
                <span className={`w-2.5 h-2.5 rounded-full ${rule.bgColor}`} />
                <span className={`${rule.color} font-medium`}>{rule.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mushaf Book Spread */}
      <div className="relative bg-[#3a3228] dark:bg-[#1a1610] rounded-xl p-1.5 md:p-2 shadow-2xl">
        {/* Book spine shadow */}
        <div className="hidden md:block absolute left-1/2 top-2 bottom-2 w-[3px] -translate-x-1/2 bg-gradient-to-r from-black/20 via-black/5 to-black/20 z-10" />

        <div className="flex flex-col md:flex-row gap-1.5 md:gap-[3px]">
          {/* Right page (odd) - shown first in RTL Mushaf */}
          <MushafPage
            pageNum={rightPage}
            highlightedRange={highlightedRange}
            showTajweed={showTajweed}
          />

          {/* Left page (even) - only on desktop */}
          {leftPageNum <= TOTAL_PAGES && (
            <div className="hidden md:flex flex-1">
              <MushafPage
                pageNum={leftPageNum}
                highlightedRange={highlightedRange}
                showTajweed={showTajweed}
              />
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevSpread}
          disabled={rightPage <= 1}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-surface-card border border-surface-border text-xs font-semibold text-ink hover:bg-surface-bg disabled:opacity-30 transition active:scale-95"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          Previous
        </button>

        <span className="text-xs font-bold text-ink tabular-nums">
          {rightPage}
          <span className="hidden md:inline"> – {Math.min(leftPageNum, TOTAL_PAGES)}</span>
        </span>

        <button
          onClick={nextSpread}
          disabled={leftPageNum >= TOTAL_PAGES}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-surface-card border border-surface-border text-xs font-semibold text-ink hover:bg-surface-bg disabled:opacity-30 transition active:scale-95"
        >
          Next
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  );
}
