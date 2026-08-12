"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
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

interface PlayingAyah {
  surah: number;
  ayah: number;
  surahName: string;
}

interface PendingAyah {
  surah: number;
  ayah: number;
  surahName: string;
}

interface Reciter {
  id: string;
  name: string;
  cdnId: string;
}

const RECITERS: Reciter[] = [
  { id: "sufi", name: "Abdirashid Ali Sufi", cdnId: "ar.abdurashidsufi" },
  { id: "minshawi", name: "Al-Minshawi", cdnId: "ar.minshawi" },
  { id: "husary", name: "Khalil Al-Husary", cdnId: "ar.husary" },
  { id: "ayyub", name: "Muhammad Ayyub", cdnId: "ar.ayyub" },
];

function getAbsoluteAyahNumber(surah: number, ayah: number): number {
  let total = 0;
  for (let i = 0; i < surah - 1 && i < QURAN.length; i++) {
    total += QURAN[i].ayahs.length;
  }
  return total + ayah;
}

function getAudioUrl(reciter: Reciter, surah: number, ayah: number): string {
  const n = getAbsoluteAyahNumber(surah, ayah);
  return `https://cdn.islamic.network/quran/audio/128/${reciter.cdnId}/${n}.mp3`;
}

const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282,
  302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

function getJuzForPage(page: number): number {
  let juz = 1;
  for (let i = 0; i < JUZ_START_PAGES.length; i++) {
    if (page >= JUZ_START_PAGES[i]) juz = i + 1;
  }
  return juz;
}

const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

function toArabicNumerals(n: number): string {
  return String(n)
    .split("")
    .map((d) => ARABIC_DIGITS[Number(d)] ?? d)
    .join("");
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

function ReciterPicker({
  onSelect,
  onClose,
}: {
  onSelect: (reciter: Reciter) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-[#fdf8ec] dark:bg-[#1c1a14] border-2 border-[#c4a95a]/40 rounded-xl p-4 shadow-2xl w-[260px]"
        onClick={(e) => e.stopPropagation()}
        dir="ltr"
      >
        <p className="text-xs font-bold text-[#5a4520] dark:text-[#c4a95a] mb-3 text-center">
          Choose Reciter
        </p>
        <div className="space-y-1.5">
          {RECITERS.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-[#2c1f0e] dark:text-[#e8dcc8] hover:bg-[#c4a95a]/20 dark:hover:bg-[#c4a95a]/10 transition active:scale-[.98]"
            >
              {r.name}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-2 text-[10px] text-[#8b7d56]/60 dark:text-[#c4a95a]/40 hover:text-[#8b7d56] py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function MushafPage({
  pageNum,
  highlightedRange,
  showTajweed,
  playingAyah,
  onAyahClick,
}: {
  pageNum: number;
  highlightedRange?: HighlightRange;
  showTajweed: boolean;
  playingAyah: PlayingAyah | null;
  onAyahClick: (surah: number, ayah: number, surahName: string) => void;
}) {
  const pageAyahs = useMemo(() => getPageAyahs(pageNum), [pageNum]);

  const isHighlighted = (surahId: number, ayahNum: number) => {
    if (!highlightedRange) return false;
    return surahId === highlightedRange.surah &&
      ayahNum >= highlightedRange.start &&
      ayahNum <= highlightedRange.end;
  };

  const isPlaying = (surahId: number, ayahNum: number) => {
    if (!playingAyah) return false;
    return playingAyah.surah === surahId && playingAyah.ayah === ayahNum;
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

  const groups: { surah: SurahData; ayahs: { n: number; t: string; p: number }[] }[] = [];
  let curId = -1;
  for (const item of pageAyahs) {
    if (item.surah.id !== curId) {
      groups.push({ surah: item.surah, ayahs: [] });
      curId = item.surah.id;
    }
    groups[groups.length - 1].ayahs.push(item.ayah);
  }

  const headerSurah = groups.length > 0 ? groups[0].surah : null;
  const juz = getJuzForPage(pageNum);

  return (
    <div className="mushaf-page relative bg-[#fdfaf0] dark:bg-[#1c1a14] flex-1 flex flex-col h-[80vh] md:h-[86vh]">
      {/* Ornamental frame */}
      <div className="absolute inset-0 border-[3px] border-[#a8894a]/60 dark:border-[#8b7d56]/30 rounded-[3px] pointer-events-none" />
      <div className="absolute inset-[5px] border border-[#a8894a]/35 dark:border-[#8b7d56]/20 rounded-[2px] pointer-events-none" />
      <div className="absolute inset-[9px] border-[2px] border-[#c4a95a]/25 dark:border-[#c4a95a]/12 rounded-[2px] pointer-events-none" />
      {/* Corner ornaments */}
      <span className="absolute top-[9px] right-[9px] w-4 h-4 border-t-2 border-r-2 border-[#a8894a]/50 pointer-events-none" />
      <span className="absolute top-[9px] left-[9px] w-4 h-4 border-t-2 border-l-2 border-[#a8894a]/50 pointer-events-none" />
      <span className="absolute bottom-[9px] right-[9px] w-4 h-4 border-b-2 border-r-2 border-[#a8894a]/50 pointer-events-none" />
      <span className="absolute bottom-[9px] left-[9px] w-4 h-4 border-b-2 border-l-2 border-[#a8894a]/50 pointer-events-none" />

      <div className="relative px-4 md:px-7 pt-4 md:pt-5 pb-2 flex flex-col flex-1 min-h-0" dir="rtl" lang="ar">
        {/* Running header: surah name (right) / juz (left) */}
        <div className="flex justify-between items-baseline mb-1.5 pb-1 border-b border-[#a8894a]/25 flex-shrink-0">
          <span className="font-arabic text-[13px] md:text-[15px] text-[#8b6f35] dark:text-[#c4a95a]/60">
            سورة {headerSurah ? headerSurah.name : ""}
          </span>
          <span className="font-arabic text-[13px] md:text-[15px] text-[#8b6f35] dark:text-[#c4a95a]/60">
            الجزء {toArabicNumerals(juz)}
          </span>
        </div>

        {/* Text body — fills available height */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-center">
          {groups.map((group, gi) => {
            const startsHere = group.ayahs[0].n === 1;
            return (
              <div key={`${group.surah.id}-${gi}`}>
                {startsHere && (
                  <div className="my-2 mx-auto max-w-[92%]">
                    <div className="relative bg-gradient-to-r from-[#c4a95a]/12 via-[#c4a95a]/25 to-[#c4a95a]/12 dark:from-[#c4a95a]/5 dark:via-[#c4a95a]/12 dark:to-[#c4a95a]/5 border-y-2 border-[#a8894a]/45 dark:border-[#c4a95a]/20 py-2 px-4 text-center">
                      <p className="font-arabic text-xl md:text-2xl text-[#5a4520] dark:text-[#c4a95a] leading-tight">
                        سُورَةُ {group.surah.name}
                      </p>
                    </div>
                    {group.surah.id !== 1 && group.surah.id !== 9 && (
                      <p className="text-center font-arabic text-lg md:text-[22px] text-[#2c1f0e]/80 dark:text-[#c4a95a]/50 mt-2 mb-1">
                        بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
                      </p>
                    )}
                  </div>
                )}

                <p
                  className="font-arabic text-[20px] md:text-[26px] text-[#1a1206] dark:text-[#e8dcc8]"
                  style={{
                    textAlign: "justify",
                    textAlignLast: "justify",
                    lineHeight: 2.15,
                    wordSpacing: "0.05em",
                  }}
                >
                  {group.ayahs.map((ayah) => {
                    const hl = isHighlighted(group.surah.id, ayah.n);
                    const playing = isPlaying(group.surah.id, ayah.n);
                    return (
                      <span key={ayah.n} className="inline">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => onAyahClick(group.surah.id, ayah.n, group.surah.englishName)}
                          onKeyDown={(e) => { if (e.key === "Enter") onAyahClick(group.surah.id, ayah.n, group.surah.englishName); }}
                          className={`cursor-pointer ${
                            playing
                              ? "bg-emerald-200/70 dark:bg-emerald-900/40 rounded-sm px-0.5"
                              : hl
                                ? "bg-red-200/70 dark:bg-red-900/40 rounded-sm px-0.5"
                                : "hover:bg-[#c4a95a]/15 dark:hover:bg-[#c4a95a]/10 rounded-sm"
                          }`}
                        >
                          {showTajweed
                            ? ayah.t.split("").map((c, i) => renderChar(c, i))
                            : ayah.t}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => onAyahClick(group.surah.id, ayah.n, group.surah.englishName)}
                          onKeyDown={(e) => { if (e.key === "Enter") onAyahClick(group.surah.id, ayah.n, group.surah.englishName); }}
                          className={`inline-flex items-center justify-center w-[24px] h-[24px] md:w-[28px] md:h-[28px] mx-[3px] rounded-full font-arabic text-[11px] md:text-[13px] align-middle cursor-pointer transition-colors border ${
                            playing
                              ? "bg-emerald-400/60 dark:bg-emerald-700/50 text-emerald-900 dark:text-emerald-100 border-emerald-600/50"
                              : hl
                                ? "bg-red-300/60 dark:bg-red-800/40 text-red-900 dark:text-red-200 border-red-500/40 hover:bg-red-400/60"
                                : "bg-transparent text-[#8b6f35] dark:text-[#c4a95a]/70 border-[#a8894a]/45 hover:bg-[#c4a95a]/25"
                          }`}
                        >
                          {toArabicNumerals(ayah.n)}
                        </span>{" "}
                      </span>
                    );
                  })}
                </p>
              </div>
            );
          })}
        </div>

        {/* Page number — bottom center, framed like the Mushaf */}
        <div className="flex-shrink-0 flex justify-center pt-1.5 mt-1 border-t border-[#a8894a]/25">
          <span className="inline-flex items-center justify-center min-w-[30px] h-[22px] px-2 rounded-full border border-[#a8894a]/45 font-arabic text-[12px] md:text-[14px] text-[#8b6f35] dark:text-[#c4a95a]/60">
            {toArabicNumerals(pageNum)}
          </span>
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

  const [playingAyah, setPlayingAyah] = useState<PlayingAyah | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPaused, setAudioPaused] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [activeReciter, setActiveReciter] = useState<Reciter | null>(null);
  const [pendingAyah, setPendingAyah] = useState<PendingAyah | null>(null);
  const [showReciterPicker, setShowReciterPicker] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingAyah(null);
    setAudioLoading(false);
    setAudioPaused(false);
    setAudioError(null);
  }, []);

  const startPlayback = useCallback((reciter: Reciter, surah: number, ayah: number, surahName: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setPlayingAyah({ surah, ayah, surahName });
    setActiveReciter(reciter);
    setAudioLoading(true);
    setAudioPaused(false);
    setAudioError(null);

    const url = getAudioUrl(reciter, surah, ayah);
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.addEventListener("canplaythrough", () => {
      setAudioLoading(false);
      setAudioError(null);
    }, { once: true });

    audio.addEventListener("ended", () => {
      setPlayingAyah(null);
      setAudioPaused(false);
      audioRef.current = null;
    });

    audio.addEventListener("error", () => {
      setAudioError("Could not load audio");
      setAudioLoading(false);
      setPlayingAyah(null);
      audioRef.current = null;
      setTimeout(() => setAudioError(null), 3000);
    }, { once: true });

    audio.play().catch(() => {
      setAudioError("Could not play audio");
      setAudioLoading(false);
      setPlayingAyah(null);
      audioRef.current = null;
      setTimeout(() => setAudioError(null), 3000);
    });
  }, []);

  const handleAyahClick = useCallback((surah: number, ayah: number, surahName: string) => {
    if (playingAyah && playingAyah.surah === surah && playingAyah.ayah === ayah) {
      if (audioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.play();
          setAudioPaused(false);
        } else {
          audioRef.current.pause();
          setAudioPaused(true);
        }
      }
      return;
    }

    setPendingAyah({ surah, ayah, surahName });
    setShowReciterPicker(true);
  }, [playingAyah]);

  const handleReciterSelect = useCallback((reciter: Reciter) => {
    setShowReciterPicker(false);
    if (pendingAyah) {
      startPlayback(reciter, pendingAyah.surah, pendingAyah.ayah, pendingAyah.surahName);
      setPendingAyah(null);
    }
  }, [pendingAyah, startPlayback]);

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
    <div className="space-y-1.5">
      {/* Reciter Picker Modal */}
      {showReciterPicker && (
        <ReciterPicker
          onSelect={handleReciterSelect}
          onClose={() => { setShowReciterPicker(false); setPendingAyah(null); }}
        />
      )}

      {/* Controls */}
      <div className="flex items-center gap-1.5">
        <select
          onChange={(e) => handleSurahJump(e.target.value)}
          defaultValue=""
          className="flex-1 min-w-0 bg-surface-card border border-surface-border rounded-md px-2 py-1 text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        >
          <option value="">Jump to Surah...</option>
          {QURAN.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id}. {s.englishName}
            </option>
          ))}
        </select>

        <form onSubmit={handlePageSubmit} className="flex items-center gap-1 flex-shrink-0">
          <input
            type="number"
            min={1}
            max={TOTAL_PAGES}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            className="w-11 bg-surface-card border border-surface-border rounded-md px-1 py-1 text-[11px] text-ink text-center focus:outline-none focus:ring-1 focus:ring-emerald-500/50 tabular-nums"
          />
          <span className="text-[9px] text-ink-muted">/{TOTAL_PAGES}</span>
        </form>

        {showTajweed && (
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`text-[10px] px-1.5 py-1 rounded-md border transition flex-shrink-0 ${
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

        <div className="flex flex-col md:flex-row-reverse gap-1.5 md:gap-[3px]">
          <MushafPage
            pageNum={rightPage}
            highlightedRange={highlightedRange}
            showTajweed={showTajweed}
            playingAyah={playingAyah}
            onAyahClick={handleAyahClick}
          />

          {leftPageNum <= TOTAL_PAGES && (
            <div className="hidden md:flex flex-1">
              <MushafPage
                pageNum={leftPageNum}
                highlightedRange={highlightedRange}
                showTajweed={showTajweed}
                playingAyah={playingAyah}
                onAyahClick={handleAyahClick}
              />
            </div>
          )}
        </div>

        {/* Audio Error */}
        {audioError && !playingAyah && (
          <div className="mt-1.5 bg-red-900/80 rounded-lg px-3 py-2 text-center">
            <span className="text-[11px] text-red-200">{audioError}</span>
          </div>
        )}

        {/* Audio Player Bar */}
        {playingAyah && activeReciter && (
          <div className="mt-1.5 bg-[#2a2520] dark:bg-[#0f0d0a] rounded-lg px-3 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {audioLoading ? (
                <div className="w-4 h-4 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin flex-shrink-0" />
              ) : (
                <span className="text-emerald-400 flex-shrink-0">
                  {audioPaused ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  )}
                </span>
              )}
              <span className="text-[11px] text-[#c4a95a] font-semibold truncate">
                {playingAyah.surahName} — Ayah {playingAyah.ayah}
              </span>
              <span className="text-[9px] text-[#8b7d56]/60 flex-shrink-0">{activeReciter.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleAyahClick(playingAyah.surah, playingAyah.ayah, playingAyah.surahName)}
                className="text-[#c4a95a]/70 hover:text-[#c4a95a] transition p-1"
              >
                {audioPaused ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                )}
              </button>
              <button
                onClick={stopAudio}
                className="text-[#c4a95a]/70 hover:text-red-400 transition p-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={nextSpread}
          disabled={leftPageNum >= TOTAL_PAGES}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-surface-card border border-surface-border text-xs font-semibold text-ink hover:bg-surface-bg disabled:opacity-30 transition active:scale-95"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          Next
        </button>

        <span className="text-xs font-bold text-ink tabular-nums">
          {rightPage}
          <span className="hidden md:inline"> – {Math.min(leftPageNum, TOTAL_PAGES)}</span>
        </span>

        <button
          onClick={prevSpread}
          disabled={rightPage <= 1}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-surface-card border border-surface-border text-xs font-semibold text-ink hover:bg-surface-bg disabled:opacity-30 transition active:scale-95"
        >
          Previous
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  );
}
