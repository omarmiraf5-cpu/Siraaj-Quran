"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  SURAHS,
  TOTAL_PAGES,
  getSurahById,
  getJuzForPage,
  getSurahsOnPage,
} from "@/data/mushaf-index";
import { QcfMushafPage, usePageLayout } from "./QcfMushafPage";

interface HighlightRange {
  surah: number;
  start: number;
  end: number;
}

interface MushafProps {
  initialPage?: number;
  highlightedRange?: HighlightRange;
}

interface PlayingAyah {
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
  for (const s of SURAHS) {
    if (s.id === surah) break;
    total += s.ayahs;
  }
  return total + ayah;
}

function getAudioUrl(reciter: Reciter, surah: number, ayah: number): string {
  const n = getAbsoluteAyahNumber(surah, ayah);
  return `https://cdn.islamic.network/quran/audio/128/${reciter.cdnId}/${n}.mp3`;
}

const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

function toArabicNumerals(n: number): string {
  return String(n)
    .split("")
    .map((d) => ARABIC_DIGITS[Number(d)] ?? d)
    .join("");
}

function ReciterPicker({
  onSelect,
  onClose,
}: {
  onSelect: (reciter: Reciter) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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
  playingAyah,
  onAyahClick,
}: {
  pageNum: number;
  highlightedRange?: HighlightRange;
  playingAyah: PlayingAyah | null;
  onAyahClick: (surah: number, ayah: number, surahName: string) => void;
}) {
  const layout = usePageLayout(pageNum);
  const surahsHere = getSurahsOnPage(pageNum);
  const juz = getJuzForPage(pageNum);

  // The page box maintains the printed Mushaf's 1:1.545 proportion.
  // Sized directly on the flex container with explicit width limits to prevent
  // overflow in narrower containers (max-w-3xl layout, teacher preview half-width, etc).
  // On mobile: one page fills available width with padding room (max-w-[90%])
  // On desktop: two pages fit side-by-side (max-w-[48%] each, accounting for gap)
  return (
    <div className="mushaf-page relative bg-[#fdfaf0] dark:bg-[#1c1a14] flex-none flex flex-col aspect-[1/1.545] max-w-[90%] md:max-w-[48%] overflow-hidden">
      {/* Ornamental frame */}
      <div className="absolute inset-0 border-[3px] border-[#a8894a]/60 dark:border-[#8b7d56]/30 rounded-[3px] pointer-events-none" />
      <div className="absolute inset-[5px] border border-[#a8894a]/35 dark:border-[#8b7d56]/20 rounded-[2px] pointer-events-none" />
      <div className="absolute inset-[9px] border-[2px] border-[#c4a95a]/25 dark:border-[#c4a95a]/12 rounded-[2px] pointer-events-none" />
      <span className="absolute top-[9px] right-[9px] w-4 h-4 border-t-2 border-r-2 border-[#a8894a]/50 pointer-events-none" />
      <span className="absolute top-[9px] left-[9px] w-4 h-4 border-t-2 border-l-2 border-[#a8894a]/50 pointer-events-none" />
      <span className="absolute bottom-[9px] right-[9px] w-4 h-4 border-b-2 border-r-2 border-[#a8894a]/50 pointer-events-none" />
      <span className="absolute bottom-[9px] left-[9px] w-4 h-4 border-b-2 border-l-2 border-[#a8894a]/50 pointer-events-none" />

      <div className="relative px-4 md:px-7 pt-4 md:pt-5 pb-2 flex flex-col flex-1 min-h-0" dir="rtl" lang="ar">
        {/* Running header: surah name(s) right, juz left */}
        <div className="flex justify-between items-baseline mb-1.5 pb-1 border-b border-[#a8894a]/25 flex-shrink-0">
          <span className="font-arabic text-[13px] md:text-[15px] text-[#8b6f35] dark:text-[#c4a95a]/60 truncate">
            {surahsHere.map((s) => s.name).join(" · ")}
          </span>
          <span className="font-arabic text-[13px] md:text-[15px] text-[#8b6f35] dark:text-[#c4a95a]/60 flex-shrink-0 pr-2">
            الجزء {toArabicNumerals(juz)}
          </span>
        </div>

        <QcfMushafPage
          pageNum={pageNum}
          layout={layout}
          highlightedRange={highlightedRange}
          playingKey={playingAyah ? `${playingAyah.surah}:${playingAyah.ayah}` : null}
          onAyahClick={(s, a) => {
            const surah = getSurahById(s);
            onAyahClick(s, a, surah ? surah.englishName : "");
          }}
        />

        {/* Page number — bottom centre */}
        <div className="flex-shrink-0 flex justify-center pt-1.5 mt-1 border-t border-[#a8894a]/25">
          <span className="inline-flex items-center justify-center min-w-[30px] h-[22px] px-2 rounded-full border border-[#a8894a]/45 font-arabic text-[12px] md:text-[14px] text-[#8b6f35] dark:text-[#c4a95a]/60">
            {toArabicNumerals(pageNum)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Mushaf({ initialPage = 1, highlightedRange }: MushafProps) {
  const [leftPage, setLeftPage] = useState(() => {
    const p = initialPage;
    return p % 2 === 0 ? p : p > 1 ? p - 1 : p;
  });
  const [pageInput, setPageInput] = useState(String(initialPage));

  const [playingAyah, setPlayingAyah] = useState<PlayingAyah | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPaused, setAudioPaused] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [activeReciter, setActiveReciter] = useState<Reciter | null>(null);
  const [pendingAyah, setPendingAyah] = useState<PlayingAyah | null>(null);
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

  const startPlayback = useCallback(
    (reciter: Reciter, surah: number, ayah: number, surahName: string) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setPlayingAyah({ surah, ayah, surahName });
      setActiveReciter(reciter);
      setAudioLoading(true);
      setAudioPaused(false);
      setAudioError(null);

      const audio = new Audio(getAudioUrl(reciter, surah, ayah));
      audioRef.current = audio;

      audio.addEventListener(
        "canplaythrough",
        () => {
          setAudioLoading(false);
          setAudioError(null);
        },
        { once: true }
      );

      audio.addEventListener("ended", () => {
        setPlayingAyah(null);
        setAudioPaused(false);
        audioRef.current = null;
      });

      const fail = (msg: string) => {
        setAudioError(msg);
        setAudioLoading(false);
        setPlayingAyah(null);
        audioRef.current = null;
        setTimeout(() => setAudioError(null), 3000);
      };

      audio.addEventListener("error", () => fail("Could not load audio"), { once: true });
      audio.play().catch(() => fail("Could not play audio"));
    },
    []
  );

  const handleAyahClick = useCallback(
    (surah: number, ayah: number, surahName: string) => {
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
    },
    [playingAyah]
  );

  const handleReciterSelect = useCallback(
    (reciter: Reciter) => {
      setShowReciterPicker(false);
      if (pendingAyah) {
        startPlayback(reciter, pendingAyah.surah, pendingAyah.ayah, pendingAyah.surahName);
        setPendingAyah(null);
      }
    },
    [pendingAyah, startPlayback]
  );

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
    if (s) goTo(s.startPage);
  };

  return (
    <div className="space-y-1.5">
      {showReciterPicker && (
        <ReciterPicker
          onSelect={handleReciterSelect}
          onClose={() => {
            setShowReciterPicker(false);
            setPendingAyah(null);
          }}
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
          {SURAHS.map((s) => (
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
      </div>

      {/* Book spread — lower page number sits on the right (RTL).
          containerType: inline-size makes the pages' cqw units measure this
          wrapper's actual rendered width instead of the viewport. */}
      <div
        className="relative bg-[#3a3228] dark:bg-[#1a1610] rounded-xl p-1.5 md:p-2 shadow-2xl"
        style={{ containerType: "inline-size" }}
      >
        <div className="hidden md:block absolute left-1/2 top-2 bottom-2 w-[3px] -translate-x-1/2 bg-gradient-to-r from-black/20 via-black/5 to-black/20 z-10" />

        <div className="flex flex-col md:flex-row-reverse items-center justify-center gap-1.5 md:gap-[3px]">
          <MushafPage
            pageNum={rightPage}
            highlightedRange={highlightedRange}
            playingAyah={playingAyah}
            onAyahClick={handleAyahClick}
          />

          {leftPageNum <= TOTAL_PAGES && (
            <div className="hidden md:flex">
              <MushafPage
                pageNum={leftPageNum}
                highlightedRange={highlightedRange}
                playingAyah={playingAyah}
                onAyahClick={handleAyahClick}
              />
            </div>
          )}
        </div>

        {audioError && !playingAyah && (
          <div className="mt-1.5 bg-red-900/80 rounded-lg px-3 py-2 text-center">
            <span className="text-[11px] text-red-200">{audioError}</span>
          </div>
        )}

        {playingAyah && activeReciter && (
          <div className="mt-1.5 bg-[#2a2520] dark:bg-[#0f0d0a] rounded-lg px-3 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {audioLoading ? (
                <div className="w-4 h-4 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin flex-shrink-0" />
              ) : (
                <span className="text-emerald-400 flex-shrink-0">
                  {audioPaused ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                )}
              </button>
              <button onClick={stopAudio} className="text-[#c4a95a]/70 hover:text-red-400 transition p-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation — Next advances (leftward, RTL) */}
      <div className="flex items-center justify-between">
        <button
          onClick={nextSpread}
          disabled={leftPageNum >= TOTAL_PAGES}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-surface-card border border-surface-border text-xs font-semibold text-ink hover:bg-surface-bg disabled:opacity-30 transition active:scale-95"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
    </div>
  );
}
